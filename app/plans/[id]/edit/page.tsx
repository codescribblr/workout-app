"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";

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
  sets_max?: number;
  reps_min: number;
  reps_max: number;
  weight_lbs: number | null;
  rest_seconds: number;
  order_index: number;
  notes?: string;
}

export default function EditPlanPage() {
  const params = useParams();
  const planId = params.id as string;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [exercises, setExercises] = useState<PlanExercise[]>([]);
  const [availableExercises, setAvailableExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadPlan();
    loadExercises();
  }, [planId]);

  const loadExercises = async () => {
    const { data } = await supabase.from("exercises").select("*").order("name");
    if (data) setAvailableExercises(data);
  };

  const loadPlan = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    // Load plan
    const { data: plan } = await supabase
      .from("workout_plans")
      .select("*")
      .eq("id", planId)
      .eq("user_id", user.id)
      .single();

    if (!plan) {
      router.push("/plans");
      return;
    }

    setName(plan.name);
    setDescription(plan.description || "");

    // Load plan exercises
    const { data: planExercises } = await supabase
      .from("workout_plan_exercises")
      .select(
        `
        *,
        exercises (
          id,
          name
        )
      `
      )
      .eq("workout_plan_id", planId)
      .order("order_index");

    if (planExercises) {
      setExercises(
        planExercises.map((pe) => ({
          exercise_id: pe.exercise_id,
          sets: pe.sets,
          sets_max: (pe as any).sets_max,
          reps_min: pe.reps_min,
          reps_max: pe.reps_max,
          weight_lbs: (pe as any).weight_lbs,
          rest_seconds: pe.rest_seconds,
          order_index: pe.order_index,
          notes: pe.notes || "",
        }))
      );
    }

    setLoading(false);
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
        weight_lbs: null,
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

    // Update workout plan
    const { error: planError } = await supabase
      .from("workout_plans")
      .update({
        name,
        description,
      })
      .eq("id", planId)
      .eq("user_id", user.id);

    if (planError) {
      console.error("Error updating plan:", planError);
      setSaving(false);
      return;
    }

    // Delete existing exercises
    await supabase
      .from("workout_plan_exercises")
      .delete()
      .eq("workout_plan_id", planId);

    // Add updated exercises
    const planExercises = exercises
      .filter((e) => e.exercise_id)
      .map((e, idx) => ({
        workout_plan_id: planId,
        exercise_id: e.exercise_id,
        order_index: idx,
        sets: e.sets_max ? e.sets_max : e.sets,
        sets_max: e.sets_max,
        reps_min: e.reps_min,
        reps_max: e.reps_max,
        weight_lbs: e.weight_lbs,
        rest_seconds: e.rest_seconds,
        notes: e.notes || null,
      }));

    if (planExercises.length > 0) {
      const { error: exercisesError } = await supabase
        .from("workout_plan_exercises")
        .insert(planExercises);

      if (exercisesError) {
        console.error("Error updating exercises:", exercisesError);
        setSaving(false);
        return;
      }
    }

    router.push(`/plans/${planId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-xl">Loading plan...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href={`/plans/${planId}`} className="text-gray-700 hover:text-gray-900">
                ← Back
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            Edit Workout Plan
          </h1>

          <div className="bg-white shadow rounded-lg p-6 mb-6 space-y-4">
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
                Description (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border text-gray-900 placeholder-gray-400"
                rows={3}
                placeholder="Describe your workout plan..."
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Exercises</h2>
              {exercises.length === 0 && (
                <Button onClick={addExercise} variant="primary">
                  Add Exercise
                </Button>
              )}
            </div>

            <div className="space-y-4">
              {exercises.map((exercise, index) => (
                <div key={index}>
                  <div className="border rounded-lg p-4 space-y-3">
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
                      <Button
                        onClick={() => removeExercise(index)}
                        variant="danger"
                        size="sm"
                        className="ml-2"
                      >
                        Remove
                      </Button>
                    </div>

                    {exercise.exercise_id && (
                      <>
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                          <div>
                            <label className="block text-xs text-gray-700 font-medium">
                              Sets Min
                            </label>
                            <input
                              type="number"
                              value={exercise.sets}
                              onChange={(e) =>
                                updateExercise(index, {
                                  sets: parseInt(e.target.value) || 0,
                                })
                              }
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-2 py-1 border text-gray-900 placeholder-gray-400"
                              placeholder="Min"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-700 font-medium">
                              Sets Max
                            </label>
                            <input
                              type="number"
                              value={exercise.sets_max || ""}
                              onChange={(e) =>
                                updateExercise(index, {
                                  sets_max: e.target.value ? parseInt(e.target.value) : undefined,
                                })
                              }
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-2 py-1 border text-gray-900 placeholder-gray-400"
                              placeholder="Max"
                            />
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
                              Weight (lbs) or "BW"
                            </label>
                            <input
                              type="text"
                              value={exercise.weight_lbs === null ? "BW" : exercise.weight_lbs?.toString() || ""}
                              onChange={(e) => {
                                const value = e.target.value.trim();
                                const upperValue = value.toUpperCase();
                                
                                if (upperValue === "BW" || value === "") {
                                  updateExercise(index, { weight_lbs: null });
                                  return;
                                }
                                
                                const numericValue = value.replace(/[^0-9.]/g, "");
                                if (numericValue === "") {
                                  return;
                                }
                                
                                const lbs = parseFloat(numericValue);
                                if (!isNaN(lbs) && lbs >= 0) {
                                  updateExercise(index, {
                                    weight_lbs: lbs,
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
                  <div className="mt-2">
                    <Button onClick={addExercise} variant="primary" size="sm">
                      + Add Exercise
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-4 mt-6">
            <Link href={`/plans/${planId}`}>
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button onClick={handleSave} disabled={saving} isLoading={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
