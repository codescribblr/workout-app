"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";

export default function StartWorkoutButton({ planId }: { planId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [showDialog, setShowDialog] = useState(false);
  const [existingSessionId, setExistingSessionId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const checkForInProgressWorkout = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    // Check for any in-progress workouts
    const { data: activeSession } = await supabase
      .from("workout_sessions")
      .select("id")
      .eq("user_id", user.id)
      .is("completed_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeSession) {
      setExistingSessionId(activeSession.id);
      setShowDialog(true);
      return true;
    }

    return false;
  };

  const handleStart = async (coachMode: boolean) => {
    const hasInProgress = await checkForInProgressWorkout();

    if (!hasInProgress) {
      await createNewWorkout(coachMode);
    }
  };

  const createNewWorkout = async (coachMode: boolean = false) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    // Complete any existing in-progress workouts
    await completeInProgressWorkouts(user.id);

    // Create new workout session (coach_mode enables AI assessment + mid-workout coaching)
    const { data: session, error: sessionError } = await supabase
      .from("workout_sessions")
      .insert({
        user_id: user.id,
        workout_plan_id: planId,
        started_at: new Date().toISOString(),
        coach_mode: coachMode,
      })
      .select()
      .single();

    if (sessionError) {
      console.error("Error creating workout session:", sessionError);
      alert("Failed to create workout session. Please try again.");
      throw sessionError;
    }

    if (!session || !session.id) {
      console.error("No session created");
      alert("Failed to create workout session. Please try again.");
      return;
    }

    // Store session ID in localStorage
    localStorage.setItem("activeWorkoutSessionId", session.id);
    // Redirect to workout page with session ID
    // Use router.replace to avoid prefetching issues
    router.replace(`/workouts/${session.id}`);
  };

  const completeInProgressWorkouts = async (userId: string) => {
    const { data: inProgressSessions } = await supabase
      .from("workout_sessions")
      .select("id")
      .eq("user_id", userId)
      .is("completed_at", null);

    if (inProgressSessions && inProgressSessions.length > 0) {
      const endTime = new Date().toISOString();
      const sessionIds = inProgressSessions.map(s => s.id);
      
      await supabase
        .from("workout_sessions")
        .update({ completed_at: endTime })
        .in("id", sessionIds);
      
      localStorage.removeItem("activeWorkoutSessionId");
    }
  };

  const handleContinueExisting = () => {
    if (existingSessionId) {
      localStorage.setItem("activeWorkoutSessionId", existingSessionId);
      // Use router.replace for client-side navigation
      router.replace(`/workouts/${existingSessionId}`);
    }
  };

  const handleStartNew = async (coachMode: boolean) => {
    setIsCreating(true);
    try {
      await createNewWorkout(coachMode);
    } catch (error) {
      console.error("Error starting new workout:", error);
      alert("Failed to start new workout. Please try again.");
      setIsCreating(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-2">
        <Button
          onClick={() => handleStart(true)}
          variant="primary"
          size="lg"
          disabled={isCreating}
        >
          {isCreating ? "Starting..." : "Start with Coach"}
        </Button>
        <Button
          onClick={() => handleStart(false)}
          variant="outline"
          size="lg"
          disabled={isCreating}
        >
          Start Workout
        </Button>
      </div>

      {showDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-xl font-bold mb-4">Workout Already in Progress</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              You have a workout in progress. Would you like to continue that workout or start a new one?
            </p>
            <div className="flex flex-col space-y-3">
              <Button
                onClick={handleContinueExisting}
                variant="success"
                className="w-full"
              >
                Continue Existing Workout
              </Button>
              <Button
                onClick={() => handleStartNew(false)}
                variant="primary"
                className="w-full"
                disabled={isCreating}
                isLoading={isCreating}
              >
                {isCreating ? "Starting..." : "Start New Workout"}
              </Button>
              <Button
                onClick={() => handleStartNew(true)}
                variant="success"
                className="w-full"
                disabled={isCreating}
              >
                {isCreating ? "Starting..." : "Start New (with Coach)"}
              </Button>
              <Button
                onClick={() => setShowDialog(false)}
                variant="outline"
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
