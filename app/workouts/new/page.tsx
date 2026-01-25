"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { speakText } from "@/lib/audio/tts";
import { useHeadphoneButtons } from "@/hooks/useHeadphoneButtons";
import { useVoiceInput } from "@/hooks/useVoiceInput";

interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps_min: number;
  reps_max: number;
  weight_kg: number | null;
  rest_seconds: number;
  order_index: number;
}

export default function NewWorkoutPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const planId = searchParams.get("plan");
  const supabase = createClient();

  const [plan, setPlan] = useState<any>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [restTime, setRestTime] = useState(0);
  const [userPreferences, setUserPreferences] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPlan();
    loadPreferences();
  }, [planId]);

  useEffect(() => {
    if (exercises.length > 0 && currentExerciseIndex < exercises.length) {
      announceCurrentExercise();
    }
  }, [currentExerciseIndex, exercises]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (restTime > 0 && !isPaused) {
      interval = setInterval(() => {
        setRestTime((t) => {
          if (t <= 1) {
            announceNextSet();
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [restTime, isPaused]);

  const loadPlan = async () => {
    if (!planId) {
      setError("No workout plan selected");
      setLoading(false);
      return;
    }

    try {
      const { data: planData, error: planError } = await supabase
        .from("workout_plans")
        .select("*")
        .eq("id", planId)
        .single();

      if (planError) {
        console.error("Error loading plan:", planError);
        setError(`Failed to load workout plan: ${planError.message}`);
        setLoading(false);
        return;
      }

      if (!planData) {
        setError("Workout plan not found");
        setLoading(false);
        return;
      }

      setPlan(planData);

      const { data: exercisesData, error: exercisesError } = await supabase
        .from("workout_plan_exercises")
        .select(
          `
          *,
          exercises (
            id,
            name
          )
        `
        )
        .eq("workout_plan_id", planId)
        .order("order_index");

      if (exercisesError) {
        console.error("Error loading exercises:", exercisesError);
        setError(`Failed to load exercises: ${exercisesError.message}`);
        setLoading(false);
        return;
      }

      if (!exercisesData || exercisesData.length === 0) {
        setError("This workout plan has no exercises. Please add exercises to the plan first.");
        setLoading(false);
        return;
      }

      const formatted = exercisesData.map((pe: any) => {
        if (!pe.exercises) {
          console.error("Exercise data missing for:", pe);
          return null;
        }
        // Handle variable sets - use sets_max if available, otherwise use sets
        const targetSets = pe.sets_max && pe.sets_max > pe.sets ? pe.sets_max : pe.sets;
        // Handle "Max" reps (stored as 999)
        const targetRepsMax = pe.reps_max === 999 ? pe.reps_min : pe.reps_max;
        
        return {
          id: pe.exercises.id,
          name: pe.exercises.name,
          sets: targetSets,
          reps_min: pe.reps_min,
          reps_max: targetRepsMax,
          weight_kg: pe.weight_kg,
          rest_seconds: pe.rest_seconds,
          order_index: pe.order_index,
        };
      }).filter((e): e is Exercise => e !== null);

      if (formatted.length === 0) {
        setError("No valid exercises found in this workout plan.");
        setLoading(false);
        return;
      }

      setExercises(formatted);
      await startWorkout();
      setLoading(false);
    } catch (err) {
      console.error("Unexpected error loading plan:", err);
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  const loadPreferences = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("preferences")
        .eq("id", user.id)
        .single();
      if (profile?.preferences) {
        setUserPreferences(profile.preferences);
      }
    }
  };

  const startWorkout = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      console.error("No user found");
      return;
    }

    const { data: session, error: sessionError } = await supabase
      .from("workout_sessions")
      .insert({
        user_id: user.id,
        workout_plan_id: planId || null,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (sessionError) {
      console.error("Error creating workout session:", sessionError);
      setError(`Failed to start workout session: ${sessionError.message}`);
      return;
    }

    if (session) {
      setSessionId(session.id);
    }
  };

  const announceCurrentExercise = async () => {
    if (exercises.length === 0) return;
    const exercise = exercises[currentExerciseIndex];
    const text = `Exercise ${currentExerciseIndex + 1}: ${exercise.name}. Set ${currentSet} of ${exercise.sets}. Target: ${exercise.reps_min} to ${exercise.reps_max} reps${exercise.weight_kg ? ` at ${exercise.weight_kg} kilograms` : ""}.`;
    await speakText(text, userPreferences?.audio);
  };

  const announceNextSet = async () => {
    if (exercises.length === 0) return;
    const exercise = exercises[currentExerciseIndex];
    if (currentSet < exercise.sets) {
      const text = `Set ${currentSet + 1} of ${exercise.sets}. Ready?`;
      await speakText(text, userPreferences?.audio);
    } else if (currentExerciseIndex < exercises.length - 1) {
      const nextExercise = exercises[currentExerciseIndex + 1];
      const text = `Moving to ${nextExercise.name}. Rest for ${nextExercise.rest_seconds} seconds.`;
      await speakText(text, userPreferences?.audio);
    }
  };

  const handleButtonAction = async (action: string) => {
    switch (action) {
      case "pause_resume":
        setIsPaused(!isPaused);
        await speakText(
          isPaused ? "Workout resumed" : "Workout paused",
          userPreferences?.audio
        );
        break;
      case "next_set":
        completeSet();
        break;
      case "voice_input":
        // Trigger voice input
        break;
    }
  };

  const buttonMappings =
    userPreferences?.headphones?.button_mappings || {};

  useHeadphoneButtons(buttonMappings, handleButtonAction);

  const { startListening, isListening } = useVoiceInput(async (text) => {
    // Parse voice input for reps/weight
    console.log("Voice input:", text);
    // Simple parsing - can be enhanced
    const repsMatch = text.match(/(\d+)\s*reps?/i);
    const weightMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilos|kilograms)/i);
    if (repsMatch || weightMatch) {
      await saveSet(
        repsMatch ? parseInt(repsMatch[1]) : null,
        weightMatch ? parseFloat(weightMatch[1]) : null
      );
    }
  });

  const completeSet = async () => {
    await saveSet();
  };

  const saveSet = async (reps?: number | null, weight?: number | null) => {
    if (!sessionId || exercises.length === 0) return;

    const exercise = exercises[currentExerciseIndex];
    const weightToSave = weight || exercise.weight_kg;

    await supabase.from("workout_sets").insert({
      workout_session_id: sessionId,
      exercise_id: exercise.id,
      set_number: currentSet,
      reps: reps || exercise.reps_min,
      weight_kg: weightToSave,
      rest_seconds: exercise.rest_seconds,
    });

    if (currentSet < exercise.sets) {
      setCurrentSet(currentSet + 1);
      setRestTime(exercise.rest_seconds);
      await announceNextSet();
    } else {
      // Move to next exercise
      if (currentExerciseIndex < exercises.length - 1) {
        setCurrentExerciseIndex(currentExerciseIndex + 1);
        setCurrentSet(1);
        const nextExercise = exercises[currentExerciseIndex + 1];
        setRestTime(nextExercise.rest_seconds);
      } else {
        // Workout complete
        await completeWorkout();
      }
    }
  };

  const completeWorkout = async () => {
    if (!sessionId) return;

    const endTime = new Date().toISOString();
    await supabase
      .from("workout_sessions")
      .update({
        completed_at: endTime,
      })
      .eq("id", sessionId);

    await speakText("Workout complete! Great job!", userPreferences?.audio);
    router.push("/history");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <p className="text-xl mb-4">Loading workout...</p>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center max-w-md">
          <p className="text-xl mb-4 text-red-400">{error}</p>
          <button
            onClick={() => router.push("/plans")}
            className="px-6 py-3 bg-indigo-600 rounded-lg hover:bg-indigo-700"
          >
            Back to Plans
          </button>
        </div>
      </div>
    );
  }

  if (exercises.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <p className="text-xl mb-4">No exercises found in this workout plan.</p>
          <button
            onClick={() => router.push("/plans")}
            className="px-6 py-3 bg-indigo-600 rounded-lg hover:bg-indigo-700"
          >
            Back to Plans
          </button>
        </div>
      </div>
    );
  }

  const currentExercise = exercises[currentExerciseIndex];

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">{plan?.name}</h1>
          <p className="text-gray-400">
            Exercise {currentExerciseIndex + 1} of {exercises.length}
          </p>
        </div>

        <div className="bg-gray-800 rounded-lg p-8 mb-6">
          <h2 className="text-2xl font-bold mb-4">{currentExercise.name}</h2>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-gray-400">Set</p>
              <p className="text-3xl font-bold">
                {currentSet} / {currentExercise.sets}
              </p>
            </div>
            <div>
              <p className="text-gray-400">Target Reps</p>
              <p className="text-3xl font-bold">
                {currentExercise.reps_min}
                {currentExercise.reps_max !== currentExercise.reps_min
                  ? `-${currentExercise.reps_max}`
                  : ""}
              </p>
            </div>
          </div>
          {currentExercise.weight_kg && (
            <div className="mt-4 text-center">
              <p className="text-gray-400">Weight</p>
              <p className="text-2xl font-bold">{currentExercise.weight_kg} kg</p>
            </div>
          )}
        </div>

        {restTime > 0 && (
          <div className="bg-blue-900 rounded-lg p-6 mb-6 text-center">
            <p className="text-lg mb-2">Rest Time</p>
            <p className="text-4xl font-bold">{restTime}s</p>
          </div>
        )}

        <div className="flex justify-center space-x-4">
          <button
            onClick={() => handleButtonAction("pause_resume")}
            className="px-6 py-3 bg-gray-700 rounded-lg hover:bg-gray-600"
          >
            {isPaused ? "Resume" : "Pause"}
          </button>
          <button
            onClick={completeSet}
            className="px-6 py-3 bg-indigo-600 rounded-lg hover:bg-indigo-700"
          >
            Complete Set
          </button>
          <button
            onClick={startListening}
            disabled={isListening}
            className="px-6 py-3 bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {isListening ? "Listening..." : "Voice Input"}
          </button>
        </div>

        <div className="mt-8 text-center text-sm text-gray-400">
          <p>Use headphone buttons to control workout</p>
        </div>
      </div>
    </div>
  );
}
