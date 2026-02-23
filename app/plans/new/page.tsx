"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BackLink } from "@/components/navigation/BackLink";
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
  is_warmup?: boolean;
  is_cooldown?: boolean;
}

export default function NewPlanPage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [exercises, setExercises] = useState<PlanExercise[]>([]);
  const [availableExercises, setAvailableExercises] = useState<Exercise[]>([]);
  const [warmupExerciseId, setWarmupExerciseId] = useState<string | null>(null);
  const [cooldownExerciseId, setCooldownExerciseId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadExercises();
  }, []);

  const loadExercises = async () => {
    const { data } = await supabase.from("exercises").select("*").order("name");
    if (data) {
      setAvailableExercises(data);
      // Find Warm-up and Cooldown exercise IDs
      const warmup = data.find((e) => e.name === "Warm-up");
      const cooldown = data.find((e) => e.name === "Cooldown");
      if (warmup) setWarmupExerciseId(warmup.id);
      if (cooldown) setCooldownExerciseId(cooldown.id);
    }
  };

  const addExercise = () => {
    // Find the highest order_index among non-warmup/non-cooldown exercises
    const regularExercises = exercises.filter(e => !e.is_warmup && !e.is_cooldown);
    const maxOrderIndex = regularExercises.length > 0 
      ? Math.max(...regularExercises.map(e => e.order_index))
      : -1;
    
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
        order_index: maxOrderIndex + 1,
        notes: "",
        is_warmup: false,
        is_cooldown: false,
      },
    ]);
  };

  const addWarmup = () => {
    if (!warmupExerciseId) return;
    
    // Check if warmup already exists
    if (exercises.some(e => e.is_warmup)) return;
    
    // Add warmup at the beginning (order_index 0)
    // Shift all other exercises' order_index by 1
    const updatedExercises = exercises.map(e => ({
      ...e,
      order_index: e.order_index + 1,
    }));
    
    updatedExercises.unshift({
      exercise_id: warmupExerciseId,
      sets: 1,
      sets_max: undefined,
      reps_min: 5,
      reps_max: 5,
      weight_lbs: null,
      rest_seconds: 60,
      order_index: 0,
      notes: "",
      is_warmup: true,
      is_cooldown: false,
    });
    
    setExercises(updatedExercises);
  };

  const addCooldown = () => {
    if (!cooldownExerciseId) return;
    
    // Check if cooldown already exists
    if (exercises.some(e => e.is_cooldown)) return;
    
    // Find the highest order_index
    const maxOrderIndex = exercises.length > 0 
      ? Math.max(...exercises.map(e => e.order_index))
      : -1;
    
    setExercises([
      ...exercises,
      {
        exercise_id: cooldownExerciseId,
        sets: 1,
        sets_max: undefined,
        reps_min: 10,
        reps_max: 10,
        weight_lbs: null,
        rest_seconds: 0,
        order_index: maxOrderIndex + 1,
        notes: "",
        is_warmup: false,
        is_cooldown: true,
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
    
    // Prevent dragging warm-up or cooldown
    if (draggedExercise.is_warmup || draggedExercise.is_cooldown) {
      setDraggedIndex(null);
      return;
    }
    
    // Prevent dropping before warm-up or after cooldown
    const warmupIndex = newExercises.findIndex(e => e.is_warmup);
    const cooldownIndex = newExercises.findIndex(e => e.is_cooldown);
    
    if (warmupIndex !== -1 && dropIndex <= warmupIndex) {
      setDraggedIndex(null);
      return;
    }
    
    if (cooldownIndex !== -1 && dropIndex > cooldownIndex) {
      setDraggedIndex(null);
      return;
    }
    
    // Remove dragged exercise
    newExercises.splice(draggedIndex, 1);
    
    // Adjust dropIndex if needed (accounting for removed item)
    let adjustedDropIndex = dropIndex;
    if (draggedIndex < dropIndex) {
      adjustedDropIndex = dropIndex - 1;
    }
    
    // Insert at new position
    newExercises.splice(adjustedDropIndex, 0, draggedExercise);
    
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
        is_warmup: e.is_warmup || false,
        is_cooldown: e.is_cooldown || false,
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
        <div className="mx-auto px-4 sm:px-6 max-w-7xl">
          <div className="flex justify-between h-14 sm:h-16 items-center">
            <div className="flex items-center">
              <BackLink href="/plans" />
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto px-4 py-5 sm:py-6 sm:px-6 max-w-4xl">
        <div className="sm:px-0">
          <div className="mb-5 sm:mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              Create Workout Plan
            </h1>
          </div>

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
              </div>

              {/* Add Warm-up Button */}
              {!exercises.some(e => e.is_warmup) && warmupExerciseId && (
                <div className="mb-4">
                  <Button onClick={addWarmup} variant="primary" size="sm">
                    + Add Warm-up
                  </Button>
                </div>
              )}

              <div className="space-y-4">
                {exercises.length === 0 ? (
                  <div className="mt-2">
                    <Button onClick={addExercise} variant="primary" size="sm">
                      + Add Exercise
                    </Button>
                  </div>
                ) : (() => {
                  const sortedExercises = [...exercises].sort((a, b) => {
                    // Warm-up always first
                    if (a.is_warmup && !b.is_warmup) return -1;
                    if (!a.is_warmup && b.is_warmup) return 1;
                    // Cooldown always last
                    if (a.is_cooldown && !b.is_cooldown) return 1;
                    if (!a.is_cooldown && b.is_cooldown) return -1;
                    // Otherwise maintain order_index
                    return a.order_index - b.order_index;
                  });
                  const nonCooldownExercises = sortedExercises.filter(e => !e.is_cooldown);
                  
                  return sortedExercises.map((exercise, index) => {
                    const isWarmup = exercise.is_warmup || false;
                    const isCooldown = exercise.is_cooldown || false;
                    const isSpecial = isWarmup || isCooldown;
                    
                    // Check if this is the last non-cooldown exercise
                    const isLastNonCooldown = nonCooldownExercises.length > 0 && 
                      exercise.exercise_id === nonCooldownExercises[nonCooldownExercises.length - 1].exercise_id &&
                      exercise.order_index === nonCooldownExercises[nonCooldownExercises.length - 1].order_index;
                    
                    return (
                    <div key={index}>
                    <div
                      draggable={!isSpecial}
                      onDragStart={() => !isSpecial && handleDragStart(index)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, index)}
                      className={`border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3 transition-opacity ${
                        isSpecial 
                          ? "bg-indigo-50 dark:bg-indigo-900/20 cursor-default" 
                          : "bg-gray-50 dark:bg-gray-700 cursor-move"
                      } ${
                        draggedIndex === index ? "opacity-50" : "opacity-100"
                      } ${!isSpecial ? "hover:border-indigo-300 dark:hover:border-indigo-600" : ""}`}
                    >
                      {!isSpecial && (
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
                      )}
                      {isSpecial && (
                        <div className="mb-2">
                          <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                            {isWarmup ? "Warm-up" : "Cooldown"}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between items-start">
                        <select
                          value={exercise.exercise_id}
                          onChange={(e) => {
                            // If changing from warm-up/cooldown to regular exercise, clear flags
                            if (isSpecial && e.target.value !== warmupExerciseId && e.target.value !== cooldownExerciseId) {
                              updateExercise(index, { 
                                exercise_id: e.target.value,
                                is_warmup: false,
                                is_cooldown: false,
                              });
                            } else {
                              updateExercise(index, { exercise_id: e.target.value });
                            }
                          }}
                          disabled={isSpecial}
                          className={`flex-1 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                            isSpecial ? "opacity-60 cursor-not-allowed" : ""
                          }`}
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
                          {isSpecial ? (
                            // Warm-up/Cooldown fields
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs text-gray-700 dark:text-gray-300 font-medium">
                                  Duration (minutes)
                                </label>
                                <input
                                  type="number"
                                  value={exercise.reps_min}
                                  onChange={(e) => {
                                    const value = parseInt(e.target.value) || 0;
                                    updateExercise(index, {
                                      reps_min: value,
                                      reps_max: value, // Keep them the same for time-based exercises
                                    });
                                  }}
                                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-2 py-1 border bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                  min="1"
                                />
                              </div>
                              {isWarmup && (
                                <div>
                                  <label className="block text-xs text-gray-700 dark:text-gray-300 font-medium">
                                    Rest After (sec)
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
                                    min="0"
                                  />
                                </div>
                              )}
                            </div>
                          ) : (
                            // Regular exercise fields
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
                                  Reps Max (or &quot;Max&quot;)
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
                                  Weight (lbs) or &quot;BW&quot;
                                </label>
                                <input
                                  type="text"
                                  value={exercise.weight_lbs === null ? "BW" : exercise.weight_lbs?.toString() || ""}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    const upperValue = value.toUpperCase();
                                    
                                    if (value === "" || upperValue === "BW") {
                                      updateExercise(index, { weight_lbs: null });
                                      return;
                                    }
                                    
                                    const numericValue = value.replace(/[^0-9.]/g, "");
                                    if (numericValue === "") {
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
                          )}
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
                              placeholder={isSpecial ? "e.g., Light jogging, Dynamic stretches" : "e.g., Focus on form"}
                            />
                          </div>
                        </>
                      )}
                    </div>
                    {/* Add Exercise button appears only after the last non-cooldown exercise */}
                    {isLastNonCooldown && (
                      <div className="mt-2">
                        <Button onClick={addExercise} variant="primary" size="sm">
                          + Add Exercise
                        </Button>
                      </div>
                    )}
                  </div>
                  );
                });
              })()}
              </div>
              
              {/* Add Cooldown Button */}
              {!exercises.some(e => e.is_cooldown) && cooldownExerciseId && (
                <div className="mt-4">
                  <Button onClick={addCooldown} variant="primary" size="sm">
                    + Add Cooldown
                  </Button>
                </div>
              )}
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
