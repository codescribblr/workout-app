"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";

function NewWorkoutPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const planId = searchParams.get("plan");
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [existingSessionId, setExistingSessionId] = useState<string | null>(null);
  const [showStartChoice, setShowStartChoice] = useState(false);

  useEffect(() => {
    checkAndHandleWorkout();
  }, [planId]);

  const checkAndHandleWorkout = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    if (!planId) {
      router.push("/plans");
      return;
    }

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
      setLoading(false);
    } else {
      setShowStartChoice(true);
      setLoading(false);
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

    if (!planId) {
      router.push("/plans");
      return;
    }

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
      setLoading(false);
      return;
    }

    if (session) {
      // Store session ID in localStorage
      localStorage.setItem("activeWorkoutSessionId", session.id);
      // Redirect to workout page with session ID
      router.push(`/workouts/${session.id}`);
    }
  };

  const handleContinueExisting = () => {
    setShowDialog(false);
    if (existingSessionId) {
      localStorage.setItem("activeWorkoutSessionId", existingSessionId);
      router.push(`/workouts/${existingSessionId}`);
    }
  };

  const handleStartNew = async (coachMode: boolean) => {
    setShowDialog(false);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    if (existingSessionId) {
      await supabase
        .from("workout_sessions")
        .update({ completed_at: new Date().toISOString() })
        .eq("id", existingSessionId);
    }

    const { data: inProgressSessions } = await supabase
      .from("workout_sessions")
      .select("id")
      .eq("user_id", user.id)
      .is("completed_at", null);

    if (inProgressSessions?.length) {
      await supabase
        .from("workout_sessions")
        .update({ completed_at: new Date().toISOString() })
        .in("id", inProgressSessions.map((s) => s.id));
    }

    localStorage.removeItem("activeWorkoutSessionId");
    setLoading(true);
    await createNewWorkout(coachMode);
  };

  if (loading && !showStartChoice && !showDialog) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
        <div className="text-center">
          <p className="text-xl mb-4">Loading...</p>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white mx-auto"></div>
        </div>
      </div>
    );
  }

  if (showStartChoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900 text-gray-900 dark:text-white p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <h1 className="text-2xl font-bold">Start Workout</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Choose how you&apos;d like to work out.
          </p>
          <div className="flex flex-col gap-3">
            <Button
              onClick={async () => {
                setLoading(true);
                await createNewWorkout(true);
              }}
              variant="primary"
              size="lg"
              className="w-full"
              disabled={loading}
            >
              {loading ? "Starting..." : "Start with Coach"}
            </Button>
            <Button
              onClick={async () => {
                setLoading(true);
                await createNewWorkout(false);
              }}
              variant="outline"
              size="lg"
              className="w-full"
              disabled={loading}
            >
              Start Workout
            </Button>
            <Button
              onClick={() => router.push("/plans")}
              variant="outline"
              className="w-full"
            >
              Back to Plans
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
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
                disabled={loading}
              >
                {loading ? "Starting..." : "Start New Workout"}
              </Button>
              <Button
                onClick={() => handleStartNew(true)}
                variant="success"
                className="w-full"
                disabled={loading}
              >
                {loading ? "Starting..." : "Start New (with Coach)"}
              </Button>
              <Button
                onClick={() => router.push("/dashboard")}
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

export default function NewWorkoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
        <div className="text-center">
          <p className="text-xl mb-4">Loading...</p>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white mx-auto"></div>
        </div>
      </div>
    }>
      <NewWorkoutPageContent />
    </Suspense>
  );
}
