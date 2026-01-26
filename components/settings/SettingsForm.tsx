"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import HeadphoneSettings from "./HeadphoneSettings";
import VoiceSettings from "./VoiceSettings";
import ThemeSettings from "./ThemeSettings";
import Button from "@/components/ui/Button";
import { useUser } from "@/contexts/UserContext";

interface Profile {
  id: string;
  display_name?: string;
  age?: number;
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
  const [age, setAge] = useState(currentProfile?.age?.toString() || "");
  const [weight, setWeight] = useState(currentProfile?.weight_lbs?.toString() || "");
  const [height, setHeight] = useState(currentProfile?.height_inches?.toString() || "");
  const [fitnessLevel, setFitnessLevel] = useState(
    currentProfile?.fitness_level || "intermediate"
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Update form when profile changes
  useEffect(() => {
    if (currentProfile) {
      setDisplayName(currentProfile.display_name || "");
      setAge(currentProfile.age?.toString() || "");
      setWeight(currentProfile.weight_lbs?.toString() || "");
      setHeight(currentProfile.height_inches?.toString() || "");
      setFitnessLevel(currentProfile.fitness_level || "intermediate");
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
        age: age ? parseInt(age) : null,
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
                Age
              </label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Fitness Level
            </label>
            <select
              value={fitnessLevel}
              onChange={(e) => setFitnessLevel(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
          <Button onClick={handleSave} disabled={saving} isLoading={saving}>
            {saved ? "Saved!" : "Save Profile"}
          </Button>
        </div>
      </div>

      <ThemeSettings />
      <VoiceSettings profile={currentProfile} />
      <HeadphoneSettings profile={currentProfile} />
    </div>
  );
}
