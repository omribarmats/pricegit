"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

interface AuthFormProps {
  mode: "login" | "signup";
}

export default function AuthForm({ mode }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [emailChecking, setEmailChecking] = useState(false);
  const [emailExists, setEmailExists] = useState<boolean | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [isExtensionSource, setIsExtensionSource] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const { signIn, signUp, resetPassword } = useAuth();

  // Check if opened from extension
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setIsExtensionSource(params.get("source") === "extension");
    }
  }, []);

  // Check for pending verification on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const pending = localStorage.getItem("pendingVerification");
      if (pending && pending === email) {
        setPendingEmail(pending);
      } else if (pending && !email) {
        // Show pending email on mount
        setPendingEmail(pending);
      }
    }
  }, [email]);

  // Clear pending verification if user is already verified
  useEffect(() => {
    const checkVerification = async () => {
      if (pendingEmail) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user && user.email_confirmed_at) {
          localStorage.removeItem("pendingVerification");
          setPendingEmail(null);
        }
      }
    };
    checkVerification();
  }, [pendingEmail]);

  // Live email validation for signup mode
  useEffect(() => {
    if (mode !== "signup") return;

    const checkEmail = async () => {
      if (!email || email.length < 3 || !email.includes("@")) {
        setEmailExists(null);
        return;
      }

      setEmailChecking(true);

      try {
        const { data, error } = await supabase
          .from("users")
          .select("email")
          .eq("email", email)
          .single();

        if (error && error.code === "PGRST116") {
          // No rows returned - email is available
          setEmailExists(false);
        } else if (data) {
          // Email exists
          setEmailExists(true);
        }
      } catch {
        // Email check failed — allow form submission anyway
      } finally {
        setEmailChecking(false);
      }
    };

    const debounce = setTimeout(checkEmail, 500);
    return () => clearTimeout(debounce);
  }, [email, mode]);

  const validatePassword = (pass: string) => {
    if (pass.length === 0) {
      setPasswordError(null);
      return;
    }

    // Option 1: 15+ characters (any combination)
    if (pass.length >= 15) {
      setPasswordError(null);
      return;
    }

    // Option 2: 8+ characters with at least one number AND one lowercase letter
    if (pass.length >= 8) {
      const hasNumber = /\d/.test(pass);
      const hasLowercase = /[a-z]/.test(pass);

      if (hasNumber && hasLowercase) {
        setPasswordError(null);
        return;
      }
    }

    // If neither condition is met, show error
    setPasswordError(
      "Password should be at least 15 characters OR at least 8 characters including a number and a lowercase letter.",
    );
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pass = e.target.value;
    setPassword(pass);
    if (mode === "signup") {
      validatePassword(pass);
    }
  };

  const handleGoogleSignIn = async () => {
    const redirectUrl = isExtensionSource
      ? `${window.location.origin}/auth/callback?source=extension`
      : `${window.location.origin}/`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
      },
    });
    if (error) setError(error.message);
  };

  const handleResendVerification = async () => {
    if (!pendingEmail) return;

    setResendingVerification(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: pendingEmail,
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage("Verification email resent! Check your inbox.");
    }
    setResendingVerification(false);
  };

  // Send auth token to extension
  const sendAuthToExtension = async (userEmail: string) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setMessage("Login successful! Please close this tab.");
        return;
      }

      // Fetch username from users table
      const { data: userData } = await supabase
        .from("users")
        .select("username")
        .eq("id", session.user.id)
        .single();

      const username = userData?.username || userEmail.split("@")[0];

      // Store in localStorage as fallback (extension can read this)
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "priceGitExtensionAuth",
          JSON.stringify({
            authToken: session.access_token,
            refreshToken: session.refresh_token,
            username: username,
            timestamp: Date.now(),
          }),
        );
      }

      // Try to send via chrome.runtime if available
      if (typeof chrome !== "undefined" && chrome.runtime) {
        const extensionId = process.env.NEXT_PUBLIC_EXTENSION_ID;

        if (extensionId && extensionId !== "your-extension-id") {
          // Try to send message to extension (might fail if page doesn't have access)
          try {
            chrome.runtime.sendMessage(
              extensionId,
              {
                action: "setAuth",
                authToken: session.access_token,
                refreshToken: session.refresh_token,
                username: username,
              },
              () => {
                // Extension messaging may not be available from web page — expected
              },
            );
          } catch {
            // Extension messaging not available from web page — expected
          }
        }
      }

      // Always show success message (content script will handle auth sync via localStorage)
      setMessage(
        "✅ Signed in! You can now close this tab and return to the extension.",
      );
    } catch {
      setMessage(
        "Logged in! You can now close this tab and return to the extension.",
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      if (mode === "signup") {
        const { error: signUpError } = await signUp(email, password);
        if (signUpError) {
          setError(signUpError.message);
        } else {
          // Trigger will automatically create profile with random username
          // Store email for pending verification reminder
          localStorage.setItem("pendingVerification", email);
          setMessage(
            "Check your email to confirm your account! You'll be able to customize your profile after verification.",
          );
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          // Check if it's an email not confirmed error
          if (error.message.toLowerCase().includes("email not confirmed")) {
            setError(
              "Please verify your email before signing in. Check your inbox for the verification link.",
            );
            // Store email for resend option
            localStorage.setItem("pendingVerification", email);
          } else {
            setError(error.message);
          }
          setLoading(false);
        } else {
          // Clear pending verification on successful login
          localStorage.removeItem("pendingVerification");

          // If opened from extension, send auth token
          if (isExtensionSource) {
            await sendAuthToExtension(email);
          } else {
            // Redirect immediately - don't wait for auth state to update
            window.location.href = "/";
          }
          return; // Don't set loading to false, page will reload or close
        }
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <form
        onSubmit={handleSubmit}
        className="space-y-5 bg-white p-8 rounded-lg border border-gray-200"
      >
        <div>
          <h2 className="text-2xl font-normal text-gray-900 mb-6">
            {mode === "login" ? "Sign in to PriceGit" : "Sign up for PriceGit"}
          </h2>
        </div>

        {(mode === "signup" || mode === "login") && (
          <>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">or</span>
              </div>
            </div>
          </>
        )}

        {pendingEmail && mode === "login" && !error && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded text-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">Verify your email</p>
                <p className="text-xs mt-1">
                  We sent a verification email to{" "}
                  <strong>{pendingEmail}</strong>. Please check your inbox and
                  click the link to activate your account.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem("pendingVerification");
                  setPendingEmail(null);
                }}
                className="text-blue-400 hover:text-blue-600"
              >
                ✕
              </button>
            </div>
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={resendingVerification}
              className="mt-2 text-xs text-blue-600 hover:underline disabled:opacity-50"
            >
              {resendingVerification
                ? "Sending..."
                : "Resend verification email"}
            </button>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
            {error}
          </div>
        )}

        {message && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm">
            {message}
          </div>
        )}

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-900 mb-1.5"
          >
            Email<span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={`w-full px-3 py-2 pr-10 border ${
                mode === "signup" && emailExists
                  ? "border-red-300"
                  : mode === "signup" &&
                      emailExists === false &&
                      email.includes("@")
                    ? "border-green-300"
                    : "border-gray-300"
              } rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm`}
              placeholder="Email"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              {mode === "signup" && emailChecking && (
                <svg
                  className="animate-spin h-4 w-4 text-gray-400"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              )}
              {mode === "signup" &&
                !emailChecking &&
                emailExists === false &&
                email.includes("@") && (
                  <svg
                    className="h-5 w-5 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 13l4 4L19 7"
                    ></path>
                  </svg>
                )}
              {mode === "signup" && !emailChecking && emailExists && (
                <svg
                  className="h-5 w-5 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  ></path>
                </svg>
              )}
            </div>
          </div>
          {mode === "signup" && emailExists && (
            <div className="mt-1.5 flex items-start gap-1 text-xs text-red-600">
              <span>⚠</span>
              <span>
                The email you have provided is already associated with an
                account.{" "}
                <a href="/login" className="text-blue-600 hover:underline">
                  Sign in
                </a>{" "}
                or{" "}
                <a
                  href="/forgot-password"
                  className="text-blue-600 hover:underline"
                >
                  reset your password
                </a>
                .
              </span>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-900"
            >
              Password<span className="text-red-500">*</span>
            </label>
            {mode === "login" && (
              <a
                href="/forgot-password"
                className="text-sm text-blue-600 hover:underline"
              >
                Forgot password?
              </a>
            )}
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={handlePasswordChange}
              required
              minLength={6}
              className={`w-full px-3 py-2 pr-20 border ${
                passwordError
                  ? "border-red-300"
                  : !passwordError && password.length > 0
                    ? "border-green-300"
                    : "border-gray-300"
              } rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm`}
              placeholder="Password"
            />
            <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-3">
              {!passwordError && password.length > 0 && (
                <svg
                  className="h-5 w-5 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  ></path>
                </svg>
              )}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-gray-400 hover:text-gray-600"
              >
                {showPassword ? (
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
          {mode === "signup" && passwordError && (
            <div className="mt-2 flex items-start gap-2 text-xs text-gray-600">
              <span className="text-red-500">⚠</span>
              <span>{passwordError}</span>
            </div>
          )}
          {mode === "signup" && !passwordError && password.length > 0 && (
            <div className="mt-2 text-xs text-gray-600">
              Password should be at least 15 characters OR at least 8 characters
              including a number and a lowercase letter.
            </div>
          )}
        </div>

        {mode === "signup" && (
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              id="terms"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="terms" className="text-xs text-gray-600 leading-relaxed">
              I agree to the{" "}
              <a href="/terms" target="_blank" className="text-blue-600 hover:underline">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="/privacy" target="_blank" className="text-blue-600 hover:underline">
                Privacy Policy
              </a>
            </label>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || (mode === "signup" && !agreedToTerms)}
          className="w-full bg-green-600 text-white py-2.5 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-sm"
        >
          {loading
            ? "Loading..."
            : mode === "login"
              ? "Sign in"
              : "Create account"}
        </button>

        <div className="text-center text-sm border-t border-gray-200 pt-5">
          {mode === "login" ? (
            <p className="text-gray-700">
              New to PriceGit?{" "}
              <a href="/signup" className="text-blue-600 hover:underline">
                Create an account
              </a>
            </p>
          ) : (
            <p className="text-gray-700">
              Already have an account?{" "}
              <a href="/login" className="text-blue-600 hover:underline">
                Sign in →
              </a>
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
