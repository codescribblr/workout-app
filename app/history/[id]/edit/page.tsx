"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { BackLink } from "@/components/navigation/BackLink";
import Button from "@/components/ui/Button";

interface WorkoutSet {
  id?: string;
  set_number: number;
  reps: number | null;
  weight_lbs: number | null;
}

interface ExerciseBlock {
  exercise_id: string;
  exercise_name: string;
  exercise_category?: string;
  sets: WorkoutSet[];
}

export default function EditWorkoutPage() {
  const params = useParams();
  const sessionId = params.id as string;
  const router = useRouter();
  const supabase = createClient();

  const [session, setSession] = useState<any>(null);
  const [blocks, setBlocks] = useState<ExerciseBlock[]>([]);
  const [availableExercises, setAvailableExercises] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [addExerciseSelected, setAddExerciseSelected] = useState("");

  useEffect(() => {
    loadData();
  }, [sessionId]);

  const loadData = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { data: sess } = await supabase
      .from("workout_sessions")
      .select("*, workout_plans(name)")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (!sess) {
      router.push("/history");
      return;
    }
    setSession(sess);

    const { data: sets } = await supabase
      .from("workout_sets")
      .select("*, exercises(id, name, category)")
      .eq("workout_session_id", sessionId)
      .order("completed_at", { ascending: true });

    const { data: sessionExercises } = await supabase
      .from("workout_session_exercises")
      .select("exercise_id, order_index")
      .eq("workout_session_id", sessionId)
      .order("order_index");

    const { data: exercises } = await supabase
      .from("exercises")
      .select("id, name, category")
      .order("name");

    setAvailableExercises(exercises || []);

    if (sets && sets.length > 0) {
      const byExercise = new Map<string, any[]>();
      sets.forEach((s: any) => {
        const eid = s.exercise_id;
        if (!byExercise.has(eid)) byExercise.set(eid, []);
        byExercise.get(eid)!.push(s);
      });
      const entries = Array.from(byExercise.entries());
      const orderMap = new Map<string, number>();
      sessionExercises?.forEach((se: any) => orderMap.set(se.exercise_id, se.order_index));
      const blocksData: ExerciseBlock[] = entries
        .sort(([aid, a], [bid, b]) => {
          const orderA = orderMap.get(aid);
          const orderB = orderMap.get(bid);
          if (orderA != null && orderB != null) return orderA - orderB;
          if (orderA != null) return -1;
          if (orderB != null) return 1;
          return new Date(a[0].completed_at).getTime() - new Date(b[0].completed_at).getTime();
        })
        .map(([exerciseId, exerciseSets]) => {
          const ex = exerciseSets[0]?.exercises;
          const sorted = exerciseSets.sort((a: any, b: any) => a.set_number - b.set_number);
          return {
            exercise_id: exerciseId,
            exercise_name: ex?.name ?? "Unknown",
            exercise_category: ex?.category,
            sets: sorted.map((s: any) => ({
              id: s.id,
              set_number: s.set_number,
              reps: s.reps,
              weight_lbs: s.weight_lbs,
            })),
          };
        });
      setBlocks(blocksData);
    } else {
      setBlocks([]);
    }
    setLoading(false);
  };

  const updateBlock = (index: number, updates: Partial<ExerciseBlock>) => {
    setBlocks((prev) =>
      prev.map((b, i) => (i === index ? { ...b, ...updates } : b))
    );
  };

  const updateSet = (blockIndex: number, setIndex: number, updates: Partial<WorkoutSet>) => {
    setBlocks((prev) =>
      prev.map((b, bi) =>
        bi === blockIndex
          ? {
              ...b,
              sets: b.sets.map((s, si) =>
                si === setIndex ? { ...s, ...updates } : s
              ),
            }
          : b
      )
    );
  };

  const changeExercise = (blockIndex: number, exerciseId: string) => {
    const ex = availableExercises.find((e) => e.id === exerciseId);
    if (ex) {
      updateBlock(blockIndex, {
        exercise_id: exerciseId,
        exercise_name: ex.name,
        exercise_category: ex.category,
      });
    }
  };

  const removeBlock = (index: number) => {
    setBlocks((prev) => prev.filter((_, i) => i !== index));
  };

  const moveBlock = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= blocks.length) return;
    setBlocks((prev) => {
      const arr = [...prev];
      [arr[index], arr[newIndex]] = [arr[newIndex], arr[index]];
      return arr;
    });
  };

  const addSetToBlock = (blockIndex: number) => {
    setBlocks((prev) =>
      prev.map((b, i) =>
        i === blockIndex
          ? {
              ...b,
              sets: [
                ...b.sets,
                {
                  set_number: b.sets.length + 1,
                  reps: null,
                  weight_lbs: null,
                },
              ],
            }
          : b
      )
    );
  };

  const removeSetFromBlock = (blockIndex: number, setIndex: number) => {
    setBlocks((prev) =>
      prev.map((b, i) =>
        i === blockIndex
          ? {
              ...b,
              sets: b.sets
                .filter((_, si) => si !== setIndex)
                .map((s, si) => ({ ...s, set_number: si + 1 })),
            }
          : b
      )
    );
  };

  const addExercise = (exerciseId: string) => {
    const ex = availableExercises.find((e) => e.id === exerciseId);
    if (!ex) return;
    setBlocks((prev) => [
      ...prev,
      {
        exercise_id: exerciseId,
        exercise_name: ex.name,
        exercise_category: ex.category,
        sets: [{ set_number: 1, reps: null, weight_lbs: null }],
      },
    ]);
    setShowAddExercise(false);
  };

  const handleSave = async () => {
    if (!sessionId || !session) return;
    setSaving(true);

    try {
      const toUpdate: { id: string; exercise_id: string; reps: number | null; weight_lbs: number | null }[] = [];
      const toInsert: { exercise_id: string; set_number: number; reps: number | null; weight_lbs: number | null }[] = [];
      const toDelete: string[] = [];

      const existingSetIds = new Set<string>();
      blocks.forEach((block) => {
        block.sets.forEach((set) => {
          if (set.id) existingSetIds.add(set.id);
        });
      });

      const { data: existingSets } = await supabase
        .from("workout_sets")
        .select("id")
        .eq("workout_session_id", sessionId);

      existingSets?.forEach((s: any) => {
        if (!existingSetIds.has(s.id)) toDelete.push(s.id);
      });

      blocks.forEach((block) => {
        block.sets.forEach((set) => {
          const reps = set.reps != null ? set.reps : null;
          const weight = set.weight_lbs != null ? set.weight_lbs : null;
          if (set.id) {
            toUpdate.push({ id: set.id, exercise_id: block.exercise_id, reps, weight_lbs: weight });
          } else {
            toInsert.push({
              exercise_id: block.exercise_id,
              set_number: set.set_number,
              reps,
              weight_lbs: weight,
            });
          }
        });
      });

      for (const row of toUpdate) {
        await supabase
          .from("workout_sets")
          .update({
            exercise_id: row.exercise_id,
            reps: row.reps,
            weight_lbs: row.weight_lbs,
          })
          .eq("id", row.id);
      }

      for (const row of toInsert) {
        await supabase.from("workout_sets").insert({
          workout_session_id: sessionId,
          exercise_id: row.exercise_id,
          set_number: row.set_number,
          reps: row.reps,
          weight_lbs: row.weight_lbs,
        });
      }

      if (toDelete.length > 0) {
        await supabase.from("workout_sets").delete().in("id", toDelete);
      }

      // Persist exercise order to workout_session_exercises
      const { error: deleteOrderError } = await supabase
        .from("workout_session_exercises")
        .delete()
        .eq("workout_session_id", sessionId);
      if (deleteOrderError && deleteOrderError.code !== "PGRST116") {
        console.warn("Could not clear exercise order:", deleteOrderError);
      } else {
        for (let i = 0; i < blocks.length; i++) {
          const { error: insertOrderError } = await supabase
            .from("workout_session_exercises")
            .insert({
              workout_session_id: sessionId,
              exercise_id: blocks[i].exercise_id,
              order_index: i,
              is_completed: true,
            });
          if (insertOrderError && insertOrderError.code !== "PGRST116") {
            console.warn("Could not persist exercise order:", insertOrderError);
            break;
          }
        }
      }

      router.push(`/history/${sessionId}`);
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <nav className="bg-white dark:bg-gray-800 shadow">
        <div className="mx-auto px-4 sm:px-6 max-w-4xl">
          <div className="flex justify-between h-14 sm:h-16 items-center">
            <BackLink href={`/history/${sessionId}`} />
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </nav>

      <main className="mx-auto px-4 py-5 sm:py-6 sm:px-6 max-w-4xl">
        <div className="mb-5 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Edit Workout — {session?.workout_plans?.name || "Workout"}
          </h1>
        </div>

        <div className="space-y-6">
          {blocks.map((block, blockIndex) => (
            <div
              key={`${block.exercise_id}-${blockIndex}`}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
            >
              <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <select
                    value={block.exercise_id}
                    onChange={(e) => changeExercise(blockIndex, e.target.value)}
                    className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-semibold"
                  >
                    {availableExercises.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.name}
                      </option>
                    ))}
                  </select>
                  <div className="flex">
                    <button
                      type="button"
                      onClick={() => moveBlock(blockIndex, "up")}
                      disabled={blockIndex === 0}
                      className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-40"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveBlock(blockIndex, "down")}
                      disabled={blockIndex === blocks.length - 1}
                      className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-40"
                    >
                      ↓
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addSetToBlock(blockIndex)}
                  >
                    + Set
                  </Button>
                  <button
                    type="button"
                    onClick={() => removeBlock(blockIndex)}
                    className="p-1.5 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                    title="Remove exercise"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Set</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                        {block.exercise_category === "warmup" || block.exercise_category === "cooldown" ? "Minutes" : "Reps"}
                      </th>
                      {(block.exercise_category !== "warmup" && block.exercise_category !== "cooldown") && (
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Weight</th>
                      )}
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {block.sets.map((set, setIndex) => (
                      <tr key={set.id ?? setIndex}>
                        <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{set.set_number}</td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            min={0}
                            value={set.reps ?? ""}
                            placeholder={block.exercise_category === "warmup" || block.exercise_category === "cooldown" ? "min" : undefined}
                            onChange={(e) =>
                              updateSet(blockIndex, setIndex, {
                                reps: e.target.value === "" ? null : parseInt(e.target.value) || 0,
                              })
                            }
                            className="w-20 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </td>
                        {(block.exercise_category !== "warmup" && block.exercise_category !== "cooldown") && (
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            min={0}
                            step={0.5}
                            value={set.weight_lbs ?? ""}
                            onChange={(e) =>
                              updateSet(blockIndex, setIndex, {
                                weight_lbs:
                                  e.target.value === ""
                                    ? null
                                    : parseFloat(e.target.value) || 0,
                              })
                            }
                            placeholder="BW"
                            className="w-24 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                          />
                        </td>
                        )}
                        <td>
                          {block.sets.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeSetFromBlock(blockIndex, setIndex)}
                              className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm"
                            >
                              ×
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowAddExercise(true)}
            >
              + Add Exercise
            </Button>
          </div>
        </div>

        {showAddExercise && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Add Exercise</h3>
              <select
                value={addExerciseSelected}
                onChange={(e) => setAddExerciseSelected(e.target.value)}
                className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-4"
              >
                <option value="">Select exercise...</option>
                {availableExercises.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowAddExercise(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    if (addExerciseSelected) addExercise(addExerciseSelected);
                    setAddExerciseSelected("");
                  }}
                  disabled={!addExerciseSelected}
                >
                  Add
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
