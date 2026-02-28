"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const { user, loading, userProfile, updateUserProfile } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [originalUsername, setOriginalUsername] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(
    null,
  );
  const [email, setEmail] = useState("");
  const [originalEmail, setOriginalEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [originalCountry, setOriginalCountry] = useState("");
  const [originalCity, setOriginalCity] = useState("");
  const [locationSearch, setLocationSearch] = useState("");
  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const locationDropdownRef = useRef<HTMLDivElement>(null);
  const isInitialLocationLoad = useRef(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Initialize form fields from userProfile (from context)
  useEffect(() => {
    if (userProfile) {
      setUsername(userProfile.username || "");
      setOriginalUsername(userProfile.username || "");
      setEmail(userProfile.email || "");
      setOriginalEmail(userProfile.email || "");
      setCountry(userProfile.country || "");
      setOriginalCountry(userProfile.country || "");
      setCity(userProfile.city || "");
      setOriginalCity(userProfile.city || "");

      // Set location search display
      if (userProfile.city && userProfile.country) {
        setLocationSearch(`${userProfile.city}, ${userProfile.country}`);
      } else if (userProfile.country) {
        setLocationSearch(userProfile.country);
      } else if (userProfile.city) {
        setLocationSearch(userProfile.city);
      }
    } else if (user?.email) {
      // Fallback to auth email if no profile yet
      setEmail(user.email);
      setOriginalEmail(user.email);
    }
  }, [userProfile, user]);

  // Live username validation
  useEffect(() => {
    const validateUsername = (name: string) => {
      if (name.length === 0) {
        setUsernameError(null);
        setUsernameAvailable(null);
        setUsernameChecking(false);
        return false;
      }

      if (name.length < 3) {
        setUsernameError("Username must be at least 3 characters");
        setUsernameAvailable(false);
        setUsernameChecking(false);
        return false;
      }

      if (name.length > 20) {
        setUsernameError("Username must be less than 20 characters");
        setUsernameAvailable(false);
        setUsernameChecking(false);
        return false;
      }

      const usernameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
      if (!usernameRegex.test(name)) {
        setUsernameError(
          "Username may only contain alphanumeric characters or single hyphens, and cannot begin or end with a hyphen",
        );
        setUsernameAvailable(false);
        setUsernameChecking(false);
        return false;
      }

      setUsernameError(null);
      return true;
    };

    const checkAvailability = async () => {
      // Don't check if it's the same as the original username
      if (username === originalUsername) {
        setUsernameAvailable(null);
        setUsernameChecking(false);
        return;
      }

      const isValid = validateUsername(username);
      if (!isValid) {
        return;
      }

      setUsernameChecking(true);

      try {
        const { data, error } = await supabase
          .from("users")
          .select("username")
          .eq("username", username)
          .single();

        if (error && error.code === "PGRST116") {
          // No rows returned - username is available
          setUsernameAvailable(true);
        } else if (data) {
          // Username exists
          setUsernameAvailable(false);
          setUsernameError("Username is already taken");
        }
      } catch (err) {
        console.error("Error checking username:", err);
      } finally {
        setUsernameChecking(false);
      }
    };

    // Validate immediately
    if (username === originalUsername) {
      setUsernameAvailable(null);
      setUsernameChecking(false);
      setUsernameError(null);
      return;
    }

    const isValid = validateUsername(username);

    if (isValid && username !== originalUsername) {
      const debounce = setTimeout(checkAvailability, 500);
      return () => {
        clearTimeout(debounce);
        setUsernameChecking(false);
      };
    }
  }, [username, originalUsername]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    // Check if anything changed
    if (
      username === originalUsername &&
      country === originalCountry &&
      city === originalCity
    ) {
      setMessage("No changes to save");
      return;
    }

    // Validate username if it changed
    if (
      username !== originalUsername &&
      (usernameError || !usernameAvailable)
    ) {
      setError("Please fix the errors before saving");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const updates: any = {};

      if (username !== originalUsername) {
        updates.username = username;
      }

      if (country !== originalCountry) {
        updates.country = country;
      }

      if (city !== originalCity) {
        updates.city = city;
      }

      const { error: updateError } = await supabase
        .from("users")
        .update(updates)
        .eq("id", user.id);

      if (updateError) {
        setError(updateError.message);
      } else {
        setMessage("Settings updated successfully!");
        setOriginalUsername(username);
        setOriginalCountry(country);
        setOriginalCity(city);
        setUsernameAvailable(null);

        // Update context so changes reflect everywhere immediately
        updateUserProfile({
          username,
          country,
          city,
        });
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setSaving(false);
    }
  };

  // Search locations with debounce
  useEffect(() => {
    // Don't search on initial load when locationSearch is set from database
    if (isInitialLocationLoad.current && locationSearch.length > 0) {
      isInitialLocationLoad.current = false;
      return;
    }

    const searchLocations = async () => {
      if (locationSearch.trim().length < 2) {
        setLocationSuggestions([]);
        setShowLocationDropdown(false);
        return;
      }

      setLocationLoading(true);
      try {
        const response = await fetch(
          `/api/geocode?q=${encodeURIComponent(locationSearch)}`,
        );
        const data = await response.json();

        if (data.features) {
          setLocationSuggestions(data.features);
          setShowLocationDropdown(true);
        }
      } catch (err) {
        console.error("Error searching locations:", err);
      } finally {
        setLocationLoading(false);
      }
    };

    const debounce = setTimeout(searchLocations, 300);
    return () => clearTimeout(debounce);
  }, [locationSearch]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        locationDropdownRef.current &&
        !locationDropdownRef.current.contains(event.target as Node)
      ) {
        setShowLocationDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectLocation = (location: any) => {
    // Extract city and country from Mapbox place_name
    const placeName = location.place_name;
    setLocationSearch(placeName);

    // Parse the location context to get city and country
    const context = location.context || [];
    let selectedCity = "";
    let selectedCountry = "";

    // The place itself might be the city
    if (
      location.place_type.includes("place") ||
      location.place_type.includes("locality")
    ) {
      selectedCity = location.text;
    }

    // Find country from context
    const countryContext = context.find((c: any) => c.id.startsWith("country"));
    if (countryContext) {
      selectedCountry = countryContext.text;
    }

    setCity(selectedCity);
    setCountry(selectedCountry);
    setLocationSuggestions([]);
    setShowLocationDropdown(false);
  };

  const detectLocation = async () => {
    setLocationLoading(true);
    try {
      const response = await fetch("https://ipapi.co/json/");
      const data = await response.json();

      if (data.country_name && data.city) {
        setCountry(data.country_name);
        setCity(data.city);
        setLocationSearch(`${data.city}, ${data.country_name}`);
      } else if (data.country_name) {
        setCountry(data.country_name);
        setLocationSearch(data.country_name);
      }
    } catch (err) {
      console.error("Error detecting location:", err);
    } finally {
      setLocationLoading(false);
    }
  };

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    // Check if email changed
    if (email === originalEmail) {
      setEmailMessage("No changes to save");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError("Please enter a valid email address");
      return;
    }

    setEmailSaving(true);
    setEmailError(null);
    setEmailMessage(null);

    try {
      // Supabase will send a verification email to the new address
      const { error: updateError } = await supabase.auth.updateUser({
        email: email,
      });

      if (updateError) {
        setEmailError(updateError.message);
      } else {
        setEmailMessage(
          "Verification email sent! Please check your inbox and click the confirmation link.",
        );
        // Update original email to prevent re-saving
        setOriginalEmail(email);
        // Update context with new email
        updateUserProfile({ email });
      }
    } catch (err) {
      setEmailError("An unexpected error occurred");
    } finally {
      setEmailSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!user) return;

    // Validate passwords
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("All fields are required");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters");
      return;
    }

    setPasswordSaving(true);
    setPasswordError(null);
    setPasswordMessage(null);

    try {
      // Update password in Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setPasswordError(updateError.message);
      } else {
        setPasswordMessage("Password updated successfully!");
        // Clear password fields
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err) {
      setPasswordError("An unexpected error occurred");
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;

    if (deleteConfirmText !== username) {
      return;
    }

    setDeleting(true);

    try {
      const DELETED_USER_ID = "2aa84278-6af7-496c-ba5a-d1eefc3b0388";

      // Reassign all price history entries to deleted-user
      const { error: reassignError } = await supabase
        .from("price_history")
        .update({ submitted_by: DELETED_USER_ID })
        .eq("submitted_by", user.id);

      if (reassignError) {
        console.error("Error reassigning price history:", reassignError);
        setError("Failed to reassign your price entries. Please try again.");
        setDeleting(false);
        return;
      }

      // Delete from users table
      const { error: dbError } = await supabase
        .from("users")
        .delete()
        .eq("id", user.id);

      if (dbError) {
        console.error("Error deleting user from database:", dbError);
        setError("Failed to delete account. Please try again.");
        setDeleting(false);
        return;
      }

      // Sign out (this will also delete from auth in the background)
      await supabase.auth.signOut();

      // Clear extension auth from localStorage
      if (typeof window !== "undefined") {
        localStorage.removeItem("priceGitExtensionAuth");
      }

      // Redirect to home page
      window.location.href = "/";
    } catch (err) {
      console.error("Error deleting account:", err);
      setError("An unexpected error occurred");
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white">
      <main className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">
          Account Settings
        </h1>

        <form onSubmit={handleSave} className="space-y-3">
          {/* Email Section */}
          <div className="bg-white p-3">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-900 mb-1"
            >
              Edit Email
            </label>
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError(null);
                    setEmailMessage(null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500 text-sm"
                  placeholder="your@email.com"
                />
                {emailError && (
                  <p className="mt-1 text-xs text-red-600">{emailError}</p>
                )}
                {emailMessage && (
                  <p className="mt-1 text-xs text-blue-600">{emailMessage}</p>
                )}
                {email !== originalEmail && !emailError && !emailMessage && (
                  <p className="mt-1 text-xs text-gray-600">
                    You&apos;ll need to verify your new email address
                  </p>
                )}
              </div>
              <button
                onClick={handleEmailChange}
                disabled={emailSaving || email === originalEmail}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-sm h-fit"
              >
                {emailSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>

          {/* Username Section */}
          <div className="bg-white p-3">
            <label
              htmlFor="username"
              className="block text-sm font-medium text-gray-900 mb-1"
            >
              Edit Username
            </label>
            <div className="flex gap-2">
              <div className="flex-1">
                <div className="relative">
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className={`w-full px-3 py-2 pr-10 border ${
                      usernameError
                        ? "border-red-300"
                        : usernameAvailable
                          ? "border-green-300"
                          : "border-gray-300"
                    } rounded-md focus:outline-none focus:border-blue-500 text-sm`}
                    placeholder={originalUsername || "Choose a username"}
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    {usernameChecking && (
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
                    {!usernameChecking && usernameAvailable && (
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
                    {!usernameChecking &&
                      usernameAvailable === false &&
                      username !== originalUsername &&
                      username.length > 0 && (
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
                {usernameError && (
                  <p className="mt-1.5 text-xs text-red-600">{usernameError}</p>
                )}
                {!usernameError &&
                  usernameAvailable &&
                  username !== originalUsername && (
                    <p className="mt-1.5 text-xs text-green-600">
                      Username is available!
                    </p>
                  )}
                {!usernameError &&
                  !usernameAvailable &&
                  username.length === 0 && (
                    <p className="mt-1.5 text-xs text-gray-600">
                      Username may only contain alphanumeric characters or
                      single hyphens, and cannot begin or end with a hyphen.
                    </p>
                  )}
              </div>
              <button
                onClick={handleSave}
                disabled={
                  saving ||
                  username === originalUsername ||
                  !!usernameError ||
                  (!usernameAvailable && username !== originalUsername)
                }
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-sm h-fit"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>

          {/* Location Section */}
          <div className="bg-white p-3">
            <div className="space-y-2">
              <div ref={locationDropdownRef} className="relative">
                <label
                  htmlFor="location"
                  className="block text-sm font-medium text-gray-900 mb-1"
                >
                  Edit Default Location
                </label>
                <p className="text-sm text-gray-700 mb-2">
                  {originalCity || originalCountry ? (
                    <>
                      We have your address as:{" "}
                      <span className="font-medium">
                        {originalCity && originalCountry
                          ? `${originalCity}, ${originalCountry}`
                          : originalCountry || originalCity}
                      </span>
                    </>
                  ) : (
                    <span className="text-gray-500">No location set yet</span>
                  )}
                </p>
                <div className="relative">
                  <input
                    id="location"
                    type="text"
                    value={locationSearch}
                    onChange={(e) => setLocationSearch(e.target.value)}
                    onFocus={() => {
                      if (locationSuggestions.length > 0) {
                        setShowLocationDropdown(true);
                      }
                    }}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500 text-sm"
                    placeholder="Search for a city or location..."
                  />
                  {locationLoading && (
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3">
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
                    </div>
                  )}
                </div>

                {/* Dropdown suggestions */}
                {showLocationDropdown && locationSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {locationSuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => selectLocation(suggestion)}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                      >
                        <div className="font-medium text-gray-900">
                          {suggestion.text}
                        </div>
                        <div className="text-xs text-gray-600">
                          {suggestion.place_name}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                <p className="mt-1 text-xs text-gray-600">
                  Type to search for your city or location
                </p>
              </div>

              <div className="flex gap-2 items-center">
                <button
                  type="button"
                  onClick={detectLocation}
                  disabled={locationLoading}
                  className="text-sm text-blue-600 hover:text-blue-700 disabled:text-gray-400 cursor-pointer disabled:cursor-not-allowed"
                >
                  {locationLoading
                    ? "Detecting..."
                    : "📍 Auto-detect my location"}
                </button>
                <button
                  onClick={handleSave}
                  disabled={
                    saving ||
                    (city === originalCity && country === originalCountry)
                  }
                  className="ml-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-sm"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>

          {/* Password Section */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h2 className="text-base font-semibold text-gray-900 mb-3">
              Change Password
            </h2>
            <div className="space-y-2">
              <div>
                <label
                  htmlFor="currentPassword"
                  className="block text-sm font-medium text-gray-900 mb-1"
                >
                  Current Password
                </label>
                <input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    setPasswordError(null);
                    setPasswordMessage(null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500 text-sm"
                  placeholder="Enter current password"
                />
              </div>

              <div>
                <label
                  htmlFor="newPassword"
                  className="block text-sm font-medium text-gray-900 mb-1"
                >
                  New Password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setPasswordError(null);
                    setPasswordMessage(null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500 text-sm"
                  placeholder="Enter new password"
                />
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-gray-900 mb-1"
                >
                  Confirm New Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setPasswordError(null);
                    setPasswordMessage(null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500 text-sm"
                  placeholder="Confirm new password"
                />
              </div>

              {passwordError && (
                <p className="text-xs text-red-600">{passwordError}</p>
              )}
              {passwordMessage && (
                <p className="text-xs text-green-600">{passwordMessage}</p>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handlePasswordChange}
                  disabled={
                    passwordSaving ||
                    !currentPassword ||
                    !newPassword ||
                    !confirmPassword
                  }
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-sm"
                >
                  {passwordSaving ? "Updating..." : "Update Password"}
                </button>
              </div>
            </div>
          </div>

          {/* Delete Account Section */}
          <div className="bg-white border border-red-200 rounded-lg p-4">
            <h2 className="text-base font-semibold text-red-600 mb-3">
              Danger Zone
            </h2>
            <div className="space-y-2">
              <p className="text-sm text-gray-700">
                Once you delete your account, there is no going back. Your
                account will be permanently removed.
              </p>
              <p className="text-sm text-gray-600">
                Note: Price entries you&apos;ve submitted will be reassigned to
                a deleted-user account to preserve historical pricing data.
              </p>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium text-sm"
              >
                Delete Account
              </button>
            </div>
          </div>

          {/* Messages */}
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
        </form>
      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Delete Account
            </h3>
            <p className="text-sm text-gray-700 mb-4">
              This action cannot be undone. This will permanently delete your
              account and remove your data from our servers.
            </p>
            <p className="text-sm text-gray-600 mb-4">
              Your price submissions will be reassigned to
              &quot;deleted-user&quot; to preserve historical pricing data for
              the community.
            </p>
            <p className="text-sm text-gray-700 mb-4">
              Please type <span className="font-semibold">{username}</span> to
              confirm.
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-red-500 text-sm mb-6"
              placeholder="Type your username to confirm"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText("");
                }}
                disabled={deleting}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors font-medium text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting || deleteConfirmText !== username}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-sm"
              >
                {deleting ? "Deleting..." : "Delete Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
