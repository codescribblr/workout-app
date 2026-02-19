"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";

interface HistoryDetailActionsProps {
  sessionId: string;
  isCompleted: boolean;
  startedAt: string;
}

export default function HistoryDetailActions({
  sessionId,
  isCompleted,
  startedAt,
}: HistoryDetailActionsProps) {
  const router = useRouter();
  const supabase = createClient();
  const [ending, setEnding] = useState(false);

  const handleEndWorkout = async () => {
    setEnding(true);
    try {
      const endTime = new Date().toISOString();
      const startTime = new Date(startedAt);
      const durationSeconds = Math.floor(
        (new Date(endTime).getTime() - startTime.getTime()) / 1000
      );

      const { error } = await supabase
        .from("workout_sessions")
        .update({
          completed_at: endTime,
          duration_seconds: durationSeconds,
        })
        .eq("id", sessionId);

      if (error) {
        console.error("Error ending workout:", error);
      } else {
        localStorage.removeItem("activeWorkoutSessionId");
        router.refresh();
      }
    } finally {
      setEnding(false);
    }
  };

  if (isCompleted) {
    return (
      <Link
        href={`/history/${sessionId}/edit`}
        className="px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
      >
        Edit Workout
      </Link>
    );
  }

  return (
    <Button
      variant="primary"
      size="sm"
      onClick={handleEndWorkout}
      disabled={ending}
      isLoading={ending}
    >
      {ending ? "Ending..." : "End Workout"}
    </Button>
  );
}
