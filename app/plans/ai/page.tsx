"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import { useUser } from "@/contexts/UserContext";
import ButtonLink from "@/components/ui/ButtonLink";

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

export default function AIGeneratePlanPage() {
  const { profile, loading: profileLoading, refreshProfile } = useUser();
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(60);
  const [focusArea, setFocusArea] = useState("full body");
  const [equipment, setEquipment] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>(DEFAULT_GOALS);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [draggedGoalIndex, setDraggedGoalIndex] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatedPlans, setGeneratedPlans] = useState<any[]>([]);
  const [showProfilePrompt, setShowProfilePrompt] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Load workout preferences from profile
  useEffect(() => {
    if (!profileLoading && profile) {
      // Load goals
      if (profile.goals && profile.goals.length > 0) {
        const profileGoals = profile.goals;
        const defaultGoalsNotInProfile = DEFAULT_GOALS.filter(
          (g) => !profileGoals.includes(g)
        );
        setGoals([...profileGoals, ...defaultGoalsNotInProfile]);
      }

      // Load equipment
      if (profile.equipment && profile.equipment.length > 0) {
        setEquipment(profile.equipment);
      }

      // Load preferred workout days
      if (profile.preferred_workout_days && profile.preferred_workout_days.length > 0) {
        setSelectedDays(profile.preferred_workout_days);
      }

      // Load duration
      if (profile.preferred_workout_duration) {
        setDuration(profile.preferred_workout_duration);
      }

      // Load focus area
      if (profile.preferred_focus_area) {
        setFocusArea(profile.preferred_focus_area);
      }

      // Load description
      if (profile.workout_preferences_description) {
        setDescription(profile.workout_preferences_description);
      }

      // Check if profile is complete
      const isComplete = 
        profile.birth_year !== null && 
        profile.birth_year !== undefined &&
        profile.weight_lbs !== null && 
        profile.weight_lbs !== undefined &&
        profile.height_inches !== null && 
        profile.height_inches !== undefined &&
        profile.fitness_level !== null && 
        profile.fitness_level !== undefined;
      
      setShowProfilePrompt(!isComplete);
    }
  }, [profile, profileLoading]);

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
    
    // Remove dragged goal
    newGoals.splice(draggedGoalIndex, 1);
    
    // Insert at new position
    newGoals.splice(dropIndex, 0, draggedGoal);
    
    setGoals(newGoals);
    setDraggedGoalIndex(null);
  };

  // Save preferences to profile
  const savePreferencesToProfile = async () => {
    if (!profile?.id) return;

    try {
      await supabase
        .from("user_profiles")
        .upsert(
          {
            id: profile.id,
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
      
      await refreshProfile();
    } catch (error) {
      console.error("Error saving preferences to profile:", error);
      // Don't block plan generation if saving preferences fails
    }
  };

  const handleGenerate = async () => {
    if (selectedDays.length === 0) {
      alert("Please select at least one workout day");
      return;
    }

    // Save preferences to profile before generating
    await savePreferencesToProfile();

    setGenerating(true);

    try {
      const response = await fetch("/api/ai/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          description,
          duration, 
          focusArea: selectedDays.length > 1 ? "full body" : focusArea, 
          equipment,
          goals,
          days: selectedDays,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate plan");
      }

      const plans = await response.json();
      // Handle both single plan and array of plans
      setGeneratedPlans(Array.isArray(plans) ? plans : [plans]);
    } catch (error) {
      console.error("Error generating plan:", error);
      alert("Failed to generate workout plan. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!generatedPlans || generatedPlans.length === 0) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    try {
      // Collect all exercise names from all plans
      const allExerciseNames = new Set<string>();
      generatedPlans.forEach((plan: any) => {
        plan.exercises?.forEach((e: any) => {
          if (e.name) allExerciseNames.add(e.name);
        });
      });

      // Get exercise IDs by name
      const { data: exercises } = await supabase
        .from("exercises")
        .select("id, name")
        .in("name", Array.from(allExerciseNames));

      const exerciseMap = new Map(exercises?.map((e) => [e.name, e.id]) || []);

      // Create all workout plans
      const savedPlanIds: string[] = [];
      
      for (const plan of generatedPlans) {
        const { data: savedPlan, error: planError } = await supabase
          .from("workout_plans")
          .insert({
            name: plan.name,
            description: plan.description,
            user_id: user.id,
            is_ai_generated: true,
            recommended_day_of_week: plan.day_of_week,
            ai_prompt: `${description ? `${description}\n\n` : ""}Goals: ${goals.join(", ")}`,
          })
          .select()
          .single();

        if (planError || !savedPlan) {
          console.error("Error creating plan:", planError);
          continue;
        }

        savedPlanIds.push(savedPlan.id);

        // Add exercises
        const planExercises = plan.exercises
          ?.map((e: any, idx: number) => {
            const exerciseId = exerciseMap.get(e.name);
            if (!exerciseId) return null;
            return {
              workout_plan_id: savedPlan.id,
              exercise_id: exerciseId,
              order_index: idx,
              sets: e.sets || 1,
              reps_min: e.reps_min,
              reps_max: e.reps_max,
              weight_lbs: e.weight_lbs,
              rest_seconds: e.rest_seconds || 60,
              is_warmup: e.is_warmup || false,
              is_cooldown: e.is_cooldown || false,
            };
          })
          .filter((e: any) => e !== null) || [];

        if (planExercises.length > 0) {
          await supabase.from("workout_plan_exercises").insert(planExercises);
        }
      }

      // Redirect to plans page if multiple plans saved, or to first plan if single
      if (savedPlanIds.length > 0) {
        router.push("/plans");
      }
    } catch (error) {
      console.error("Error saving plans:", error);
      alert("Failed to save workout plans. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <nav className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/plans" className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                ← Back
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
            AI Workout Plan Generator
          </h1>

          {showProfilePrompt && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                    Complete Your Profile for Better Plans
                  </h3>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
                    To generate workout plans tailored to your needs, please complete your profile with your birth year, height, weight, and fitness level. This helps the AI create safe and effective workouts appropriate for you.
                  </p>
                  <div className="flex items-center gap-2">
                    <ButtonLink
                      href="/settings"
                      variant="primary"
                      className="text-sm"
                    >
                      Complete Profile
                    </ButtonLink>
                    <button
                      onClick={() => setShowProfilePrompt(false)}
                      className="text-sm text-yellow-700 dark:text-yellow-300 hover:text-yellow-900 dark:hover:text-yellow-100 underline"
                    >
                      Skip for now
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => setShowProfilePrompt(false)}
                  className="ml-4 text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-200"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {generatedPlans.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 space-y-6">
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
                  Workout Days
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Select which days you want to work out. If you select multiple days, the AI will create a separate plan for each day.
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
                            setSelectedDays(selectedDays.filter((d) => d !== day.value));
                          }
                        }}
                        className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 bg-white dark:bg-gray-700"
                      />
                    </label>
                  ))}
                </div>
                {selectedDays.length === 0 && (
                  <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                    Please select at least one workout day.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value))}
                    className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2 border bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Focus Area
                    {selectedDays.length > 1 && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                        (Auto: Full Body)
                      </span>
                    )}
                  </label>
                  <select
                    value={selectedDays.length > 1 ? "full body" : focusArea}
                    onChange={(e) => setFocusArea(e.target.value)}
                    disabled={selectedDays.length > 1}
                    className={`w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2 border bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                      selectedDays.length > 1 ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    <option value="full body">Full Body</option>
                    <option value="upper body">Upper Body</option>
                    <option value="lower body">Lower Body</option>
                    <option value="chest">Chest</option>
                    <option value="back">Back</option>
                    <option value="legs">Legs</option>
                    <option value="shoulders">Shoulders</option>
                    <option value="arms">Arms</option>
                    <option value="cardio">Cardio</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Available Equipment (select all that apply)
                </label>
                <div className="relative">
                  <div className="relative border rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 overflow-hidden">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-3 scrollbar-thin pr-2">
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
                    {/* Scroll indicator gradient at bottom - inside the border */}
                    <div className="absolute bottom-0 left-0 right-0 h-6 pointer-events-none bg-gradient-to-t from-white dark:from-gray-800 via-white/80 dark:via-gray-800/80 to-transparent"></div>
                  </div>
                  {/* Scroll hint text */}
                  {EQUIPMENT_OPTIONS.length > 6 && (
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      <span>Scroll to see all {EQUIPMENT_OPTIONS.length} equipment options</span>
                    </p>
                  )}
                </div>
                {equipment.length === 0 && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Select at least one equipment type to help the AI generate a
                    suitable workout plan.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Additional Details
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Give any other relevant details about your desired plan including any injuries or muscle groups to avoid. You can also name exercises you want included or excluded from your plan.
                </p>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2 border bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                  rows={4}
                  placeholder="e.g., Avoid exercises that put pressure on lower back. Include pull-ups and bench press. Exclude deadlifts."
                />
              </div>

              <Button
                onClick={handleGenerate}
                disabled={generating}
                isLoading={generating}
                className="w-full"
              >
                Generate Workout Plan
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {generatedPlans.map((plan: any, planIndex: number) => {
                const dayName = DAYS_OF_WEEK.find((d) => d.value === plan.day_of_week)?.fullName;
                return (
                  <div key={planIndex} className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 space-y-6">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{plan.name}</h2>
                        {dayName && (
                          <span className="px-2 py-1 text-xs font-semibold rounded bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300">
                            {dayName}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-700 dark:text-gray-300">{plan.description}</p>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Exercises</h3>
                      <div className="space-y-3">
                        {plan.exercises?.map((ex: any, idx: number) => (
                          <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-700">
                            <h4 className="font-semibold text-gray-900 dark:text-white">{ex.name}</h4>
                            <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                              {ex.sets} sets × {ex.reps_min}
                              {ex.reps_max !== ex.reps_min ? `-${ex.reps_max}` : ""}{" "}
                              reps
                              {ex.weight_lbs && ` @ ${ex.weight_lbs} lbs`}
                              {` • Rest: ${ex.rest_seconds}s`}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="flex justify-end space-x-4">
                <Button
                  onClick={() => setGeneratedPlans([])}
                  variant="outline"
                >
                  Back to Form
                </Button>
                <Button onClick={handleSave} variant="primary">
                  Save {generatedPlans.length > 1 ? "All Plans" : "Plan"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
