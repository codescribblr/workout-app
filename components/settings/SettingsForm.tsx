"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import HeadphoneList from "./HeadphoneList";
import VoiceSettings from "./VoiceSettings";
import ThemeSettings from "./ThemeSettings";
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
  preferences?: any;
}

export default function SettingsForm({ profile: initialProfile }: { profile: Profile | null }) {
  const { profile, refreshProfile } = useUser();
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

    if (!currentProfile?.id) {
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("user_profiles")
      .upsert({
        id: currentProfile.id,
        display_name: displayName,
        birth_year: birthYear ? parseInt(birthYear) : null,
        weight_lbs: weight ? parseFloat(weight) : null,
        height_inches: height ? parseInt(height) : null,
        fitness_level: fitnessLevel,
      });

    if (error) {
      console.error("Error saving profile:", error);
      setSaving(false);
      return;
    }

    // Refresh profile from context
    await refreshProfile();

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Profile Information</h2>
        <div className="space-y-4">
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

      <ThemeSettings />
      <VoiceSettings profile={currentProfile} />
      {currentProfile?.id && (
        <HeadphoneList
          userId={currentProfile.id}
          audioCuesEnabled={
            currentProfile?.preferences?.audio?.audio_cues_enabled !== false
          }
        />
      )}
    </div>
  );
}
