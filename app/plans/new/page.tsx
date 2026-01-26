"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
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
  sets_max?: number; // For variable sets like 3-4
  reps_min: number;
  reps_max: number;
  weight_lbs: number | null;
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

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    const newExercises = [...exercises];
    const draggedExercise = newExercises[draggedIndex];
    
    // Remove dragged exercise
    newExercises.splice(draggedIndex, 1);
    
    // Insert at new position
    newExercises.splice(dropIndex, 0, draggedExercise);
    
    // Update order_index for all exercises
    newExercises.forEach((ex, idx) => {
      ex.order_index = idx;
    });
    
    setExercises(newExercises);
    setDraggedIndex(null);
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

    // Add exercises - use order_index from exercise object, not filtered index
    const planExercises = exercises
      .filter((e) => e.exercise_id)
      .map((e) => ({
        workout_plan_id: plan.id,
        exercise_id: e.exercise_id,
        order_index: e.order_index,
        sets: e.sets,
        sets_max: e.sets_max || null,
        reps_min: e.reps_min,
        reps_max: e.reps_max,
        weight_lbs: e.weight_lbs,
        rest_seconds: e.rest_seconds,
        notes: e.notes || null,
      }))
      .sort((a, b) => a.order_index - b.order_index); // Ensure correct order

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
            Create Workout Plan
          </h1>

          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Plan Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                placeholder="e.g., Upper Body Strength"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                rows={3}
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Exercises</h2>
                {exercises.length === 0 && (
                  <Button onClick={addExercise} variant="primary">
                    Add Exercise
                  </Button>
                )}
              </div>

              <div className="space-y-4">
                {exercises.map((exercise, index) => (
                  <div key={index}>
                    <div
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, index)}
                      className={`border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3 cursor-move transition-opacity bg-gray-50 dark:bg-gray-700 ${
                        draggedIndex === index ? "opacity-50" : "opacity-100"
                      } hover:border-indigo-300 dark:hover:border-indigo-600`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="text-gray-400 dark:text-gray-500 cursor-grab active:cursor-grabbing">
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
                        <span className="text-xs text-gray-500 dark:text-gray-400">Drag to reorder</span>
                      </div>
                      <div className="flex justify-between items-start">
                        <select
                          value={exercise.exercise_id}
                          onChange={(e) =>
                            updateExercise(index, { exercise_id: e.target.value })
                          }
                          className="flex-1 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
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
                              <label className="block text-xs text-gray-700 dark:text-gray-300 font-medium">
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
                                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-2 py-1 border bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                                placeholder="Min"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-700 dark:text-gray-300 font-medium">
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
                                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-2 py-1 border bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                                placeholder="Max"
                              />
                            </div>
                            <div>
                            <label className="block text-xs text-gray-700 dark:text-gray-300 font-medium">
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
                                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-2 py-1 border bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                              />
                            </div>
                            <div>
                            <label className="block text-xs text-gray-700 dark:text-gray-300 font-medium">
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
                                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-2 py-1 border bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                                placeholder="12 or Max"
                              />
                            </div>
                            <div>
                            <label className="block text-xs text-gray-700 dark:text-gray-300 font-medium">
                              Weight (lbs) or "BW"
                            </label>
                            <input
                              type="text"
                              value={exercise.weight_lbs === null ? "BW" : exercise.weight_lbs?.toString() || ""}
                              onChange={(e) => {
                                const value = e.target.value;
                                const upperValue = value.toUpperCase();
                                
                                // If user is deleting/changing "BW", allow them to type
                                // Only set to null if the field is completely empty or exactly "BW"
                                if (value === "" || upperValue === "BW") {
                                  updateExercise(index, { weight_lbs: null });
                                  return;
                                }
                                
                                // If user is typing a number, extract numeric value
                                const numericValue = value.replace(/[^0-9.]/g, "");
                                if (numericValue === "") {
                                  // Allow empty state while typing
                                  updateExercise(index, { weight_lbs: null });
                                  return;
                                }
                                
                                const lbs = parseFloat(numericValue);
                                if (!isNaN(lbs) && lbs >= 0) {
                                  updateExercise(index, {
                                    weight_lbs: lbs,
                                  });
                                }
                              }}
                              onFocus={(e) => {
                                // When focused, if value is "BW", select all text so user can type over it
                                if (e.target.value === "BW") {
                                  e.target.select();
                                }
                              }}
                              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-2 py-1 border bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                              placeholder="BW or 50"
                            />
                            </div>
                            <div>
                            <label className="block text-xs text-gray-700 dark:text-gray-300 font-medium">
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
                                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-2 py-1 border bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-700 dark:text-gray-300 font-medium mb-1">
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
                              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-2 py-1 border bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                              placeholder="e.g., Warm-up: 5-8 min light walk"
                            />
                          </div>
                        </>
                      )}
                    </div>
                    {/* Add Exercise button appears only after the last exercise */}
                    {index === exercises.length - 1 && (
                      <div className="mt-2">
                        <Button onClick={addExercise} variant="primary" size="sm">
                          + Add Exercise
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-4">
              <Link href="/plans">
                <Button variant="outline">Cancel</Button>
              </Link>
              <Button onClick={handleSave} disabled={saving} isLoading={saving}>
                {saving ? "Saving..." : "Save Plan"}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
