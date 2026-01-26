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
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {plan.name}
            </h1>
            {plan.description && (
              <p className="text-gray-700">{plan.description}</p>
            )}
            <div className="mt-4 space-y-2">
              <ContinueWorkoutButton />
              <div className="flex gap-2">
                <StartWorkoutButton planId={plan.id} />
                <ButtonLink href={`/plans/${plan.id}/edit`} variant="outline">
                  Edit Plan
                </ButtonLink>
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Exercises</h2>
            <div className="space-y-4">
              {planExercises?.map((pe, index) => (
                <div key={pe.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-lg text-gray-900">
                        {index + 1}. {pe.exercises?.name}
                      </h3>
                      {pe.exercises?.muscle_groups && (
                        <p className="text-sm text-gray-700">
                          {pe.exercises.muscle_groups.join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-700">Sets:</span>{" "}
                      <span className="font-medium">
                        {pe.sets}
                        {(pe as any).sets_max && (pe as any).sets_max !== pe.sets
                          ? `-${(pe as any).sets_max}`
                          : ""}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-700">Reps:</span>{" "}
                      <span className="font-medium">
                        {pe.reps_min}
                        {pe.reps_max === 999
                          ? " (Max)"
                          : pe.reps_max !== pe.reps_min
                          ? `-${pe.reps_max}`
                          : ""}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-700">Weight:</span>{" "}
                      <span className="font-medium">
                        {(pe as any).weight_lbs ? `${(pe as any).weight_lbs} lbs` : "BW"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-700">Rest:</span>{" "}
                      <span className="font-medium">{pe.rest_seconds}s</span>
                    </div>
                  </div>
                  {pe.notes && (
                    <div className="mt-2 text-sm text-gray-700">
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
