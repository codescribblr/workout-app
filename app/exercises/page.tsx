import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BackLink } from "@/components/navigation/BackLink";

export default async function ExercisesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: exercises } = await supabase
    .from("exercises")
    .select("*")
    .order("name");

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white dark:bg-gray-800 shadow">
        <div className="mx-auto px-4 sm:px-6 max-w-7xl">
          <div className="flex justify-between h-14 sm:h-16 items-center">
            <div className="flex items-center">
              <BackLink href="/dashboard" />
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto px-4 py-5 sm:py-6 sm:px-6 max-w-7xl">
        <div className="sm:px-0">
          <div className="mb-5 sm:mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              Exercise Library
            </h1>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {exercises?.map((exercise) => (
              <div
                key={exercise.id}
                className="bg-white shadow rounded-lg p-6 hover:shadow-lg transition"
              >
                <h3 className="text-lg font-semibold text-gray-900">
                  {exercise.name}
                </h3>
                <p className="text-sm text-gray-700 mt-1 capitalize">
                  {exercise.category}
                </p>
                {exercise.muscle_groups && (
                  <div className="mt-2">
                    <span className="text-xs text-gray-700">
                      {exercise.muscle_groups.join(", ")}
                    </span>
                  </div>
                )}
                {exercise.description && (
                  <p className="text-sm text-gray-800 mt-2">
                    {exercise.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
