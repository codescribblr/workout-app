"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

interface UserProfile {
  id: string;
  display_name: string | null;
  birth_year: number | null;
  weight_lbs: number | null;
  height_inches: number | null;
  fitness_level: string | null;
  goals: string[] | null;
  equipment: string[] | null;
  preferred_workout_days: number[] | null;
  preferred_workout_duration: number | null;
  preferred_focus_area: string | null;
  workout_preferences_description: string | null;
  preferences: {
    audio?: {
      tts_provider?: string;
      voice_id?: string;
      speech_rate?: number;
      volume?: number;
      audio_cues_enabled?: boolean;
    };
    headphones?: {
      button_mappings?: Record<string, string>;
    };
    theme?: string;
  } | null;
}

interface UserContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []); // Stable client instance
  const fetchingRef = useRef(false);

  const fetchUser = useCallback(async () => {
    // Prevent concurrent fetches
    if (fetchingRef.current) return;
    
    fetchingRef.current = true;

    try {
      const {
        data: { user: authUser },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error("Error fetching user:", userError);
        setUser(null);
        setProfile(null);
        setLoading(false);
        fetchingRef.current = false;
        return;
      }

      setUser(authUser);

      if (authUser) {
        // Fetch profile
        const { data: profileData, error: profileError } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("id", authUser.id)
          .maybeSingle();

        if (profileError && profileError.code !== "PGRST116") {
          console.error("Error fetching profile:", profileError);
        }

        setProfile(profileData || null);
      } else {
        setProfile(null);
      }
    } catch (error) {
      console.error("Error in fetchUser:", error);
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;

    try {
      const { data: profileData, error: profileError } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError && profileError.code !== "PGRST116") {
        console.error("Error refreshing profile:", profileError);
        return;
      }

      setProfile(profileData || null);
    } catch (error) {
      console.error("Error in refreshProfile:", error);
    }
  }, [user, supabase]);

  const refreshUser = useCallback(async () => {
    await fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    fetchUser();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        fetchUser();
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        setProfile(null);
        fetchingRef.current = false;
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUser]);

  return (
    <UserContext.Provider
      value={{
        user,
        profile,
        loading,
        refreshProfile,
        refreshUser,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
