"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("Processing authentication...");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Check if this is from extension
        const params = new URLSearchParams(window.location.search);
        const isFromExtension = params.get("source") === "extension";

        // Get the session
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error("Auth error:", error);
          setMessage("Authentication failed. You can close this tab.");
          return;
        }

        if (!session) {
          setMessage("No session found. You can close this tab.");
          return;
        }

        // If from extension, send auth to extension
        if (isFromExtension) {
          setMessage("Sending authentication to extension...");

          try {
            // Check if chrome.runtime is available
            if (typeof chrome === "undefined" || !chrome.runtime) {
              setMessage(
                "Authentication successful! Please close this tab and open the extension popup again.",
              );
              return;
            }

            const extensionId = process.env.NEXT_PUBLIC_EXTENSION_ID;

            if (!extensionId || extensionId === "your-extension-id") {
              setMessage(
                "Authentication successful! Please close this tab and open the extension popup again.",
              );
              console.warn(
                "Extension ID not configured. User will need to reload extension popup.",
              );
              return;
            }

            // Fetch username from users table
            const { data: userData } = await supabase
              .from("users")
              .select("username")
              .eq("id", session.user.id)
              .single();

            const username =
              userData?.username || session.user.email?.split("@")[0] || "User";

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

              // Post message to content scripts (fallback when direct messaging fails)
              let attempts = 0;
              const postAuthMessage = () => {
                window.postMessage(
                  {
                    type: "PRICEGIT_AUTH",
                    authToken: session.access_token,
                    refreshToken: session.refresh_token,
                    username: username,
                  },
                  "*",
                );
              };
              postAuthMessage();
              const interval = setInterval(() => {
                postAuthMessage();
                attempts += 1;
                if (attempts >= 5) clearInterval(interval);
              }, 1000);
            }

            // Send message to extension
            chrome.runtime.sendMessage(
              extensionId,
              {
                action: "setAuth",
                authToken: session.access_token,
                refreshToken: session.refresh_token,
                username: username,
              },
              (response: any) => {
                if (chrome.runtime.lastError) {
                  console.error(
                    "Error sending to extension:",
                    chrome.runtime.lastError,
                  );
                  setMessage(
                    "Authentication successful! You can now close this tab and return to the extension.",
                  );
                } else {
                  setMessage(
                    "Authentication successful! This tab will close in 2 seconds...",
                  );
                  setTimeout(() => {
                    window.close();
                  }, 2000);
                }
              },
            );
          } catch (error) {
            console.error("Error communicating with extension:", error);
            setMessage(
              "Authentication successful! You can now close this tab and return to the extension.",
            );
          }
        } else {
          // Regular web app flow - redirect to home
          window.location.href = "/";
        }
      } catch (error) {
        console.error("Callback error:", error);
        setMessage("An error occurred. Please try again.");
      }
    };

    handleCallback();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
        <p className="text-gray-700 text-lg">{message}</p>
      </div>
    </div>
  );
}
