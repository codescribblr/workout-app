import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ContinueWorkoutButton from "@/components/workout/ContinueWorkoutButton";
import DashboardCards from "@/components/dashboard/DashboardCards";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get total count for the dashboard card
  const { count: totalWorkoutsCount } = await supabase
    .from("workout_sessions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <nav className="bg-white dark:bg-gray-800 shadow">
        <div className="mx-auto px-4 sm:px-6 max-w-7xl">
          <div className="flex justify-between h-14 sm:h-16 items-center">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Workout Tracker</h1>
            </div>
            <div className="flex items-center">
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

      <main className="max-w-7xl mx-auto pt-6 pb-6 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">
          <div className="mb-6">
            <ContinueWorkoutButton />
          </div>

          <DashboardCards totalWorkoutsCount={totalWorkoutsCount ?? 0} />
        </div>
      </main>
    </div>
  );
}
