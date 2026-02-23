"use client";

interface ProgressTipsProps {
  goals: string[];
  stats: {
    completedSessions: number;
    currentStreak: number;
    longestStreak: number;
    workoutsPerWeek: number;
    avgDurationMinutes: number;
  };
}

const TIPS_BY_GOAL: Record<string, string[]> = {
  "Build muscle mass": [
    "Progressive overload is key: aim to add weight or reps each week on your main lifts.",
    "Hit each muscle group 2x per week for optimal hypertrophy.",
    "Keep rest periods 60–90 seconds for hypertrophy-focused sets.",
    "Prioritize compound movements (squats, deadlifts, bench, rows) for maximum growth.",
  ],
  "Lose weight / burn fat": [
    "Consistency beats intensity: 3–4 solid workouts per week will get you there.",
    "Add short cardio finishers (5–10 min) after strength work to boost calorie burn.",
    "Track your workouts—seeing progress keeps you motivated when the scale fluctuates.",
    "Focus on full-body workouts to maximize calorie expenditure.",
  ],
  "Increase strength": [
    "Progressive overload: aim for 1–2 more reps or 2.5–5 lbs more each session.",
    "Rest 2–3 minutes between heavy sets to recover fully.",
    "Prioritize the big lifts: squat, deadlift, bench, overhead press, row.",
    "Consider periodization: alternate heavier weeks with lighter recovery weeks.",
  ],
  "Improve cardiovascular fitness": [
    "Mix steady-state cardio with intervals for the best results.",
    "Aim for 150+ minutes of moderate cardio per week, or 75 min vigorous.",
    "Use warm-up and cooldown exercises—they count toward your cardio goals.",
    "Track duration: consistency in cardio builds your aerobic base.",
  ],
  "Increase flexibility and mobility": [
    "Add 5–10 minutes of stretching after every workout.",
    "Focus on hips, shoulders, and spine—these areas get tight from lifting.",
    "Hold static stretches 30–60 seconds for best results.",
    "Consider a dedicated mobility day or yoga session each week.",
  ],
  "Improve athletic performance": [
    "Include power movements: jumps, throws, and explosive lifts.",
    "Balance strength, cardio, and mobility in your weekly plan.",
    "Recovery is part of training: sleep and nutrition matter as much as the workout.",
    "Periodize your training: build a base, then add intensity.",
  ],
  "General health and wellness": [
    "Consistency is the most important factor—even 2–3 workouts per week makes a difference.",
    "Find activities you enjoy so exercise feels sustainable.",
    "Listen to your body: rest when you need it, push when you can.",
    "Celebrate small wins: every workout completed is progress.",
  ],
};

export default function ProgressTips({ goals, stats }: ProgressTipsProps) {
  const tipsToShow = new Set<string>();
  const goalList = goals && goals.length > 0 ? goals : ["General health and wellness"];

  for (const goal of goalList) {
    const tips = TIPS_BY_GOAL[goal];
    if (tips) {
      tips.slice(0, 2).forEach((t) => tipsToShow.add(t));
    }
  }

  // Add context-aware tips
  if (stats.completedSessions < 5) {
    tipsToShow.add("You're building the habit—keep showing up! The first few weeks set the foundation.");
  }
  if (stats.currentStreak >= 3) {
    tipsToShow.add(`Great streak! ${stats.currentStreak} days in a row. Consistency like this leads to real results.`);
  }
  if (stats.workoutsPerWeek > 0 && stats.workoutsPerWeek < 2) {
    tipsToShow.add("Consider adding one more workout per week when you're ready—small increases add up.");
  }
  if (stats.avgDurationMinutes > 0 && stats.avgDurationMinutes < 30) {
    tipsToShow.add("Short workouts count! Quality over quantity. You can gradually extend duration as you build stamina.");
  }

  const tips = Array.from(tipsToShow).slice(0, 6);

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-indigo-100 dark:border-indigo-800/60">
      <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-1 sm:mb-2">
        Tips for Your Goals
      </h3>
      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mb-3 sm:mb-4">
        Personalized advice to help you get the most out of your workouts
      </p>
      <ul className="space-y-2.5 sm:space-y-3">
        {tips.map((tip, i) => (
          <li
            key={i}
            className="flex gap-2.5 sm:gap-3 text-xs sm:text-sm text-gray-700 dark:text-gray-200"
          >
            <span className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-indigo-200 dark:bg-indigo-800/70 flex items-center justify-center text-indigo-700 dark:text-indigo-200 text-[10px] sm:text-xs font-medium">
              {i + 1}
            </span>
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
