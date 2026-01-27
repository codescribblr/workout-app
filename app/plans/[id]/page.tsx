import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import StartWorkoutButton from "@/components/workout/StartWorkoutButton";
import ButtonLink from "@/components/ui/ButtonLink";
import ContinueWorkoutButton from "@/components/workout/ContinueWorkoutButton";

export default async function PlanDetailPage({
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

  const { data: plan } = await supabase
    .from("workout_plans")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (!plan) {
    redirect("/plans");
  }

  const { data: planExercises } = await supabase
    .from("workout_plan_exercises")
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
    .eq("workout_plan_id", params.id)
    .order("order_index");

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
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-6">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {plan.name}
              </h1>
              {plan.recommended_day_of_week !== null && plan.recommended_day_of_week !== undefined && (
                <span className="px-3 py-1 text-sm font-semibold rounded bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300">
                  {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][plan.recommended_day_of_week]}
                </span>
              )}
            </div>
            {plan.description && (
              <p className="text-gray-700 dark:text-gray-300">{plan.description}</p>
            )}
            <div className="mt-4 space-y-2">
              <ContinueWorkoutButton planId={plan.id} />
              <div className="flex gap-2">
                <StartWorkoutButton planId={plan.id} />
                <ButtonLink href={`/plans/${plan.id}/edit`} variant="outline">
                  Edit Plan
                </ButtonLink>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Exercises</h2>
            <div className="space-y-4">
              {planExercises?.map((pe, index) => (
                <div key={pe.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-700">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
                        {index + 1}. {pe.exercises?.name}
                      </h3>
                      {pe.exercises?.muscle_groups && (
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          {pe.exercises.muscle_groups.join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-700 dark:text-gray-300">Sets:</span>{" "}
                      <span className="font-medium text-gray-900 dark:text-white">
                        {pe.sets}
                        {(pe as any).sets_max && (pe as any).sets_max !== pe.sets
                          ? `-${(pe as any).sets_max}`
                          : ""}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-700 dark:text-gray-300">Reps:</span>{" "}
                      <span className="font-medium text-gray-900 dark:text-white">
                        {pe.reps_min}
                        {pe.reps_max === 999
                          ? " (Max)"
                          : pe.reps_max !== pe.reps_min
                          ? `-${pe.reps_max}`
                          : ""}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-700 dark:text-gray-300">Weight:</span>{" "}
                      <span className="font-medium text-gray-900 dark:text-white">
                        {(pe as any).weight_lbs ? `${(pe as any).weight_lbs} lbs` : "BW"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-700 dark:text-gray-300">Rest:</span>{" "}
                      <span className="font-medium text-gray-900 dark:text-white">{pe.rest_seconds}s</span>
                    </div>
                  </div>
                  {pe.notes && (
                    <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                      <span className="font-medium">Notes:</span> {pe.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
