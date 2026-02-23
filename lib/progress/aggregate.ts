/**
 * Aggregation utilities for progress reports.
 * Transforms raw workout data into chart-ready series and summary stats.
 */

export interface SessionSummary {
  id: string;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  plan_name: string | null;
}

export interface SetWithExercise {
  id: string;
  workout_session_id: string;
  exercise_id: string;
  set_number: number;
  reps: number | null;
  weight_lbs: number | null;
  time_minutes: number | null;
  completed_at: string;
  exercises?: {
    id: string;
    name: string;
    category: string | null;
  } | null;
}

export interface WeeklyActivity {
  weekStart: string;
  weekEnd: string;
  label: string;
  sessions: number;
  totalDurationMinutes: number;
  totalSets: number;
  totalVolume: number; // reps * weight for strength sets
}

export interface ExerciseProgression {
  exerciseId: string;
  exerciseName: string;
  dataPoints: { date: string; sessionId: string; bestWeight: number; bestReps: number; totalVolume: number }[];
}

export interface ProgressStats {
  totalSessions: number;
  completedSessions: number;
  currentStreak: number;
  longestStreak: number;
  avgDurationMinutes: number;
  totalVolumeLast30Days: number;
  workoutsPerWeek: number;
}

const STRENGTH_CATEGORIES = ["strength", "power", "hypertrophy"];
const CARDIO_CATEGORIES = ["cardio", "aerobic"];
const SKIP_CATEGORIES = ["warmup", "cooldown"];

function isStrengthExercise(category: string | null | undefined): boolean {
  if (!category) return true; // assume strength if unknown
  return STRENGTH_CATEGORIES.includes(category.toLowerCase()) || !SKIP_CATEGORIES.includes(category.toLowerCase());
}

function isCardioExercise(category: string | null | undefined): boolean {
  if (!category) return false;
  return CARDIO_CATEGORIES.includes(category.toLowerCase());
}

export function aggregateWeeklyActivity(
  sessions: SessionSummary[],
  sets: SetWithExercise[]
): WeeklyActivity[] {
  const weekMap = new Map<string, WeeklyActivity>();

  const addToWeek = (dateStr: string, session: SessionSummary, sessionSets: SetWithExercise[]) => {
    const d = new Date(dateStr);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const key = weekStart.toISOString().slice(0, 10);

    if (!weekMap.has(key)) {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekMap.set(key, {
        weekStart: key,
        weekEnd: weekEnd.toISOString().slice(0, 10),
        label: `Week of ${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
        sessions: 0,
        totalDurationMinutes: 0,
        totalSets: 0,
        totalVolume: 0,
      });
    }

    const w = weekMap.get(key)!;
    w.sessions += 1;
    w.totalDurationMinutes += (session.duration_seconds || 0) / 60;

    let vol = 0;
    let setCount = 0;
    for (const s of sessionSets) {
      const cat = s.exercises?.category;
      if (SKIP_CATEGORIES.includes(cat || "")) continue;
      setCount++;
      if (s.reps != null && s.weight_lbs != null && s.weight_lbs > 0) {
        vol += s.reps * s.weight_lbs;
      } else if (s.time_minutes != null && isCardioExercise(cat)) {
        vol += s.time_minutes * 10; // rough cardio "volume" proxy
      }
    }
    w.totalSets += setCount;
    w.totalVolume += vol;
  };

  for (const session of sessions) {
    const dateStr = session.completed_at || session.started_at;
    if (!dateStr) continue;
    const sessionSets = sets.filter((s) => s.workout_session_id === session.id);
    addToWeek(dateStr, session, sessionSets);
  }

  return Array.from(weekMap.values()).sort(
    (a, b) => new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime()
  );
}

export function aggregateExerciseProgression(
  sets: SetWithExercise[],
  limitExercises = 5
): ExerciseProgression[] {
  const byExercise = new Map<string, SetWithExercise[]>();
  for (const s of sets) {
    const cat = s.exercises?.category;
    if (SKIP_CATEGORIES.includes(cat || "")) continue;
    if (!isStrengthExercise(cat)) continue;
    if (s.weight_lbs == null || s.weight_lbs <= 0) continue;

    const id = s.exercise_id;
    if (!byExercise.has(id)) byExercise.set(id, []);
    byExercise.get(id)!.push(s);
  }

  const result: ExerciseProgression[] = [];
  for (const [exerciseId, exerciseSets] of byExercise) {
    const bySession = new Map<string, SetWithExercise[]>();
    for (const s of exerciseSets) {
      const sid = s.workout_session_id;
      if (!bySession.has(sid)) bySession.set(sid, []);
      bySession.get(sid)!.push(s);
    }

    const dataPoints: ExerciseProgression["dataPoints"] = [];
    for (const [, sessionSets] of bySession) {
      const dateStr = sessionSets[0]?.completed_at?.slice(0, 10) || "";
      let bestWeight = 0;
      let bestReps = 0;
      let totalVolume = 0;
      for (const s of sessionSets) {
        const w = s.weight_lbs || 0;
        const r = s.reps || 0;
        if (w > bestWeight) bestWeight = w;
        if (r > bestReps) bestReps = r;
        totalVolume += r * w;
      }
      dataPoints.push({
        date: dateStr,
        sessionId: sessionSets[0]?.workout_session_id || "",
        bestWeight,
        bestReps,
        totalVolume,
      });
    }

    dataPoints.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const name = exerciseSets[0]?.exercises?.name || "Unknown";
    result.push({ exerciseId, exerciseName: name, dataPoints });
  }

  // Sort by most data points (most trained), take top N
  result.sort((a, b) => b.dataPoints.length - a.dataPoints.length);
  return result.slice(0, limitExercises);
}

export function computeProgressStats(
  sessions: SessionSummary[],
  sets: SetWithExercise[]
): ProgressStats {
  const completed = sessions.filter((s) => s.completed_at);
  const sortedDates = completed
    .map((s) => (s.completed_at || s.started_at).slice(0, 10))
    .filter(Boolean)
    .sort();

  const uniqueDates = [...new Set(sortedDates)].sort();

  let currentStreak = 0;
  let longestStreak = 0;
  let run = 0;
  const today = new Date().toISOString().slice(0, 10);

  for (let i = uniqueDates.length - 1; i >= 0; i--) {
    const d = uniqueDates[i];
    const expected = new Date(today);
    expected.setDate(expected.getDate() - (uniqueDates.length - 1 - i));
    const expectedStr = expected.toISOString().slice(0, 10);
    if (d === expectedStr || (i === uniqueDates.length - 1 && d <= today)) {
      run++;
      if (i === uniqueDates.length - 1) currentStreak = run;
      longestStreak = Math.max(longestStreak, run);
    } else {
      run = 0;
    }
  }

  const totalDuration = completed.reduce((acc, s) => acc + (s.duration_seconds || 0), 0);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  let totalVolume30 = 0;
  for (const s of sets) {
    const session = sessions.find((se) => se.id === s.workout_session_id);
    if (!session) continue;
    const dateStr = session.completed_at || session.started_at;
    if (!dateStr || new Date(dateStr) < thirtyDaysAgo) continue;
    const cat = s.exercises?.category;
    if (SKIP_CATEGORIES.includes(cat || "")) continue;
    if (s.reps != null && s.weight_lbs != null && s.weight_lbs > 0) {
      totalVolume30 += s.reps * s.weight_lbs;
    }
  }

  const weeksWithData = new Set(
    completed.map((s) => {
      const d = new Date(s.completed_at || s.started_at);
      d.setDate(d.getDate() - d.getDay());
      return d.toISOString().slice(0, 10);
    })
  ).size;
  const firstDate = uniqueDates[0];
  const totalWeeks = firstDate
    ? Math.max(1, Math.ceil((new Date(today).getTime() - new Date(firstDate).getTime()) / (7 * 24 * 60 * 60 * 1000)))
    : 0;

  return {
    totalSessions: sessions.length,
    completedSessions: completed.length,
    currentStreak,
    longestStreak,
    avgDurationMinutes: completed.length ? Math.round(totalDuration / 60 / completed.length) : 0,
    totalVolumeLast30Days: Math.round(totalVolume30),
    workoutsPerWeek: totalWeeks > 0 ? Math.round((completed.length / totalWeeks) * 10) / 10 : 0,
  };
}
