"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import HeadphoneList from "./HeadphoneList";
import VoiceSettings from "./VoiceSettings";
import ThemeSettings from "./ThemeSettings";
import PasswordSettings from "./PasswordSettings";
import WorkoutPreferences from "./WorkoutPreferences";
import Button from "@/components/ui/Button";
import { useUser } from "@/contexts/UserContext";
import FitnessLevelSelect from "./FitnessLevelSelect";

interface Profile {
  id: string;
  display_name?: string;
  birth_year?: number;
  weight_lbs?: number;
  height_inches?: number;
  fitness_level?: string;
  goals?: string[];
  equipment?: string[];
  preferred_workout_days?: number[];
  preferred_workout_duration?: number;
  preferred_focus_area?: string;
  workout_preferences_description?: string;
  preferences?: any;
}

export default function SettingsForm({ profile: initialProfile }: { profile: Profile | null }) {
  const { user, profile, refreshProfile, loading: userLoading } = useUser();
  const currentProfile = profile || initialProfile;
  
  const [displayName, setDisplayName] = useState(currentProfile?.display_name || "");
  const [birthYear, setBirthYear] = useState(currentProfile?.birth_year?.toString() || "");
  const [weight, setWeight] = useState(currentProfile?.weight_lbs?.toString() || "");
  const [height, setHeight] = useState(currentProfile?.height_inches?.toString() || "");
  const [fitnessLevel, setFitnessLevel] = useState(
    currentProfile?.fitness_level || "moderately_active"
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  // Update form when profile changes
  useEffect(() => {
    if (currentProfile) {
      setDisplayName(currentProfile.display_name || "");
      setBirthYear(currentProfile.birth_year?.toString() || "");
      setWeight(currentProfile.weight_lbs?.toString() || "");
      setHeight(currentProfile.height_inches?.toString() || "");
      setFitnessLevel(currentProfile.fitness_level || "moderately_active");
    }
  }, [currentProfile]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);

    // Get user ID from auth if profile doesn't have it
    const userId = currentProfile?.id || user?.id;
    
    if (!userId) {
      setError("No user found. Please log in again.");
      setSaving(false);
      return;
    }

    // Validate birth year if provided
    if (birthYear) {
      const year = parseInt(birthYear);
      if (isNaN(year) || year < 1900 || year > new Date().getFullYear()) {
        setError("Please enter a valid birth year.");
        setSaving(false);
        return;
      }
    }

    // Use upsert to handle both create and update cases
    const { error: updateError } = await supabase
      .from("user_profiles")
      .upsert({
        id: userId,
        display_name: displayName || null,
        birth_year: birthYear ? parseInt(birthYear) : null,
        weight_lbs: weight ? parseFloat(weight) : null,
        height_inches: height ? parseInt(height) : null,
        fitness_level: fitnessLevel,
      }, {
        onConflict: 'id'
      });

    if (updateError) {
      console.error("Error saving profile:", updateError);
      setError(updateError.message || "Failed to save profile. Please try again.");
      setSaving(false);
      return;
    }

    // Refresh profile from context
    await refreshProfile();

    setSaving(false);
    setSaved(true);
    setError(null);
    setTimeout(() => setSaved(false), 3000);
  };

  // Show loading state while user context is loading
  if (userLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Profile Information</h2>
        <div className="space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded">
              {error}
            </div>
          )}
          {saved && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded">
              Profile saved successfully!
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Birth Year
              </label>
              <input
                type="number"
                min="1900"
                max={new Date().getFullYear()}
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
                placeholder="e.g., 1990"
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Weight (lbs)
              </label>
              <input
                type="number"
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Height (inches)
              </label>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Fitness Level
            </label>
            <FitnessLevelSelect value={fitnessLevel} onChange={setFitnessLevel} />
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Select the option that best describes your current activity level. This helps us create appropriate workout plans for you.
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving} isLoading={saving}>
            {saved ? "Saved!" : "Save Profile"}
          </Button>
        </div>
      </div>

      <PasswordSettings />
      <WorkoutPreferences />
      <ThemeSettings />
      <VoiceSettings profile={currentProfile} />
      {(currentProfile?.id || user?.id) && (
        <HeadphoneList
          userId={currentProfile?.id || user?.id || ""}
          audioCuesEnabled={
            currentProfile?.preferences?.audio?.audio_cues_enabled !== false
          }
        />
      )}
    </div>
  );
}
