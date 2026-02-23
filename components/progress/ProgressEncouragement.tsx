"use client";

interface ProgressEncouragementProps {
  stats: {
    completedSessions: number;
    currentStreak: number;
    longestStreak: number;
    totalVolumeLast30Days: number;
  };
}

const ENCOURAGEMENTS = [
  "Every rep counts. You're building something real.",
  "Progress isn't always linear—trust the process.",
  "Your future self will thank you for today's workout.",
  "Strong is built one set at a time.",
  "You showed up. That's the hardest part.",
  "Consistency beats perfection every time.",
  "The body achieves what the mind believes.",
  "Small steps lead to big changes.",
];

export default function ProgressEncouragement({ stats }: ProgressEncouragementProps) {
  let message = ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];

  if (stats.completedSessions === 0) {
    message = "Ready to start? Your first workout is waiting. You've got this.";
  } else if (stats.completedSessions === 1) {
    message = "First workout done! The hardest one is behind you. Keep going.";
  } else if (stats.currentStreak >= 5) {
    message = `${stats.currentStreak} days in a row—you're on fire! This is how habits become lifestyle.`;
  } else if (stats.longestStreak >= 7) {
    message = `You've hit a ${stats.longestStreak}-day streak before. You can do it again.`;
  } else if (stats.totalVolumeLast30Days > 10000) {
    message = "Over 10,000 lbs of volume this month. That's serious work. Keep pushing.";
  } else if (stats.completedSessions >= 10) {
    message = "Double-digit workouts. You're not a beginner anymore—you're building a practice.";
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow border border-gray-200 dark:border-gray-600">
      <p className="text-base sm:text-lg text-gray-800 dark:text-gray-100 italic">
        &ldquo;{message}&rdquo;
      </p>
    </div>
  );
}
