"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";

interface ContinueWorkoutButtonProps {
  planId?: string; // Optional: if provided, only show if active workout is for this plan
}

export default function ContinueWorkoutButton({ planId }: ContinueWorkoutButtonProps) {
  const [hasActiveWorkout, setHasActiveWorkout] = useState(false);
  const [workoutPlanId, setWorkoutPlanId] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    checkActiveWorkout();
  }, [planId]);

  const checkActiveWorkout = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    // Check localStorage first
    const storedSessionId = localStorage.getItem("activeWorkoutSessionId");
    
    if (storedSessionId) {
      // Verify session still exists and is active
      const { data: session } = await supabase
        .from("workout_sessions")
        .select("workout_plan_id")
        .eq("id", storedSessionId)
        .eq("user_id", user.id)
        .is("completed_at", null)
        .single();

      if (session) {
        // If planId is provided, only show if it matches
        if (planId && session.workout_plan_id !== planId) {
          setHasActiveWorkout(false);
          return;
        }
        setHasActiveWorkout(true);
        setWorkoutPlanId(session.workout_plan_id);
        return;
      } else {
        localStorage.removeItem("activeWorkoutSessionId");
      }
    }

    // Also check database for any in-progress workouts
    let query = supabase
      .from("workout_sessions")
      .select("id, workout_plan_id")
      .eq("user_id", user.id)
      .is("completed_at", null)
      .order("started_at", { ascending: false })
      .limit(1);
    
    // If planId provided, filter by plan
    if (planId) {
      query = query.eq("workout_plan_id", planId);
    }
    
    const { data: activeSession } = await query.maybeSingle();

    if (activeSession) {
      setHasActiveWorkout(true);
      setWorkoutPlanId(activeSession.workout_plan_id);
      // Update localStorage
      localStorage.setItem("activeWorkoutSessionId", activeSession.id);
    }
  };

  const handleContinue = () => {
    if (workoutPlanId) {
      router.push(`/workouts/new?plan=${workoutPlanId}`);
    } else {
      router.push("/workouts/new");
    }
  };

  if (!hasActiveWorkout) {
    return null;
  }

  return (
    <Button onClick={handleContinue} variant="success" size="lg" className="w-full">
      Continue Last Workout
    </Button>
  );
}
