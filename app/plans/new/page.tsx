"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Exercise {
  id: string;
  name: string;
  category: string;
  muscle_groups: string[];
}

interface PlanExercise {
  exercise_id: string;
  exercise?: Exercise;
  sets: number;
  sets_max?: number; // For variable sets like 3-4
  reps_min: number;
  reps_max: number;
  weight_kg: number | null;
  rest_seconds: number;
  order_index: number;
  notes?: string;
}

export default function NewPlanPage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [exercises, setExercises] = useState<PlanExercise[]>([]);
  const [availableExercises, setAvailableExercises] = useState<Exercise[]>([]);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadExercises();
  }, []);

  const loadExercises = async () => {
    const { data } = await supabase.from("exercises").select("*").order("name");
    if (data) setAvailableExercises(data);
  };

  const addExercise = () => {
    setExercises([
      ...exercises,
      {
        exercise_id: "",
        sets: 3,
        sets_max: undefined,
        reps_min: 8,
        reps_max: 12,
        weight_kg: null,
        rest_seconds: 60,
        order_index: exercises.length,
        notes: "",
      },
    ]);
  };

  const updateExercise = (index: number, updates: Partial<PlanExercise>) => {
    const updated = [...exercises];
    updated[index] = { ...updated[index], ...updates };
    setExercises(updated);
  };

  const removeExercise = (index: number) => {
    setExercises(exercises.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert("Please enter a plan name");
      return;
    }

    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    // Create workout plan
    const { data: plan, error: planError } = await supabase
      .from("workout_plans")
      .insert({
        name,
        description,
        user_id: user.id,
      })
      .select()
      .single();

    if (planError || !plan) {
      console.error("Error creating plan:", planError);
      setSaving(false);
      return;
    }

    // Add exercises
    const planExercises = exercises
      .filter((e) => e.exercise_id)
      .map((e, idx) => ({
        workout_plan_id: plan.id,
        exercise_id: e.exercise_id,
        order_index: idx,
        sets: e.sets_max ? e.sets_max : e.sets, // Use max if variable sets
        reps_min: e.reps_min,
        reps_max: e.reps_max,
        weight_kg: e.weight_kg,
        rest_seconds: e.rest_seconds,
        notes: e.notes || null,
      }));

    if (planExercises.length > 0) {
      const { error: exercisesError } = await supabase
        .from("workout_plan_exercises")
        .insert(planExercises);

      if (exercisesError) {
        console.error("Error adding exercises:", exercisesError);
      }
    }

    router.push(`/plans/${plan.id}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/plans" className="text-gray-700 hover:text-gray-900">
                ← Back
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            Create Workout Plan
          </h1>

          <div className="bg-white shadow rounded-lg p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Plan Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border text-gray-900 placeholder-gray-400"
                placeholder="e.g., Upper Body Strength"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border text-gray-900 placeholder-gray-400"
                rows={3}
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Exercises</h2>
                <button
                  onClick={addExercise}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Add Exercise
                </button>
              </div>

              <div className="space-y-4">
                {exercises.map((exercise, index) => (
                  <div
                    key={index}
                    className="border rounded-lg p-4 space-y-3"
                  >
                    <div className="flex justify-between items-start">
                      <select
                        value={exercise.exercise_id}
                        onChange={(e) =>
                          updateExercise(index, { exercise_id: e.target.value })
                        }
                        className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border text-gray-900"
                      >
                        <option value="">Select exercise...</option>
                        {availableExercises.map((ex) => (
                          <option key={ex.id} value={ex.id}>
                            {ex.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => removeExercise(index)}
                        className="ml-2 text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    </div>

                    {exercise.exercise_id && (
                      <>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                          <div>
                          <label className="block text-xs text-gray-700 font-medium">
                            Sets {exercise.sets_max && `(${exercise.sets}-${exercise.sets_max})`}
                          </label>
                            <div className="flex gap-1">
                              <input
                                type="number"
                                value={exercise.sets}
                                onChange={(e) =>
                                  updateExercise(index, {
                                    sets: parseInt(e.target.value) || 0,
                                  })
                                }
                                className="mt-1 flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-2 py-1 border text-gray-900 placeholder-gray-400"
                                placeholder="Min"
                              />
                              <input
                                type="number"
                                value={exercise.sets_max || ""}
                                onChange={(e) =>
                                  updateExercise(index, {
                                    sets_max: e.target.value ? parseInt(e.target.value) : undefined,
                                  })
                                }
                                className="mt-1 w-16 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-2 py-1 border text-gray-900 placeholder-gray-400"
                                placeholder="Max"
                              />
                            </div>
                          </div>
                          <div>
                          <label className="block text-xs text-gray-700 font-medium">
                            Reps Min
                          </label>
                            <input
                              type="number"
                              value={exercise.reps_min}
                              onChange={(e) =>
                                updateExercise(index, {
                                  reps_min: parseInt(e.target.value) || 0,
                                })
                              }
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-2 py-1 border text-gray-900"
                            />
                          </div>
                          <div>
                          <label className="block text-xs text-gray-700 font-medium">
                            Reps Max (or "Max")
                          </label>
                            <input
                              type="text"
                              value={exercise.reps_max === 999 ? "Max" : exercise.reps_max}
                              onChange={(e) => {
                                const value = e.target.value.toLowerCase();
                                if (value === "max") {
                                  updateExercise(index, { reps_max: 999 });
                                } else {
                                  updateExercise(index, {
                                    reps_max: parseInt(value) || 0,
                                  });
                                }
                              }}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-2 py-1 border text-gray-900 placeholder-gray-400"
                              placeholder="12 or Max"
                            />
                          </div>
                          <div>
                          <label className="block text-xs text-gray-700 font-medium">
                            Weight (kg) or "BW"
                          </label>
                            <input
                              type="text"
                              value={exercise.weight_kg === null ? "BW" : exercise.weight_kg?.toString() || ""}
                              onChange={(e) => {
                                const value = e.target.value.toUpperCase();
                                if (value === "BW" || value === "") {
                                  updateExercise(index, { weight_kg: null });
                                } else {
                                  updateExercise(index, {
                                    weight_kg: parseFloat(value) || null,
                                  });
                                }
                              }}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-2 py-1 border text-gray-900 placeholder-gray-400"
                              placeholder="BW or 50"
                            />
                          </div>
                          <div>
                          <label className="block text-xs text-gray-700 font-medium">
                            Rest (sec)
                          </label>
                            <input
                              type="number"
                              value={exercise.rest_seconds}
                              onChange={(e) =>
                                updateExercise(index, {
                                  rest_seconds: parseInt(e.target.value) || 0,
                                })
                              }
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-2 py-1 border text-gray-900"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-700 font-medium mb-1">
                            Notes (optional)
                          </label>
                          <input
                            type="text"
                            value={exercise.notes || ""}
                            onChange={(e) =>
                              updateExercise(index, {
                                notes: e.target.value,
                              })
                            }
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-2 py-1 border text-gray-900 placeholder-gray-400"
                            placeholder="e.g., Warm-up: 5-8 min light walk"
                          />
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-4">
              <Link
                href="/plans"
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-gray-900"
              >
                Cancel
              </Link>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Plan"}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
