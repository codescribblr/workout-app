import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BackLink } from "@/components/navigation/BackLink";
import ButtonLink from "@/components/ui/ButtonLink";

export default async function PlansPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: plans } = await supabase
    .from("workout_plans")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <nav className="bg-white dark:bg-gray-800 shadow">
        <div className="mx-auto px-4 sm:px-6 max-w-7xl">
          <div className="flex justify-between h-14 sm:h-16 items-center">
            <div className="flex items-center">
              <BackLink href="/dashboard" />
            </div>
            <div className="flex items-center space-x-2">
              <ButtonLink href="/plans/ai" variant="purple">
                AI Generate
              </ButtonLink>
              <ButtonLink href="/plans/new" variant="primary">
                New Plan
              </ButtonLink>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto px-4 py-5 sm:py-6 sm:px-6 max-w-7xl">
        <div className="sm:px-0">
          <div className="mb-5 sm:mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              Workout Plans
            </h1>
          </div>
          {plans && plans.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {plans.map((plan) => (
                <Link
                  key={plan.id}
                  href={`/plans/${plan.id}`}
                  className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 hover:shadow-lg transition block"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {plan.name}
                    </h3>
                    {plan.recommended_day_of_week !== null && plan.recommended_day_of_week !== undefined && (
                      <span className="px-2 py-1 text-xs font-semibold rounded bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300">
                        {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][plan.recommended_day_of_week]}
                      </span>
                    )}
                  </div>
                        {plan.description && (
                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                            {plan.description}
                          </p>
                        )}
                  {plan.is_ai_generated && (
                    <span className="inline-block mt-2 px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded">
                      AI Generated
                    </span>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-700 dark:text-gray-300 mb-4">No workout plans yet.</p>
              <ButtonLink href="/plans/new" variant="primary">
                Create Your First Plan
              </ButtonLink>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
