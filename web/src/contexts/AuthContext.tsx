"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User, AuthError, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface UserProfile {
  username: string;
  email: string;
  country: string | null;
  city: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userProfile: UserProfile | null;
  loading: boolean; // Only for initial auth check, not profile
  signUp: (
    email: string,
    password: string
  ) => Promise<{ error: AuthError | null }>;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  updateUserProfile: (updates: Partial<UserProfile>) => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper function to generate random username
function generateRandomUsername(): string {
  const adjectives = [
    "swift", "calm", "bold", "wise", "kind", "brave", "quiet", "happy",
    "cool", "warm", "bright", "dark", "light", "quick", "slow", "wild",
    "tame", "fierce", "gentle", "noble",
  ];
  const nouns = [
    "eagle", "raven", "wolf", "bear", "lion", "tiger", "fox", "owl",
    "hawk", "deer", "panda", "koala", "otter", "seal", "whale", "dragon",
    "phoenix", "griffin", "unicorn", "pegasus",
  ];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj}-${noun}`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user profile - non-blocking, fire and forget errors
  const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("username, email, country, city")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("Error fetching user profile:", error);
        return null;
      }

      return data as UserProfile;
    } catch (err) {
      console.error("Error in fetchUserProfile:", err);
      return null;
    }
  };

  // Ensure user profile exists - non-blocking
  const ensureUserProfile = async (userId: string, email: string) => {
    try {
      // Check if profile exists
      const { data: existingProfile } = await supabase
        .from("users")
        .select("id")
        .eq("id", userId)
        .single();

      if (!existingProfile) {
        // Get username from metadata or generate new one
        const { data: { user } } = await supabase.auth.getUser();
        const username = user?.user_metadata?.username || generateRandomUsername();

        // Create profile
        const { error: insertError } = await supabase
          .from("users")
          .insert({ id: userId, email, username });

        if (insertError && insertError.code !== "23505") {
          console.error("Error creating profile:", insertError);
        }
      }
    } catch (err) {
      console.error("Error ensuring user profile:", err);
    }
  };

  // Refresh profile - can be called manually
  const refreshProfile = async () => {
    if (user) {
      const profile = await fetchUserProfile(user.id);
      setUserProfile(profile);
    }
  };

  // Update user profile in context
  const updateUserProfile = (updates: Partial<UserProfile>) => {
    if (userProfile) {
      setUserProfile({ ...userProfile, ...updates });
    }
  };

  useEffect(() => {
    let mounted = true;

    // Get initial session - this is fast
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;

      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false); // Auth check done - set loading false IMMEDIATELY

      // Fetch profile in background - don't block
      if (session?.user) {
        // Fire and forget - don't await
        ensureUserProfile(session.user.id, session.user.email!).then(() => {
          if (!mounted) return;
          fetchUserProfile(session.user.id).then((profile) => {
            if (mounted) setUserProfile(profile);
          });
        });
      }
    }).catch((error) => {
      console.error("Error getting initial session:", error);
      if (mounted) setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;

        // Update session and user immediately - don't wait for profile
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Fetch profile in background - don't block auth state
          ensureUserProfile(session.user.id, session.user.email!).then(() => {
            if (!mounted) return;
            fetchUserProfile(session.user.id).then((profile) => {
              if (mounted) setUserProfile(profile);
            });
          });
        } else {
          setUserProfile(null);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string) => {
    const randomUsername = generateRandomUsername();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/`,
        data: { username: randomUsername },
      },
    });

    // Check if user already exists
    if (data?.user && data.user.identities && data.user.identities.length === 0) {
      return {
        error: {
          message: "An account with this email already exists. Please sign in instead.",
        } as AuthError,
      };
    }

    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });
    return { error };
  };

  const value = {
    user,
    session,
    userProfile,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updateUserProfile,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
