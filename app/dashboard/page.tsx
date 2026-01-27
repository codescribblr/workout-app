import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import ContinueWorkoutButton from "@/components/workout/ContinueWorkoutButton";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Get recent workouts for display
  const { data: recentWorkouts } = await supabase
    .from("workout_sessions")
    .select("id, started_at, completed_at, workout_plans(name)")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(5);

  // Get total count for the dashboard card
  const { count: totalWorkoutsCount } = await supabase
    .from("workout_sessions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  const { data: plans } = await supabase
    .from("workout_plans")
    .select("id, name, description")
    .eq("user_id", user.id)
    .limit(5);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <nav className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Workout Tracker</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/settings"
                className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                Settings
              </Link>
              <form action="/api/auth/logout" method="post">
                <button
                  type="submit"
                  className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                >
                  Logout
                </button>
              </form>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Welcome, {profile?.display_name || user.email}!
            </h2>
          </div>

          <div className="mb-6">
            <ContinueWorkoutButton />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Link
              href="/plans"
              className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg hover:shadow-lg transition"
            >
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <span className="text-3xl">🏋️</span>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                        Start New Workout
                      </dt>
                      <dd className="text-lg font-medium text-gray-900 dark:text-white">
                        Choose a plan
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </Link>

            <Link
              href="/plans"
              className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg hover:shadow-lg transition"
            >
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <span className="text-3xl">📋</span>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                        Workout Plans
                      </dt>
                      <dd className="text-lg font-medium text-gray-900 dark:text-white">
                        {plans?.length || 0} plans
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </Link>

            <Link
              href="/history"
              className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg hover:shadow-lg transition"
            >
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <span className="text-3xl">📊</span>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                        Workout History
                      </dt>
                      <dd className="text-lg font-medium text-gray-900 dark:text-white">
                        {totalWorkoutsCount || 0} sessions
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </Link>
          </div>

          {plans && plans.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Your Workout Plans
              </h3>
              <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md">
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                  {plans.map((plan) => (
                    <li key={plan.id}>
                      <Link
                        href={`/plans/${plan.id}`}
                        className="block hover:bg-gray-50 dark:hover:bg-gray-700 px-4 py-4 sm:px-6"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 truncate">
                              {plan.name}
                            </p>
                            {plan.recommended_day_of_week !== null && plan.recommended_day_of_week !== undefined && (
                              <span className="px-2 py-0.5 text-xs font-semibold rounded bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 flex-shrink-0">
                                {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][plan.recommended_day_of_week]}
                              </span>
                            )}
                          </div>
                          <div className="ml-2 flex-shrink-0 flex">
                            <span className="text-gray-700 dark:text-gray-300">→</span>
                          </div>
                        </div>
                        {plan.description && (
                          <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                            {plan.description}
                          </p>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
