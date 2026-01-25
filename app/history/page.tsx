import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: sessions } = await supabase
    .from("workout_sessions")
    .select(
      `
      *,
      workout_plans (
        name
      )
    `
    )
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(50);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="text-gray-700 hover:text-gray-900">
                ← Back
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            Workout History
          </h1>
          {sessions && sessions.length > 0 ? (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {sessions.map((session: any) => (
                  <li key={session.id}>
                    <Link
                      href={`/history/${session.id}`}
                      className="block hover:bg-gray-50 px-4 py-4 sm:px-6"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div>
                            <p className="text-sm font-medium text-indigo-600">
                              {session.workout_plans?.name || "Custom Workout"}
                            </p>
                            <p className="text-sm text-gray-700">
                              {format(
                                new Date(session.started_at),
                                "MMM d, yyyy 'at' h:mm a"
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="ml-2 flex-shrink-0 flex">
                          {session.completed_at ? (
                            <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                              Completed
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
                              In Progress
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-700">No workout history yet.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
