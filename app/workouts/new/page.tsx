"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { speakText } from "@/lib/audio/tts";
import { useHeadphoneButtons } from "@/hooks/useHeadphoneButtons";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import Button from "@/components/ui/Button";

interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps_min: number;
  reps_max: number;
  weight_lbs: number | null;
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
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);
  const [restTime, setRestTime] = useState(0);
  const [userPreferences, setUserPreferences] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasAnnouncedRef = useRef(false);
  const lastAnnouncedIndexRef = useRef<number>(-1);

  useEffect(() => {
    checkForExistingWorkout();
    loadPreferences();
    
    // Cleanup timeout on unmount
    return () => {
      if (voiceInputTimeoutRef.current) {
        clearTimeout(voiceInputTimeoutRef.current);
      }
    };
  }, [planId]);

  const checkForExistingWorkout = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    
    if (!user) {
      router.push("/login");
      return;
    }

    // Check localStorage for active session
    const storedSessionId = localStorage.getItem("activeWorkoutSessionId");
    
    if (storedSessionId) {
      // Check if session still exists and is not completed
      const { data: session } = await supabase
        .from("workout_sessions")
        .select("*")
        .eq("id", storedSessionId)
        .eq("user_id", user.id)
        .is("completed_at", null)
        .single();
      
      if (session) {
        // Resume existing workout
        setSessionId(session.id);
        setSessionStartedAt(session.started_at);
        await loadWorkoutState(session.id, session.workout_plan_id);
        return;
      } else {
        // Session doesn't exist or is completed, clear localStorage
        localStorage.removeItem("activeWorkoutSessionId");
      }
    }

    // No existing workout, start new one
    if (planId) {
      await loadPlan();
    } else {
      setError("No workout plan selected");
      setLoading(false);
    }
  };

  const loadWorkoutState = async (sessionId: string, planId: string | null) => {
    if (!planId) {
      setError("Cannot resume workout without plan ID");
      setLoading(false);
      return;
    }

    try {
      // Load plan
      const { data: planData, error: planError } = await supabase
        .from("workout_plans")
        .select("*")
        .eq("id", planId)
        .single();

      if (planError || !planData) {
        setError("Workout plan not found");
        setLoading(false);
        return;
      }

      setPlan(planData);

      // Load exercises
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

      if (exercisesError || !exercisesData || exercisesData.length === 0) {
        setError("No exercises found in this workout plan");
        setLoading(false);
        return;
      }

      const formatted = exercisesData.map((pe: any) => {
        if (!pe.exercises) return null;
        const targetSets = pe.sets_max && pe.sets_max > pe.sets ? pe.sets_max : pe.sets;
        const targetRepsMax = pe.reps_max === 999 ? pe.reps_min : pe.reps_max;
        
        return {
          id: pe.exercises.id,
          name: pe.exercises.name,
          sets: targetSets,
          reps_min: pe.reps_min,
          reps_max: targetRepsMax,
          weight_lbs: (pe as any).weight_lbs,
          rest_seconds: pe.rest_seconds,
          order_index: pe.order_index,
        };
      }).filter((e): e is Exercise => e !== null);

      if (formatted.length === 0) {
        setError("No valid exercises found");
        setLoading(false);
        return;
      }

      setExercises(formatted);

      // Load completed sets to determine current position
      const { data: completedSets } = await supabase
        .from("workout_sets")
        .select("exercise_id, set_number")
        .eq("workout_session_id", sessionId)
        .order("completed_at", { ascending: true });

      // Determine current exercise and set based on completed sets
      let currentExIndex = 0;
      let currentSetNum = 1;

      if (completedSets && completedSets.length > 0) {
        // Find the last completed set
        const lastSet = completedSets[completedSets.length - 1];
        const lastExerciseId = lastSet.exercise_id;
        
        // Find exercise index
        const exerciseIndex = formatted.findIndex(e => e.id === lastExerciseId);
        if (exerciseIndex !== -1) {
          const exercise = formatted[exerciseIndex];
          const setsForExercise = completedSets.filter(s => s.exercise_id === lastExerciseId);
          
          if (setsForExercise.length >= exercise.sets) {
            // All sets completed for this exercise, move to next
            if (exerciseIndex < formatted.length - 1) {
              currentExIndex = exerciseIndex + 1;
              currentSetNum = 1;
            } else {
              // All exercises completed
              currentExIndex = formatted.length;
            }
          } else {
            // Still working on this exercise
            currentExIndex = exerciseIndex;
            currentSetNum = setsForExercise.length + 1;
          }
        }
      }

      // Check if workout is already complete
      if (currentExIndex >= formatted.length) {
        await completeWorkout();
        return;
      }

      setCurrentExerciseIndex(currentExIndex);
      setCurrentSet(currentSetNum);
      setLoading(false);
    } catch (err) {
      console.error("Error loading workout state:", err);
      setError("Failed to load workout state");
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only announce if:
    // 1. We have exercises loaded
    // 2. User preferences are loaded (for TTS settings)
    // 3. The exercise index actually changed (not just exercises array reference)
    // 4. We haven't already announced for this index
    if (
      exercises.length > 0 &&
      currentExerciseIndex < exercises.length &&
      userPreferences !== null &&
      (lastAnnouncedIndexRef.current !== currentExerciseIndex || !hasAnnouncedRef.current)
    ) {
      hasAnnouncedRef.current = true;
      lastAnnouncedIndexRef.current = currentExerciseIndex;
      announceCurrentExercise();
    }
  }, [currentExerciseIndex, exercises.length, userPreferences]);

  const [isResting, setIsResting] = useState(false);
  const restAnnouncedRef = useRef(false);
  const [awaitingSetInput, setAwaitingSetInput] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualReps, setManualReps] = useState<number | null>(null);
  const [manualWeight, setManualWeight] = useState<number | null>(null);
  const voiceInputTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const nextSetAnnouncedRef = useRef(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (restTime > 0 && !isPaused) {
      interval = setInterval(() => {
        setRestTime((t) => {
          if (t <= 1) {
            // Rest period ended - announce next set
            handleRestEnd();
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
          weight_lbs: (pe as any).weight_lbs,
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

  const loadWorkoutState = async (sessionId: string, planId: string | null) => {
    if (!planId) {
      setError("Cannot resume workout without plan ID");
      setLoading(false);
      return;
    }

    try {
      // Load plan
      const { data: planData, error: planError } = await supabase
        .from("workout_plans")
        .select("*")
        .eq("id", planId)
        .single();

      if (planError || !planData) {
        setError("Workout plan not found");
        setLoading(false);
        return;
      }

      setPlan(planData);

      // Load exercises
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

      if (exercisesError || !exercisesData || exercisesData.length === 0) {
        setError("No exercises found in this workout plan");
        setLoading(false);
        return;
      }

      const formatted = exercisesData.map((pe: any) => {
        if (!pe.exercises) return null;
        const targetSets = pe.sets_max && pe.sets_max > pe.sets ? pe.sets_max : pe.sets;
        const targetRepsMax = pe.reps_max === 999 ? pe.reps_min : pe.reps_max;
        
        return {
          id: pe.exercises.id,
          name: pe.exercises.name,
          sets: targetSets,
          reps_min: pe.reps_min,
          reps_max: targetRepsMax,
          weight_lbs: (pe as any).weight_lbs,
          rest_seconds: pe.rest_seconds,
          order_index: pe.order_index,
        };
      }).filter((e): e is Exercise => e !== null);

      if (formatted.length === 0) {
        setError("No valid exercises found");
        setLoading(false);
        return;
      }

      setExercises(formatted);

      // Load completed sets to determine current position
      const { data: completedSets } = await supabase
        .from("workout_sets")
        .select("exercise_id, set_number")
        .eq("workout_session_id", sessionId)
        .order("completed_at", { ascending: true });

      // Determine current exercise and set based on completed sets
      let currentExIndex = 0;
      let currentSetNum = 1;

      if (completedSets && completedSets.length > 0) {
        // Find the last completed set
        const lastSet = completedSets[completedSets.length - 1];
        const lastExerciseId = lastSet.exercise_id;
        
        // Find exercise index
        const exerciseIndex = formatted.findIndex(e => e.id === lastExerciseId);
        if (exerciseIndex !== -1) {
          const exercise = formatted[exerciseIndex];
          const setsForExercise = completedSets.filter(s => s.exercise_id === lastExerciseId);
          
          if (setsForExercise.length >= exercise.sets) {
            // All sets completed for this exercise, move to next
            if (exerciseIndex < formatted.length - 1) {
              currentExIndex = exerciseIndex + 1;
              currentSetNum = 1;
            } else {
              // All exercises completed
              currentExIndex = formatted.length;
            }
          } else {
            // Still working on this exercise
            currentExIndex = exerciseIndex;
            currentSetNum = setsForExercise.length + 1;
          }
        }
      }

      // Check if workout is already complete
      if (currentExIndex >= formatted.length) {
        await completeWorkout();
        return;
      }

      setCurrentExerciseIndex(currentExIndex);
      setCurrentSet(currentSetNum);
      setLoading(false);
    } catch (err) {
      console.error("Error loading workout state:", err);
      setError("Failed to load workout state");
      setLoading(false);
    }
  };

  const loadPreferences = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      // Select all fields to avoid 406 error with JSONB fields
      const { data: profile, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle(); // Use maybeSingle instead of single to handle missing rows
      
      const defaultPreferences = {
        audio: {
          tts_provider: "openai",
          voice_id: "alloy",
          speech_rate: 1.0,
          volume: 0.8,
        },
      };
      
      if (error) {
        console.error("Error loading preferences:", error);
        // Set default preferences if error occurs
        setUserPreferences(defaultPreferences);
        return;
      }
      
      if (profile?.preferences) {
        setUserPreferences(profile.preferences);
      } else {
        // Profile exists but has no preferences, or profile doesn't exist
        // Use upsert to handle both cases without conflicts
        const { error: upsertError } = await supabase
          .from("user_profiles")
          .upsert({
            id: user.id,
            preferences: defaultPreferences,
          }, {
            onConflict: "id",
          });
        
        if (upsertError) {
          console.error("Error upserting profile:", upsertError);
        }
        
        setUserPreferences(defaultPreferences);
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

    // Complete any existing in-progress workouts (except the one we might be resuming)
    const storedSessionId = localStorage.getItem("activeWorkoutSessionId");
    await completeInProgressWorkouts(user.id, storedSessionId);

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
        setSessionStartedAt(session.started_at);
        // Store session ID in localStorage
        localStorage.setItem("activeWorkoutSessionId", session.id);
      }
  };

  const completeInProgressWorkouts = async (userId: string, excludeSessionId: string | null = null) => {
    // Find all in-progress workouts for this user
    let query = supabase
      .from("workout_sessions")
      .select("id")
      .eq("user_id", userId)
      .is("completed_at", null);
    
    // Exclude the session we might be resuming
    if (excludeSessionId) {
      query = query.neq("id", excludeSessionId);
    }
    
    const { data: inProgressSessions } = await query;

    if (inProgressSessions && inProgressSessions.length > 0) {
      const endTime = new Date().toISOString();
      const sessionIds = inProgressSessions.map(s => s.id);
      
      // Complete all in-progress sessions
      await supabase
        .from("workout_sessions")
        .update({ completed_at: endTime })
        .in("id", sessionIds);
      
      // Only clear localStorage if we're completing the current session
      if (!excludeSessionId || !sessionIds.includes(excludeSessionId)) {
        localStorage.removeItem("activeWorkoutSessionId");
      }
    }
  };

  const announceCurrentExercise = async () => {
    if (exercises.length === 0) return;
    const exercise = exercises[currentExerciseIndex];
    const text = `Exercise ${currentExerciseIndex + 1}: ${exercise.name}. Set ${currentSet} of ${exercise.sets}. Target: ${exercise.reps_min} to ${exercise.reps_max} reps${exercise.weight_lbs ? ` at ${exercise.weight_lbs} pounds` : ""}.`;
    await speakText(text, userPreferences?.audio);
  };

  const announceRestPeriod = async (seconds: number) => {
    if (exercises.length === 0 || !userPreferences) return;
    const text = `Rest for ${seconds} seconds.`;
    await speakText(text, userPreferences?.audio);
    restAnnouncedRef.current = true;
  };

  const announceNextSet = async () => {
    if (exercises.length === 0 || !userPreferences) return;
    
    // Prevent duplicate announcements
    const announcementKey = `${currentExerciseIndex}-${currentSet}`;
    if (nextSetAnnouncedRef.current === announcementKey) {
      return;
    }
    nextSetAnnouncedRef.current = announcementKey;
    
    const exercise = exercises[currentExerciseIndex];
    if (currentSet <= exercise.sets) {
      const repsText = exercise.reps_max === 999 
        ? `${exercise.reps_min} reps or max`
        : exercise.reps_min === exercise.reps_max
        ? `${exercise.reps_min} reps`
        : `${exercise.reps_min} to ${exercise.reps_max} reps`;
      
      const weightText = exercise.weight_lbs 
        ? ` with ${exercise.weight_lbs} pounds`
        : "";
      
      const text = `Set ${currentSet} of ${exercise.sets}. Do ${repsText}${weightText}. Ready?`;
      await speakText(text, userPreferences?.audio);
    } else if (currentExerciseIndex < exercises.length - 1) {
      const nextExercise = exercises[currentExerciseIndex + 1];
      const text = `Moving to ${nextExercise.name}.`;
      await speakText(text, userPreferences?.audio);
    }
  };

  const playListeningSound = () => {
    // Play a beep sound to indicate listening
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800; // Higher pitch beep
    oscillator.type = "sine";
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  };

  const playDoubleBeep = () => {
    // Play a quick double beep to indicate listening stopped
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const playBeep = (delay: number) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 600; // Lower pitch for double beep
      oscillator.type = "sine";
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime + delay);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + delay + 0.15);
      
      oscillator.start(audioContext.currentTime + delay);
      oscillator.stop(audioContext.currentTime + delay + 0.15);
    };
    
    playBeep(0);
    playBeep(0.2); // Second beep 200ms after first
  };

  const handleRestEnd = async () => {
    setIsResting(false);
    restAnnouncedRef.current = false;
    // Reset announcement tracking so next set can be announced
    hasAnnouncedRef.current = false;
    // Reset next set announcement tracking
    nextSetAnnouncedRef.current = "";
    await announceNextSet();
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

  const { startListening, isListening, stopListening } = useVoiceInput(async (text) => {
    if (!awaitingSetInput) return;
    
    // Clear timeout since we got input
    if (voiceInputTimeoutRef.current) {
      clearTimeout(voiceInputTimeoutRef.current);
      voiceInputTimeoutRef.current = null;
    }
    
    console.log("Voice input:", text);
    
    // Parse voice input for reps/weight
    const repsMatch = text.match(/(\d+)\s*reps?/i);
    const weightMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?)/i);
    
    const reps = repsMatch ? parseInt(repsMatch[1]) : null;
    const weight = weightMatch ? parseFloat(weightMatch[1]) : null;
    
    if (reps !== null) {
      setAwaitingSetInput(false);
      await handleSetInput(reps, weight);
    } else {
      // If we couldn't parse reps, ask again
      const exercise = exercises[currentExerciseIndex];
      const question = exercise.weight_lbs 
        ? "I didn't catch that. How many reps did you do and what weight did you use?"
        : "I didn't catch that. How many reps did you do?";
      await speakText(question, userPreferences?.audio);
      playListeningSound();
      startListening();
      // Restart timeout
      voiceInputTimeoutRef.current = setTimeout(() => {
        handleVoiceInputTimeout();
      }, 5000);
    }
  });

  const handleVoiceInputTimeout = async () => {
    if (!awaitingSetInput) return;
    
    stopListening();
    playDoubleBeep();
    setAwaitingSetInput(false);
    setShowManualInput(true);
    
    // Set default values from exercise
    const exercise = exercises[currentExerciseIndex];
    setManualReps(exercise.reps_min);
    setManualWeight(exercise.weight_lbs);
    
    // Announce that manual input is needed
    await speakText("Please record your set information and then we'll move to the rest period.", userPreferences?.audio);
  };

  const completeSet = async () => {
    if (!userPreferences || exercises.length === 0) return;
    
    const exercise = exercises[currentExerciseIndex];
    setAwaitingSetInput(true);
    setShowManualInput(false);
    
    // Ask for input
    const question = exercise.weight_lbs
      ? `How many reps did you do and what weight did you use?`
      : `How many reps did you do?`;
    
    await speakText(question, userPreferences?.audio);
    
    // Play listening sound
    playListeningSound();
    
    // Start listening
    startListening();
    
    // Set timeout for 5 seconds
    voiceInputTimeoutRef.current = setTimeout(() => {
      handleVoiceInputTimeout();
    }, 5000);
  };

  const handleManualSave = async () => {
    if (manualReps === null || manualReps <= 0) {
      alert("Please enter the number of reps");
      return;
    }
    
    setShowManualInput(false);
    await handleSetInput(manualReps, manualWeight);
  };

  const handleSetInput = async (reps: number, weight: number | null) => {
    if (!sessionId || exercises.length === 0) return;
    
    // Clear timeout if it exists
    if (voiceInputTimeoutRef.current) {
      clearTimeout(voiceInputTimeoutRef.current);
      voiceInputTimeoutRef.current = null;
    }
    
    setAwaitingSetInput(false);
    setShowManualInput(false);
    
    const exercise = exercises[currentExerciseIndex];
    const weightToSave = weight !== null ? weight : exercise.weight_lbs;
    
    // Confirm what was recorded
    const confirmText = weightToSave
      ? `Great. ${reps} reps with ${weightToSave} pounds.`
      : `Great. ${reps} reps.`;
    
    await speakText(confirmText, userPreferences?.audio);
    
    // Save the set
    await supabase.from("workout_sets").insert({
      workout_session_id: sessionId,
      exercise_id: exercise.id,
      set_number: currentSet,
      reps: reps,
      weight_lbs: weightToSave,
      rest_seconds: exercise.rest_seconds,
    });

    // Announce rest period
    const restText = `Next is a ${exercise.rest_seconds} second rest.`;
    await speakText(restText, userPreferences?.audio);

    if (currentSet < exercise.sets) {
      // More sets remaining
      setIsResting(true);
      setRestTime(exercise.rest_seconds);
      // Increment set AFTER announcing rest (so next set is ready when rest ends)
      setCurrentSet(currentSet + 1);
      // Reset next set announcement tracking for the new set
      nextSetAnnouncedRef.current = "";
    } else {
      // Last set of this exercise - move to next exercise
      if (currentExerciseIndex < exercises.length - 1) {
        const nextExercise = exercises[currentExerciseIndex + 1];
        setIsResting(true);
        setRestTime(nextExercise.rest_seconds);
        setCurrentExerciseIndex(currentExerciseIndex + 1);
        setCurrentSet(1);
        // Reset announcement tracking for new exercise
        hasAnnouncedRef.current = false;
        lastAnnouncedIndexRef.current = -1;
        nextSetAnnouncedRef.current = "";
      } else {
        // Workout complete
        await completeWorkout();
      }
    }
  };


  const completeWorkout = async () => {
    if (!sessionId) return;

    const endTime = new Date().toISOString();
    const startTime = sessionStartedAt ? new Date(sessionStartedAt) : new Date();
    const durationSeconds = Math.floor((new Date(endTime).getTime() - startTime.getTime()) / 1000);

    await supabase
      .from("workout_sessions")
      .update({
        completed_at: endTime,
        duration_seconds: durationSeconds,
      })
      .eq("id", sessionId);

    // Clear localStorage
    localStorage.removeItem("activeWorkoutSessionId");

    if (userPreferences) {
      await speakText("Workout complete! Great job!", userPreferences?.audio);
    }
    router.push("/history");
  };

  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);

  const handleCompleteWorkoutClick = () => {
    setShowCompleteConfirm(true);
  };

  const handleConfirmComplete = async () => {
    setShowCompleteConfirm(false);
    await completeWorkout();
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
          <Button onClick={() => router.push("/plans")} variant="primary" size="lg">
            Back to Plans
          </Button>
        </div>
      </div>
    );
  }

  if (exercises.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <p className="text-xl mb-4">No exercises found in this workout plan.</p>
          <Button onClick={() => router.push("/plans")} variant="primary" size="lg">
            Back to Plans
          </Button>
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
          {currentExercise.weight_lbs && (
            <div className="mt-4 text-center">
              <p className="text-gray-400">Weight</p>
              <p className="text-2xl font-bold">{currentExercise.weight_lbs} lbs</p>
            </div>
          )}
        </div>

        {restTime > 0 && (
          <div className="bg-blue-900 rounded-lg p-6 mb-6 text-center">
            <p className="text-lg mb-2">Rest Time</p>
            <p className="text-4xl font-bold">{restTime}s</p>
          </div>
        )}

        {showManualInput && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h3 className="text-xl font-bold mb-4 text-white">Record Set Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Reps *
                </label>
                <input
                  type="number"
                  value={manualReps || ""}
                  onChange={(e) => setManualReps(parseInt(e.target.value) || null)}
                  className="w-full px-4 py-2 bg-gray-700 text-white rounded-md border border-gray-600 focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="Enter reps"
                  autoFocus
                />
              </div>
              {exercises[currentExerciseIndex]?.weight_lbs && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Weight (lbs)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={manualWeight || ""}
                    onChange={(e) => setManualWeight(parseFloat(e.target.value) || null)}
                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-md border border-gray-600 focus:border-indigo-500 focus:ring-indigo-500"
                    placeholder="Enter weight"
                  />
                </div>
              )}
              <Button
                onClick={handleManualSave}
                variant="primary"
                className="w-full"
              >
                Save Set
              </Button>
            </div>
          </div>
        )}

        {!showManualInput && (
          <div className="space-y-4">
            <div className="flex justify-center space-x-4">
              <Button
                onClick={() => handleButtonAction("pause_resume")}
                variant="secondary"
                size="lg"
              >
                {isPaused ? "Resume" : "Pause"}
              </Button>
              <Button onClick={completeSet} variant="primary" size="lg">
                Complete Set
              </Button>
              {!awaitingSetInput && (
                <Button
                  onClick={startListening}
                  disabled={isListening}
                  variant="success"
                  size="lg"
                  isLoading={isListening}
                >
                  {isListening ? "Listening..." : "Voice Input"}
                </Button>
              )}
              {awaitingSetInput && (
                <div className="text-center">
                  <p className="text-gray-400 mb-2">Listening for your response...</p>
                  <Button
                    onClick={() => {
                      if (voiceInputTimeoutRef.current) {
                        clearTimeout(voiceInputTimeoutRef.current);
                      }
                      handleVoiceInputTimeout();
                    }}
                    variant="outline"
                    size="lg"
                  >
                    Skip to Manual Input
                  </Button>
                </div>
              )}
            </div>
            <div className="flex justify-center">
              <Button
                onClick={handleCompleteWorkoutClick}
                variant="danger"
                size="lg"
              >
                Complete Workout
              </Button>
            </div>
          </div>
        )}
        
        {showCompleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 max-w-md mx-4">
              <h3 className="text-xl font-bold text-white mb-4">Complete Workout?</h3>
              <p className="text-gray-300 mb-6">
                Are you sure you want to complete this workout? This will end your current session.
              </p>
              <div className="flex justify-end space-x-4">
                <Button
                  onClick={() => setShowCompleteConfirm(false)}
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmComplete}
                  variant="danger"
                >
                  Yes, Complete Workout
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 text-center text-sm text-gray-400">
          <p>Use headphone buttons to control workout</p>
        </div>
      </div>
    </div>
  );
}
