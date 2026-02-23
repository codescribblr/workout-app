import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BackLink } from "@/components/navigation/BackLink";
import ProgressCharts from "@/components/progress/ProgressCharts";
import ProgressTips from "@/components/progress/ProgressTips";
import ProgressEncouragement from "@/components/progress/ProgressEncouragement";
import {
  aggregateWeeklyActivity,
  aggregateExerciseProgression,
  computeProgressStats,
} from "@/lib/progress/aggregate";
import type { SessionSummary, SetWithExercise } from "@/lib/progress/aggregate";

export default async function ProgressPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("goals")
    .eq("id", user.id)
    .single();

  const goals: string[] = (profile?.goals as string[]) || [];

  // Fetch completed sessions (last 90 days)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { data: sessions } = await supabase
    .from("workout_sessions")
    .select(
      `
      id,
      started_at,
      completed_at,
      duration_seconds,
      workout_plans ( name )
    `
    )
    .eq("user_id", user.id)
    .gte("started_at", ninetyDaysAgo.toISOString())
    .order("started_at", { ascending: false })
    .limit(100);

  const sessionIds = (sessions || []).map((s: any) => s.id);

  let sets: SetWithExercise[] = [];
  if (sessionIds.length > 0) {
    const { data: setsData } = await supabase
      .from("workout_sets")
      .select(
        `
        id,
        workout_session_id,
        exercise_id,
        set_number,
        reps,
        weight_lbs,
        time_minutes,
        completed_at,
        exercises ( id, name, category )
      `
      )
      .in("workout_session_id", sessionIds)
      .order("completed_at", { ascending: true });

    sets = (setsData || []) as unknown as SetWithExercise[];
  }

  const sessionSummaries: SessionSummary[] = (sessions || []).map((s: any) => ({
    id: s.id,
    started_at: s.started_at,
    completed_at: s.completed_at,
    duration_seconds: s.duration_seconds,
    plan_name: s.workout_plans?.name ?? null,
  }));

  const weeklyData = aggregateWeeklyActivity(sessionSummaries, sets);
  const exerciseProgress = aggregateExerciseProgression(sets, 5);
  const stats = computeProgressStats(sessionSummaries, sets);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <nav className="bg-white dark:bg-gray-800 shadow">
        <div className="mx-auto px-4 sm:px-6 max-w-7xl">
          <div className="flex justify-between h-14 sm:h-16 items-center">
            <div className="flex items-center min-w-0">
              <BackLink href="/dashboard" aria-label="Back to Dashboard" />
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto px-4 py-5 sm:py-6 sm:px-6 max-w-6xl">
        <div className="mb-5 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Progress
          </h1>
          <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-300">
            Track your workouts, see your growth, and stay motivated
          </p>
        </div>

        <div className="mb-5 sm:mb-6">
          <ProgressEncouragement stats={stats} />
        </div>

        <div className="flex flex-col gap-6 sm:gap-8 lg:grid lg:grid-cols-3">
          <div className="lg:col-span-2 min-w-0">
            <ProgressCharts
              weeklyData={weeklyData}
              exerciseProgress={exerciseProgress}
              stats={stats}
              goals={goals}
            />
          </div>
          <div className="min-w-0">
            <ProgressTips goals={goals} stats={stats} />
          </div>
        </div>
      </main>
    </div>
  );
}
