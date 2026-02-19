import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import LocalTime from "@/components/ui/LocalTime";
import HistoryDetailActions from "@/components/history/HistoryDetailActions";

export default async function HistoryDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Load session with plan info
  const { data: session, error: sessionError } = await supabase
    .from("workout_sessions")
    .select(
      `
      *,
      workout_plans (
        name,
        description
      )
    `
    )
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (sessionError || !session) {
    redirect("/history");
  }

  // Load all sets for this session with exercise info
  const { data: sets, error: setsError } = await supabase
    .from("workout_sets")
    .select(
      `
      *,
      exercises (
        id,
        name,
        category,
        muscle_groups
      )
    `
    )
    .eq("workout_session_id", params.id)
    .order("completed_at", { ascending: true });

  if (setsError) {
    console.error("Error loading sets:", setsError);
  }

  // Load exercise order if available (from edit or in-workout reordering)
  const { data: sessionExercises } = await supabase
    .from("workout_session_exercises")
    .select("exercise_id, order_index")
    .eq("workout_session_id", params.id)
    .order("order_index");

  // Group sets by exercise and determine display order
  const exercisesMap = new Map<string, any[]>();
  if (sets) {
    sets.forEach((set: any) => {
      const exerciseId = set.exercise_id;
      if (!exercisesMap.has(exerciseId)) {
        exercisesMap.set(exerciseId, []);
      }
      exercisesMap.get(exerciseId)!.push(set);
    });
  }

  // Order: use workout_session_exercises when available, else by first completed_at per exercise
  const orderedExerciseIds = (() => {
    const ids = Array.from(exercisesMap.keys());
    if (sessionExercises && sessionExercises.length > 0) {
      const orderMap = new Map<string, number>();
      sessionExercises.forEach((se: any) => orderMap.set(se.exercise_id, se.order_index));
      return ids.sort((a, b) => {
        const orderA = orderMap.get(a);
        const orderB = orderMap.get(b);
        if (orderA != null && orderB != null) return orderA - orderB;
        if (orderA != null) return -1;
        if (orderB != null) return 1;
        const setsA = exercisesMap.get(a)!;
        const setsB = exercisesMap.get(b)!;
        return new Date(setsA[0].completed_at).getTime() - new Date(setsB[0].completed_at).getTime();
      });
    }
    return ids.sort((a, b) => {
      const setsA = exercisesMap.get(a)!;
      const setsB = exercisesMap.get(b)!;
      return new Date(setsA[0].completed_at).getTime() - new Date(setsB[0].completed_at).getTime();
    });
  })();

  // Calculate duration
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
    if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? "minute" : "minutes"}`);
    return parts.join(" ") || "0 minutes";
  };

  const duration = session.duration_seconds
    ? formatDuration(session.duration_seconds)
    : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <nav className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <Link href="/history" className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                ← Back to History
              </Link>
            </div>
            <HistoryDetailActions
              sessionId={params.id}
              isCompleted={!!session.completed_at}
              startedAt={session.started_at}
            />
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Session Header */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  {session.workout_plans?.name || "Custom Workout"}
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  <LocalTime
                    iso={session.started_at}
                    formatStr="EEEE, MMMM d, yyyy 'at' h:mm a"
                  />
                </p>
              </div>
              {session.completed_at ? (
                <span className="px-3 py-1 text-sm bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full">
                  Completed
                </span>
              ) : (
                <span className="px-3 py-1 text-sm bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-full">
                  In Progress
                </span>
              )}
            </div>

            {session.workout_plans?.description && (
              <p className="text-gray-700 dark:text-gray-300 mb-4">{session.workout_plans.description}</p>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              {duration && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Duration</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{duration}</p>
                </div>
              )}
              {session.completed_at && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Completed</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    <LocalTime iso={session.completed_at} formatStr="h:mm a" />
                  </p>
                </div>
              )}
              {sets && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Sets</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{sets.length}</p>
                </div>
              )}
              {exercisesMap.size > 0 && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Exercises</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {exercisesMap.size}
                  </p>
                </div>
              )}
            </div>

            {session.notes && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Notes</p>
                <p className="text-gray-900 dark:text-white">{session.notes}</p>
              </div>
            )}
          </div>

          {/* Exercises and Sets */}
          {exercisesMap.size > 0 ? (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Exercises</h2>
              {orderedExerciseIds.map((exerciseId) => {
                const exerciseSets = exercisesMap.get(exerciseId)!;
                const exercise = exerciseSets[0].exercises;
                const sortedSets = exerciseSets.sort(
                  (a, b) => a.set_number - b.set_number
                );

                return (
                  <div key={exerciseId} className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                      {exercise.name}
                    </h3>
                    {exercise.category && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        {exercise.category}
                        {exercise.muscle_groups &&
                          exercise.muscle_groups.length > 0 &&
                          ` • ${exercise.muscle_groups.join(", ")}`}
                      </p>
                    )}

                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Set
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              {exercise?.category === "warmup" || exercise?.category === "cooldown" ? "Minutes" : "Reps"}
                            </th>
                            {(exercise?.category !== "warmup" && exercise?.category !== "cooldown") && (
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Weight
                            </th>
                            )}
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Completed
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                          {sortedSets.map((set: any) => (
                            <tr key={set.id}>
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                {set.set_number}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                                {set.reps != null
                                  ? (exercise?.category === "warmup" || exercise?.category === "cooldown"
                                      ? `${set.reps} ${set.reps === 1 ? "minute" : "minutes"}`
                                      : set.reps)
                                  : "-"}
                              </td>
                              {(exercise?.category !== "warmup" && exercise?.category !== "cooldown") && (
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                                {set.weight_lbs !== null && set.weight_lbs !== undefined
                                  ? `${set.weight_lbs} lbs`
                                  : "BW"}
                              </td>
                              )}
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                <LocalTime iso={set.completed_at} formatStr="h:mm:ss a" />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 text-center">
              <p className="text-gray-700 dark:text-gray-300">No sets recorded for this workout.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
