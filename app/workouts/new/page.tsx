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
      // Found in-progress workout - show dialog
      setExistingSessionId(activeSession.id);
      setShowDialog(true);
      setLoading(false);
    } else {
      // No in-progress workout - create new one
      await createNewWorkout();
    }
  };

  const createNewWorkout = async () => {
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

    // Create new workout session
    const { data: session, error: sessionError } = await supabase
      .from("workout_sessions")
      .insert({
        user_id: user.id,
        workout_plan_id: planId,
        started_at: new Date().toISOString(),
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

  const handleStartNew = async () => {
    setShowDialog(false);
    
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    // Complete existing in-progress workout
    if (existingSessionId) {
      const endTime = new Date().toISOString();
      await supabase
        .from("workout_sessions")
        .update({ completed_at: endTime })
        .eq("id", existingSessionId);
    }

    // Complete any other in-progress workouts
    const { data: inProgressSessions } = await supabase
      .from("workout_sessions")
      .select("id")
      .eq("user_id", user.id)
      .is("completed_at", null);

    if (inProgressSessions && inProgressSessions.length > 0) {
      const endTime = new Date().toISOString();
      const sessionIds = inProgressSessions.map(s => s.id);
      
      await supabase
        .from("workout_sessions")
        .update({ completed_at: endTime })
        .in("id", sessionIds);
    }

    localStorage.removeItem("activeWorkoutSessionId");
    
    // Create new workout
    await createNewWorkout();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
        <div className="text-center">
          <p className="text-xl mb-4">Loading...</p>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white mx-auto"></div>
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
                onClick={handleStartNew}
                variant="primary"
                className="w-full"
              >
                Start New Workout
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
