"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import { useUser } from "@/contexts/UserContext";

const DEFAULT_GOALS = [
  "Build muscle mass",
  "Lose weight / burn fat",
  "Increase strength",
  "Improve cardiovascular fitness",
  "Increase flexibility and mobility",
  "Improve athletic performance",
  "General health and wellness",
];

const DAYS_OF_WEEK = [
  { value: 0, label: "S", fullName: "Sunday" },
  { value: 1, label: "M", fullName: "Monday" },
  { value: 2, label: "T", fullName: "Tuesday" },
  { value: 3, label: "W", fullName: "Wednesday" },
  { value: 4, label: "T", fullName: "Thursday" },
  { value: 5, label: "F", fullName: "Friday" },
  { value: 6, label: "S", fullName: "Saturday" },
];

const EQUIPMENT_OPTIONS = [
  { value: "bodyweight", label: "Bodyweight Only" },
  { value: "dumbbells", label: "Dumbbells" },
  { value: "barbell", label: "Barbell" },
  { value: "bench", label: "Bench" },
  { value: "pull-up bar", label: "Pull-up Bar" },
  { value: "cable machine", label: "Cable Machine" },
  { value: "leg press machine", label: "Leg Press Machine" },
  { value: "free-weight machines", label: "Free-weight Machines" },
  { value: "pulley machines", label: "Pulley Machines" },
  { value: "kettlebells", label: "Kettlebells" },
  { value: "resistance bands", label: "Resistance Bands" },
  { value: "medicine ball", label: "Medicine Ball" },
  { value: "stationary bike", label: "Stationary Bike" },
  { value: "treadmill", label: "Treadmill" },
  { value: "rower", label: "Rowing Machine" },
];

const FOCUS_AREAS = [
  { value: "full body", label: "Full Body" },
  { value: "upper body", label: "Upper Body" },
  { value: "lower body", label: "Lower Body" },
  { value: "chest", label: "Chest" },
  { value: "back", label: "Back" },
  { value: "legs", label: "Legs" },
  { value: "shoulders", label: "Shoulders" },
  { value: "arms", label: "Arms" },
  { value: "cardio", label: "Cardio" },
];

export default function WorkoutPreferences() {
  const { profile, refreshProfile, user, loading: userLoading } = useUser();
  const supabase = createClient();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [goals, setGoals] = useState<string[]>(DEFAULT_GOALS);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [duration, setDuration] = useState(60);
  const [focusArea, setFocusArea] = useState("full body");
  const [description, setDescription] = useState("");
  const [draggedGoalIndex, setDraggedGoalIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load from profile
  useEffect(() => {
    if (userLoading) return; // Wait for user context to load
    
    if (profile) {
      if (profile.goals && profile.goals.length > 0) {
        // Merge profile goals with defaults, preserving order
        const profileGoals = profile.goals;
        const defaultGoalsNotInProfile = DEFAULT_GOALS.filter(
          (g) => !profileGoals.includes(g)
        );
        setGoals([...profileGoals, ...defaultGoalsNotInProfile]);
      }
      if (profile.equipment) {
        setEquipment(profile.equipment);
      }
      if (profile.preferred_workout_days) {
        setSelectedDays(profile.preferred_workout_days);
      }
      if (profile.preferred_workout_duration) {
        setDuration(profile.preferred_workout_duration);
      }
      if (profile.preferred_focus_area) {
        setFocusArea(profile.preferred_focus_area);
      }
      if (profile.workout_preferences_description) {
        setDescription(profile.workout_preferences_description);
      }
    }
  }, [profile, userLoading]);

  const handleDragStart = (index: number) => {
    setDraggedGoalIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedGoalIndex === null || draggedGoalIndex === dropIndex) {
      setDraggedGoalIndex(null);
      return;
    }

    const newGoals = [...goals];
    const draggedGoal = newGoals[draggedGoalIndex];

    newGoals.splice(draggedGoalIndex, 1);
    newGoals.splice(dropIndex, 0, draggedGoal);

    setGoals(newGoals);
    setDraggedGoalIndex(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);

    const userId = profile?.id || user?.id;
    if (!userId) {
      setError("No user found. Please log in again.");
      setSaving(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("user_profiles")
      .upsert(
        {
          id: userId,
          goals: goals.filter((g) => DEFAULT_GOALS.includes(g)), // Only save valid goals
          equipment: equipment.length > 0 ? equipment : null,
          preferred_workout_days:
            selectedDays.length > 0 ? selectedDays : null,
          preferred_workout_duration: duration || null,
          preferred_focus_area: focusArea || null,
          workout_preferences_description: description || null,
        },
        {
          onConflict: "id",
        }
      );

    if (updateError) {
      console.error("Error saving workout preferences:", updateError);
      setError(updateError.message || "Failed to save preferences. Please try again.");
      setSaving(false);
      return;
    }

    await refreshProfile();
    setSaving(false);
    setSaved(true);
    setError(null);
    setTimeout(() => setSaved(false), 3000);
  };

  // Show loading state while mounting or user context is loading
  if (!mounted || userLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Workout Preferences
        </h2>
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading preferences...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        Workout Preferences
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        These preferences will be used when generating AI workout plans. You can also set them in the AI Plan Generator.
      </p>

      <div className="space-y-6">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded">
            {error}
          </div>
        )}
        {saved && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded">
            Workout preferences saved successfully!
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Goals (drag to reorder by priority)
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Put these in order of your priority for your exercise plan
          </p>
          <div className="space-y-2 border rounded-md p-3 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700">
            {goals.map((goal, index) => (
              <div
                key={goal}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
                className={`
                  flex items-center gap-3 p-3 rounded-md cursor-move transition-opacity
                  bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                  ${draggedGoalIndex === index ? "opacity-50" : "opacity-100"}
                  hover:bg-gray-100 dark:hover:bg-gray-700
                `}
              >
                <div className="flex-shrink-0 text-gray-400 dark:text-gray-500">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 8h16M4 16h16"
                    />
                  </svg>
                </div>
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 flex items-center justify-center text-xs font-semibold">
                  {index + 1}
                </div>
                <span className="flex-1 text-sm text-gray-900 dark:text-white">
                  {goal}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Preferred Workout Days
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Select which days you typically want to work out
          </p>
          <div className="flex gap-4 justify-center border rounded-md p-4 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700">
            {DAYS_OF_WEEK.map((day) => (
              <label
                key={day.value}
                className="flex flex-col items-center gap-2 cursor-pointer px-2 py-2 hover:bg-gray-50 dark:hover:bg-gray-600 rounded transition-colors"
              >
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {day.label}
                </span>
                <input
                  type="checkbox"
                  checked={selectedDays.includes(day.value)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedDays([...selectedDays, day.value].sort());
                    } else {
                      setSelectedDays(
                        selectedDays.filter((d) => d !== day.value)
                      );
                    }
                  }}
                  className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 bg-white dark:bg-gray-700"
                />
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Preferred Duration (minutes)
            </label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value) || 60)}
              min="15"
              max="180"
              className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2 border bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Preferred Focus Area
            </label>
            <select
              value={focusArea}
              onChange={(e) => setFocusArea(e.target.value)}
              className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2 border bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {FOCUS_AREAS.map((area) => (
                <option key={area.value} value={area.value}>
                  {area.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Available Equipment (select all that apply)
          </label>
          <div className="border rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 overflow-hidden">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-3">
              {EQUIPMENT_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 p-2 rounded"
                >
                  <input
                    type="checkbox"
                    checked={equipment.includes(option.value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setEquipment([...equipment, option.value]);
                      } else {
                        setEquipment(
                          equipment.filter((eq) => eq !== option.value)
                        );
                      }
                    }}
                    className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 bg-white dark:bg-gray-700"
                  />
                  <span className="text-sm text-gray-900 dark:text-white">
                    {option.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Additional Preferences
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Include any injuries, exercise preferences, or other relevant details
          </p>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2 border bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
            rows={4}
            placeholder="e.g., Avoid exercises that put pressure on lower back. Include pull-ups and bench press. Exclude deadlifts."
          />
        </div>

        <Button onClick={handleSave} disabled={saving} isLoading={saving}>
          {saved ? "Saved!" : "Save Preferences"}
        </Button>
      </div>
    </div>
  );
}
