"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/contexts/UserContext";
import {
  announceCurrentExercise,
  announceRestPeriod,
  announceNextSet,
  announceNextExercise,
  askForSetInput,
  confirmSetRecorded,
  announceManualInputNeeded,
  announceWorkoutPaused,
  announceWorkoutResumed,
  announceWorkoutComplete,
  askExerciseCompletionOption,
  announceExerciseSkipped,
  announceExerciseMovedToEnd,
} from "@/lib/audio/speechManager";
import { useHeadphoneButtons } from "@/hooks/useHeadphoneButtons";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import Button from "@/components/ui/Button";
import {
  startBackgroundMusic,
  stopBackgroundMusic,
  pauseBackgroundMusic,
  resumeBackgroundMusic,
} from "@/lib/audio/backgroundMusic";

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

export default function WorkoutPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;
  const supabase = createClient();
  const { user, profile } = useUser();

  const [plan, setPlan] = useState<any>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);
  const [restTime, setRestTime] = useState(0);
  const [userPreferences, setUserPreferences] = useState<any>(null);
  const [headphoneMappings, setHeadphoneMappings] = useState<any>(null);
  const [selectedHeadphone, setSelectedHeadphone] = useState<any>(null);
  const [availableHeadphones, setAvailableHeadphones] = useState<any[]>([]);
  const [showHeadphoneSelector, setShowHeadphoneSelector] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isResting, setIsResting] = useState(false);
  const hasAnnouncedRef = useRef(false);
  const lastAnnouncedIndexRef = useRef<string>("");
  const isAnnouncingRef = useRef(false);
  const workoutStateLoadedRef = useRef(false);
  const loadingWorkoutRef = useRef(false);
  const loadingPreferencesRef = useRef(false);
  const loadedSessionIdRef = useRef<string | null>(null);

  const loadWorkoutState = async (sessionId: string, planId: string | null) => {
    // Prevent duplicate calls
    if (loadingWorkoutRef.current) return;
    loadingWorkoutRef.current = true;

    if (!planId) {
      setError("Cannot resume workout without plan ID");
      setLoading(false);
      loadingWorkoutRef.current = false;
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

      // Load session-specific exercise order (if exists)
      let sessionExercises: any[] | null = null;
      try {
        const { data, error } = await supabase
          .from("workout_session_exercises")
          .select("exercise_id, order_index, is_completed, skipped")
          .eq("workout_session_id", sessionId)
          .order("order_index");
        
        if (error && error.code !== "PGRST116" && !error.message?.includes("404")) {
          console.error("Error loading session exercises:", error);
        } else if (!error) {
          sessionExercises = data;
        }
      } catch (error: any) {
        // Table might not exist - that's okay, continue with plan order
        if (error?.code !== "PGRST116" && !error?.message?.includes("404")) {
          console.error("Error loading session exercises:", error);
        }
      }

      // Load plan exercises
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

      // Create a map of exercise data from plan
      const exerciseDataMap = new Map<string, any>();
      exercisesData.forEach((pe: any) => {
        if (pe.exercises) {
          exerciseDataMap.set(pe.exercises.id, pe);
        }
      });

      // Use session order if available, otherwise use plan order
      let orderedExerciseIds: string[] = [];
      if (sessionExercises && sessionExercises.length > 0) {
        // Use session-specific order, filtering out completed/skipped exercises
        orderedExerciseIds = sessionExercises
          .filter((se: any) => !se.is_completed && !se.skipped)
          .sort((a: any, b: any) => a.order_index - b.order_index)
          .map((se: any) => se.exercise_id);
        
        // Add any exercises from plan that aren't in session exercises
        exercisesData.forEach((pe: any) => {
          if (pe.exercises && !sessionExercises.some((se: any) => se.exercise_id === pe.exercises.id)) {
            orderedExerciseIds.push(pe.exercises.id);
          }
        });
      } else {
        // No session order yet, use plan order and create session exercise records
        orderedExerciseIds = exercisesData
          .filter((pe: any) => pe.exercises)
          .map((pe: any) => pe.exercises.id);
        
        // Create session exercise records
        const sessionExercisesToCreate = exercisesData
          .filter((pe: any) => pe.exercises)
          .map((pe: any, index: number) => ({
            workout_session_id: sessionId,
            exercise_id: pe.exercises.id,
            order_index: index,
            is_completed: false,
            skipped: false,
          }));

        if (sessionExercisesToCreate.length > 0) {
          try {
            const { error: insertError } = await supabase
              .from("workout_session_exercises")
              .insert(sessionExercisesToCreate);
            
            if (insertError && insertError.code !== "PGRST116") {
              console.error("Error creating session exercises:", insertError);
              // Continue anyway - this is not critical for basic functionality
            }
          } catch (error: any) {
            // Table might not exist - that's okay, continue without session tracking
            if (error?.code !== "PGRST116" && !error?.message?.includes("404")) {
              console.error("Error creating session exercises:", error);
            }
          }
        }
      }

      // Format exercises in the correct order
      const formatted = orderedExerciseIds
        .map((exerciseId) => {
          const pe = exerciseDataMap.get(exerciseId);
          if (!pe || !pe.exercises) return null;
          
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
            order_index: orderedExerciseIds.indexOf(exerciseId),
          };
        })
        .filter((e): e is Exercise => e !== null);

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

      // Reset announcement tracking before setting new position
      hasAnnouncedRef.current = false;
      lastAnnouncedIndexRef.current = ""; // Reset to empty string since we're now using "exerciseIndex-setNumber" format
      isAnnouncingRef.current = false; // Reset announcing flag
      
      setCurrentExerciseIndex(currentExIndex);
      setCurrentSet(currentSetNum);
      workoutStateLoadedRef.current = true; // Mark that workout state is loaded
      setLoading(false);
    } catch (err) {
      console.error("Error loading workout state:", err);
      setError("Failed to load workout state");
      setLoading(false);
    } finally {
      loadingWorkoutRef.current = false;
    }
  };

  const checkForExistingWorkout = async () => {
    if (!user) {
      router.push("/login");
      return;
    }

    // Prevent duplicate calls for the same session
    if (loadingWorkoutRef.current || loadedSessionIdRef.current === sessionId) return;

    // Load session from database
    const { data: session, error: sessionError } = await supabase
      .from("workout_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (sessionError || !session) {
      setError("Workout session not found");
      setLoading(false);
      return;
    }

    // Check if session is completed
    if (session.completed_at) {
      setError("This workout has already been completed");
      setLoading(false);
      return;
    }

    // Store session ID in localStorage
    localStorage.setItem("activeWorkoutSessionId", session.id);
    
    setSessionStartedAt(session.started_at);
    // Reset paused time tracking when resuming
    totalPausedTimeRef.current = 0;
    pauseStartTimeRef.current = null;
    loadedSessionIdRef.current = sessionId;
    await loadWorkoutState(session.id, session.workout_plan_id);
  };

  useEffect(() => {
    // Reset loaded session when sessionId changes
    if (loadedSessionIdRef.current !== sessionId) {
      loadedSessionIdRef.current = null;
      loadingWorkoutRef.current = false;
      workoutStateLoadedRef.current = false;
    }
    
    if (user && !loadingWorkoutRef.current && loadedSessionIdRef.current !== sessionId) {
      checkForExistingWorkout();
    }
  }, [sessionId, user]);

  useEffect(() => {
    if (profile !== null && !loadingPreferencesRef.current) {
      loadPreferences();
    }
  }, [profile, user]);

  useEffect(() => {
    if (user) {
      loadHeadphoneMappings();
    }
  }, [user, userPreferences?.audio?.audio_cues_enabled]);

  // Close headphone selector when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showHeadphoneSelector && !target.closest('[data-headphone-selector]')) {
        setShowHeadphoneSelector(false);
      }
    };

    if (showHeadphoneSelector) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showHeadphoneSelector]);
  
  useEffect(() => {
    // Cleanup timeout on unmount
    return () => {
      if (voiceInputTimeoutRef.current) {
        clearTimeout(voiceInputTimeoutRef.current);
      }
    };
  }, []);

  // Rest of the component code will be copied from the existing workout page...
  // For brevity, I'll copy the essential parts

  const restAnnouncedRef = useRef(false);
  const [awaitingSetInput, setAwaitingSetInput] = useState(false);
  const awaitingSetInputRef = useRef(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualReps, setManualReps] = useState<number | null>(null);
  const [manualWeight, setManualWeight] = useState<number | null>(null);
  const [lastCompletedSet, setLastCompletedSet] = useState<{ reps: number; weight_lbs: number | null; set_number: number } | null>(null);
  const [workoutElapsedTime, setWorkoutElapsedTime] = useState(0);
  const pauseStartTimeRef = useRef<number | null>(null);
  const totalPausedTimeRef = useRef<number>(0);
  const voiceInputTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const nextSetAnnouncedRef = useRef<string>("");
  const restEndHandledRef = useRef(false);
  const fetchingLastSetRef = useRef(false);

  // Keep ref in sync with state
  useEffect(() => {
    awaitingSetInputRef.current = awaitingSetInput;
  }, [awaitingSetInput]);

  // Fetch last completed set for current exercise
  useEffect(() => {
    const fetchLastCompletedSet = async () => {
      // Prevent duplicate calls
      if (fetchingLastSetRef.current) return;
      
      if (!sessionId || exercises.length === 0 || currentExerciseIndex >= exercises.length) {
        setLastCompletedSet(null);
        return;
      }

      const currentExercise = exercises[currentExerciseIndex];
      if (!currentExercise) return;

      fetchingLastSetRef.current = true;
      try {
        const { data: sets, error: setsError } = await supabase
          .from("workout_sets")
          .select("reps, weight_lbs, set_number")
          .eq("workout_session_id", sessionId)
          .eq("exercise_id", currentExercise.id)
          .order("completed_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (setsError) {
          console.error("Error fetching last completed set:", setsError);
          setLastCompletedSet(null);
        } else if (sets) {
          setLastCompletedSet({
            reps: sets.reps,
            weight_lbs: sets.weight_lbs,
            set_number: sets.set_number,
          });
        } else {
          setLastCompletedSet(null);
        }
      } catch (error) {
        console.error("Error fetching last completed set:", error);
        setLastCompletedSet(null);
      } finally {
        fetchingLastSetRef.current = false;
      }
    };

    fetchLastCompletedSet();
  }, [sessionId, currentExerciseIndex, exercises]);

  // Track pause/resume for timer
  useEffect(() => {
    if (isPaused) {
      pauseStartTimeRef.current = Date.now();
    } else {
      if (pauseStartTimeRef.current !== null) {
        const pausedDuration = Math.floor((Date.now() - pauseStartTimeRef.current) / 1000);
        totalPausedTimeRef.current += pausedDuration;
        pauseStartTimeRef.current = null;
      }
    }
  }, [isPaused]);

  // Start background music when workout starts (keeps Media Session active for button detection)
  useEffect(() => {
    if (sessionStartedAt && !loading) {
      // Try to load music file first, fallback to ambient tone if not found
      startBackgroundMusic(true).catch((error) => {
        console.error("Error starting background music:", error);
      });
    }

    // Cleanup: stop music when component unmounts or workout ends
    return () => {
      stopBackgroundMusic();
    };
  }, [sessionStartedAt, loading]);

  // Pause/resume background music with workout
  useEffect(() => {
    if (isPaused) {
      pauseBackgroundMusic();
    } else if (sessionStartedAt && !loading) {
      resumeBackgroundMusic();
    }
  }, [isPaused, sessionStartedAt, loading]);

  // Update workout timer every second
  useEffect(() => {
    if (!sessionStartedAt) {
      setWorkoutElapsedTime(0);
      return;
    }

    const updateTimer = () => {
      if (isPaused) {
        return;
      }

      const startTime = new Date(sessionStartedAt).getTime();
      const now = Date.now();
      const pausedTime = pauseStartTimeRef.current 
        ? totalPausedTimeRef.current + Math.floor((now - pauseStartTimeRef.current) / 1000)
        : totalPausedTimeRef.current;
      
      const elapsed = Math.floor((now - startTime) / 1000) - pausedTime;
      setWorkoutElapsedTime(Math.max(0, elapsed));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [sessionStartedAt, isPaused]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };
  
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (restTime > 0 && !isPaused) {
      restEndHandledRef.current = false;
      interval = setInterval(() => {
        setRestTime((t) => {
          if (t <= 1 && !restEndHandledRef.current) {
            restEndHandledRef.current = true;
            handleRestEnd();
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [restTime, isPaused]);

  const loadPreferences = async () => {
    // Prevent duplicate calls
    if (loadingPreferencesRef.current) return;
    loadingPreferencesRef.current = true;

    const defaultPreferences = {
      audio: {
        tts_provider: "browser", // Default to free browser TTS
        voice_id: "alloy",
        speech_rate: 1.0,
        volume: 0.8,
        audio_cues_enabled: true, // Default to enabled
      },
    };
    
    if (profile?.preferences) {
      // Ensure audio_cues_enabled is set (default to true if not present)
      const preferences = {
        ...profile.preferences,
        audio: {
          ...profile.preferences.audio,
          audio_cues_enabled: profile.preferences.audio?.audio_cues_enabled !== false,
        },
      };
      setUserPreferences(preferences);
      loadingPreferencesRef.current = false;
    } else if (user) {
      // Profile exists but no preferences - create default
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
      loadingPreferencesRef.current = false;
    } else {
      loadingPreferencesRef.current = false;
    }
  };

  const loadHeadphoneMappings = async () => {
    if (!user) return;

    // Load all headphones
    const { data: allHeadphones } = await supabase
      .from("user_headphones")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (allHeadphones) {
      setAvailableHeadphones(allHeadphones);
      
      // If audio cues are disabled, disable headphones (but keep list visible)
      if (userPreferences?.audio?.audio_cues_enabled === false) {
        setSelectedHeadphone(null);
        setHeadphoneMappings(null);
        return;
      }
      
      // Load default headphone (or first one if no default)
      if (allHeadphones.length > 0) {
        const defaultHeadphone = allHeadphones.find(h => h.is_default) || allHeadphones[0];
        setSelectedHeadphone(defaultHeadphone);
        setHeadphoneMappings(defaultHeadphone.button_mappings);
      } else {
        // No headphones configured - default to "No Headphones"
        setSelectedHeadphone(null);
        setHeadphoneMappings(null);
      }
    }
  };

  const handleHeadphoneChange = (headphoneId: string | null) => {
    if (headphoneId === null) {
      // "No Headphones" selected
      setSelectedHeadphone(null);
      setHeadphoneMappings(null);
      setShowHeadphoneSelector(false);
    } else {
      const headphone = availableHeadphones.find(h => h.id === headphoneId);
      if (headphone) {
        setSelectedHeadphone(headphone);
        setHeadphoneMappings(headphone.button_mappings);
        setShowHeadphoneSelector(false);
      }
    }
  };

  useEffect(() => {
    if (loading) return;
    if (isResting) return;
    if (isAnnouncingRef.current) return;
    
    const announcementKey = `${currentExerciseIndex}-${currentSet}`;
    if (
      exercises.length > 0 &&
      currentExerciseIndex < exercises.length &&
      userPreferences !== null &&
      lastAnnouncedIndexRef.current !== announcementKey
    ) {
      isAnnouncingRef.current = true;
      lastAnnouncedIndexRef.current = announcementKey;
      hasAnnouncedRef.current = true;
      
      handleAnnounceCurrentExercise().finally(() => {
        isAnnouncingRef.current = false;
      });
    }
  }, [loading, currentExerciseIndex, currentSet, exercises.length, userPreferences, isResting]);

  const handleAnnounceCurrentExercise = async () => {
    if (exercises.length === 0 || !userPreferences) {
      return;
    }
    
    try {
      const exercise = exercises[currentExerciseIndex];
      await announceCurrentExercise(
        {
          exerciseNumber: currentExerciseIndex + 1,
          exerciseName: exercise.name,
          currentSet: currentSet,
          totalSets: exercise.sets,
          repsMin: exercise.reps_min,
          repsMax: exercise.reps_max,
          weightLbs: exercise.weight_lbs,
        },
        userPreferences?.audio
      );
    } catch (error) {
      console.error("Error announcing exercise:", error);
    }
  };

  const handleAnnounceRestPeriod = async (
    seconds: number,
    nextInfo?: {
      exerciseName: string;
      setNumber: number;
      isNewExercise?: boolean;
    }
  ) => {
    if (!userPreferences) return;
    await announceRestPeriod(seconds, userPreferences?.audio, nextInfo);
    restAnnouncedRef.current = true;
  };

  const handleAnnounceNextSet = async () => {
    if (exercises.length === 0 || !userPreferences) return;
    
    const announcementKey = `${currentExerciseIndex}-${currentSet}`;
    if (nextSetAnnouncedRef.current === announcementKey) {
      return;
    }
    
    nextSetAnnouncedRef.current = announcementKey;
    isAnnouncingRef.current = true;
    
    const exercise = exercises[currentExerciseIndex];
    if (currentSet <= exercise.sets) {
      await announceNextSet(
        {
          currentSet: currentSet,
          totalSets: exercise.sets,
          repsMin: exercise.reps_min,
          repsMax: exercise.reps_max,
          weightLbs: exercise.weight_lbs,
          exerciseName: exercise.name,
        },
        userPreferences?.audio
      );
    } else if (currentExerciseIndex < exercises.length - 1) {
      const nextExercise = exercises[currentExerciseIndex + 1];
      await announceNextExercise(nextExercise.name, userPreferences?.audio);
    }
    
    isAnnouncingRef.current = false;
  };

  const handleRestEnd = async () => {
    restAnnouncedRef.current = false;
    
    const announcementKey = `${currentExerciseIndex}-${currentSet}`;
    lastAnnouncedIndexRef.current = announcementKey;
    hasAnnouncedRef.current = true;
    isAnnouncingRef.current = true;
    
    nextSetAnnouncedRef.current = "";
    
    setIsResting(false);
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    await handleAnnounceNextSet();
    
    isAnnouncingRef.current = false;
  };

  const handleButtonPress = async (buttonNumber: 1 | 2 | 3) => {
    // Map button numbers to actions
    // Button 1: Pause/Resume
    // Button 2: Next Set (Complete Set)
    // Button 3: Voice Input / Complete Exercise
    // These mappings are fixed - users configure which physical buttons map to Button 1/2/3
    
    switch (buttonNumber) {
      case 1:
        // Button 1: Pause/Resume
        const newPausedState = !isPaused;
        setIsPaused(newPausedState);
        if (newPausedState) {
          await announceWorkoutPaused(userPreferences?.audio);
        } else {
          await announceWorkoutResumed(userPreferences?.audio);
        }
        break;
      case 2:
        // Button 2: Next Set (Complete Set)
        completeSet();
        break;
      case 3:
        // Button 3: Complete Exercise (or voice input in future)
        if (!awaitingSetInput && exercises.length > 0) {
          const exercise = exercises[currentExerciseIndex];
          setShowCompleteExerciseDialog(true);
          await askExerciseCompletionOption(exercise.name, userPreferences?.audio);
        }
        break;
    }
  };


  useHeadphoneButtons(headphoneMappings, handleButtonPress);

  // Automatically disable headphones when audio cues are turned off
  useEffect(() => {
    if (userPreferences?.audio?.audio_cues_enabled === false) {
      setSelectedHeadphone(null);
      setHeadphoneMappings(null);
      setShowHeadphoneSelector(false);
    }
  }, [userPreferences?.audio?.audio_cues_enabled]);

  const playListeningSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = "sine";
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
      console.error("Error playing listening sound:", error);
    }
  };

  const playSuccessBeep = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 1000;
      oscillator.type = "sine";
      
      gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.15);
    } catch (error) {
      console.error("Error playing success beep:", error);
    }
  };

  const playDoubleBeep = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const playBeep = (delay: number) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 600;
        oscillator.type = "sine";
        
        gainNode.gain.setValueAtTime(0.5, audioContext.currentTime + delay);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + delay + 0.2);
        
        oscillator.start(audioContext.currentTime + delay);
        oscillator.stop(audioContext.currentTime + delay + 0.2);
      };
      
      playBeep(0);
      playBeep(0.25);
    } catch (error) {
      console.error("Error playing double beep:", error);
    }
  };

  const { startListening, isListening, stopListening, error: voiceError } = useVoiceInput(
    async (text) => {
      if (!awaitingSetInputRef.current) {
        return;
      }
      
      if (voiceInputTimeoutRef.current) {
        clearTimeout(voiceInputTimeoutRef.current);
        voiceInputTimeoutRef.current = null;
      }
      
      playSuccessBeep();
      
      setAwaitingSetInput(false);
      awaitingSetInputRef.current = false;
      
      try {
        const exercise = exercises[currentExerciseIndex];
        const response = await fetch("/api/ai/parse-set-input", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript: text,
            hasWeight: !!exercise.weight_lbs,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to parse input");
        }

        const { reps, weight } = await response.json();

        if (reps !== null && reps > 0) {
          await handleSetInput(reps, weight);
        } else {
          console.warn("AI could not parse reps from voice input:", text);
          setAwaitingSetInput(true);
          awaitingSetInputRef.current = true;
          await askForSetInput(!!exercise.weight_lbs, userPreferences?.audio);
          playListeningSound();
          startListening();
          voiceInputTimeoutRef.current = setTimeout(() => {
            handleVoiceInputTimeout();
          }, 15000);
        }
      } catch (error) {
        console.error("Error parsing voice input with AI:", error);
        const exercise = exercises[currentExerciseIndex];
        const hasWeight = !!exercise.weight_lbs;
        
        if (!hasWeight) {
          const repsMatch = text.match(/(\d+)/i);
          const reps = repsMatch ? parseInt(repsMatch[1]) : null;
          
          if (reps !== null && reps > 0) {
            await handleSetInput(reps, null);
          } else {
            setAwaitingSetInput(true);
            awaitingSetInputRef.current = true;
            await askForSetInput(false, userPreferences?.audio);
            playListeningSound();
            startListening();
            voiceInputTimeoutRef.current = setTimeout(() => {
              handleVoiceInputTimeout();
            }, 15000);
          }
        } else {
          const repsMatch = text.match(/(\d+)\s*reps?/i);
          const weightMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?)/i);
          
          const reps = repsMatch ? parseInt(repsMatch[1]) : null;
          const weight = weightMatch ? parseFloat(weightMatch[1]) : null;
          
          if (reps !== null && reps > 0) {
            await handleSetInput(reps, weight);
          } else {
            setAwaitingSetInput(true);
            awaitingSetInputRef.current = true;
            await askForSetInput(true, userPreferences?.audio);
            playListeningSound();
            startListening();
            voiceInputTimeoutRef.current = setTimeout(() => {
              handleVoiceInputTimeout();
            }, 15000);
          }
        }
      }
    },
    () => awaitingSetInputRef.current
  );

  const handleVoiceInputTimeout = async () => {
    if (!awaitingSetInputRef.current) return;
    
    stopListening();
    
    playDoubleBeep();
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    setAwaitingSetInput(false);
    awaitingSetInputRef.current = false;
    setShowManualInput(true);
    
    const exercise = exercises[currentExerciseIndex];
    setManualReps(exercise.reps_min);
    setManualWeight(exercise.weight_lbs);
    
    await announceManualInputNeeded(userPreferences?.audio);
  };

  const completeSet = async () => {
    if (!userPreferences || exercises.length === 0) return;
    
    const exercise = exercises[currentExerciseIndex];
    setAwaitingSetInput(true);
    awaitingSetInputRef.current = true;
    setShowManualInput(false);
    
    await askForSetInput(!!exercise.weight_lbs, userPreferences?.audio);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    playListeningSound();
    
    try {
      startListening();
    } catch (error) {
      console.error("Error starting voice input:", error);
      handleVoiceInputTimeout();
      return;
    }
    
    voiceInputTimeoutRef.current = setTimeout(() => {
      handleVoiceInputTimeout();
    }, 15000);
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
    
    if (voiceInputTimeoutRef.current) {
      clearTimeout(voiceInputTimeoutRef.current);
      voiceInputTimeoutRef.current = null;
    }
    
    setAwaitingSetInput(false);
    setShowManualInput(false);
    
    const exercise = exercises[currentExerciseIndex];
    const weightToSave = weight !== null ? weight : exercise.weight_lbs;
    
    await confirmSetRecorded(reps, weightToSave, userPreferences?.audio);
    
    await supabase.from("workout_sets").insert({
      workout_session_id: sessionId,
      exercise_id: exercise.id,
      set_number: currentSet,
      reps: reps,
      weight_lbs: weightToSave,
      rest_seconds: exercise.rest_seconds,
    });

    setLastCompletedSet({
      reps: reps,
      weight_lbs: weightToSave,
      set_number: currentSet,
    });

    if (currentSet < exercise.sets) {
      const nextSetNumber = currentSet + 1;
      await handleAnnounceRestPeriod(exercise.rest_seconds, {
        exerciseName: exercise.name,
        setNumber: nextSetNumber,
        isNewExercise: false,
      });
      setIsResting(true);
      setRestTime(exercise.rest_seconds);
      setCurrentSet(nextSetNumber);
      nextSetAnnouncedRef.current = "";
    } else {
      if (currentExerciseIndex < exercises.length - 1) {
        const nextExercise = exercises[currentExerciseIndex + 1];
        await handleAnnounceRestPeriod(nextExercise.rest_seconds, {
          exerciseName: nextExercise.name,
          setNumber: 1,
          isNewExercise: true,
        });
        setIsResting(true);
        setRestTime(nextExercise.rest_seconds);
        setCurrentExerciseIndex(currentExerciseIndex + 1);
        setCurrentSet(1);
        hasAnnouncedRef.current = false;
        lastAnnouncedIndexRef.current = "";
        nextSetAnnouncedRef.current = "";
      } else {
        await completeWorkout();
      }
    }
  };

  const completeWorkout = async () => {
    if (!sessionId) return;

    // Stop background music
    stopBackgroundMusic();

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

    localStorage.removeItem("activeWorkoutSessionId");

    if (userPreferences) {
      await announceWorkoutComplete(userPreferences?.audio);
    }
    router.push("/history");
  };

  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [showCompleteExerciseDialog, setShowCompleteExerciseDialog] = useState(false);
  const [navigatingToDashboard, setNavigatingToDashboard] = useState(false);

  const handleCompleteWorkoutClick = () => {
    setShowCompleteConfirm(true);
  };

  const handleConfirmComplete = async () => {
    setShowCompleteConfirm(false);
    await completeWorkout();
  };

  const handleCompleteExercise = async (skip: boolean) => {
    if (!sessionId || exercises.length === 0) return;

    setShowCompleteExerciseDialog(false);
    const exercise = exercises[currentExerciseIndex];

    try {
      const { data: existingSessionExercise, error: fetchError } = await supabase
        .from("workout_session_exercises")
        .select("*")
        .eq("workout_session_id", sessionId)
        .eq("exercise_id", exercise.id)
        .maybeSingle();

      if (fetchError && fetchError.code === "PGRST116") {
        console.warn("workout_session_exercises table not found. Please run migration 006.");
      } else if (fetchError) {
        console.error("Error fetching session exercise:", fetchError);
        throw fetchError;
      } else if (!existingSessionExercise) {
        const { error: insertError } = await supabase
          .from("workout_session_exercises")
          .insert({
            workout_session_id: sessionId,
            exercise_id: exercise.id,
            order_index: exercise.order_index,
            is_completed: false,
            skipped: false,
          });

        if (insertError && insertError.code !== "PGRST116") {
          console.error("Error creating session exercise:", insertError);
        }
      }
    } catch (error: any) {
      if (error?.code === "PGRST116" || error?.message?.includes("404")) {
        console.warn("workout_session_exercises table not found. Please run migration 006.");
      } else {
        console.error("Error in handleCompleteExercise:", error);
      }
    }

    let updatedExercises = [...exercises];

    if (skip) {
      try {
        const { error: updateError } = await supabase
          .from("workout_session_exercises")
          .update({
            skipped: true,
            is_completed: true,
            completed_at: new Date().toISOString(),
          })
          .eq("workout_session_id", sessionId)
          .eq("exercise_id", exercise.id);

        if (updateError && updateError.code !== "PGRST116") {
          console.error("Error updating session exercise:", updateError);
        }
      } catch (error: any) {
        if (error?.code !== "PGRST116" && !error?.message?.includes("404")) {
          console.error("Error marking exercise as skipped:", error);
        }
      }

      await announceExerciseSkipped(exercise.name, userPreferences?.audio);
      
      updatedExercises = exercises.filter((_, idx) => idx !== currentExerciseIndex);
      setExercises(updatedExercises);
    } else {
      let maxOrderIndex = exercises.length;
      
      try {
        const { data: sessionExercises, error: fetchError } = await supabase
          .from("workout_session_exercises")
          .select("order_index")
          .eq("workout_session_id", sessionId)
          .order("order_index", { ascending: false })
          .limit(1);

        if (!fetchError && sessionExercises && sessionExercises.length > 0) {
          maxOrderIndex = sessionExercises[0].order_index + 1;
        }

        const { error: updateError } = await supabase
          .from("workout_session_exercises")
          .update({
            order_index: maxOrderIndex,
          })
          .eq("workout_session_id", sessionId)
          .eq("exercise_id", exercise.id);

        if (updateError && updateError.code !== "PGRST116") {
          console.error("Error updating exercise order:", updateError);
        }
      } catch (error: any) {
        if (error?.code !== "PGRST116" && !error?.message?.includes("404")) {
          console.error("Error moving exercise to end:", error);
        }
      }

      updatedExercises = exercises.filter((_, idx) => idx !== currentExerciseIndex);
      updatedExercises.push({
        ...exercise,
        order_index: maxOrderIndex,
      });

      setExercises(updatedExercises);

      await announceExerciseMovedToEnd(exercise.name, userPreferences?.audio);
    }

    if (updatedExercises.length > 0) {
      const nextIndex = currentExerciseIndex < updatedExercises.length ? currentExerciseIndex : 0;
      const nextExercise = updatedExercises[nextIndex];
      
      if (nextExercise) {
        await handleAnnounceRestPeriod(nextExercise.rest_seconds, {
          exerciseName: nextExercise.name,
          setNumber: 1,
          isNewExercise: true,
        });
        setIsResting(true);
        setRestTime(nextExercise.rest_seconds);
        setCurrentExerciseIndex(nextIndex);
        setCurrentSet(1);
        hasAnnouncedRef.current = false;
        lastAnnouncedIndexRef.current = "";
        nextSetAnnouncedRef.current = "";
      } else {
        await completeWorkout();
      }
    } else {
      await completeWorkout();
    }
  };

  const handleNavigateToDashboard = async () => {
    setNavigatingToDashboard(true);
    
    // Pause workout immediately (don't wait for announcement)
    if (!isPaused && sessionStartedAt) {
      setIsPaused(true);
      // Announce in background - don't wait for it
      if (userPreferences) {
        announceWorkoutPaused(userPreferences?.audio).catch(console.error);
      }
    }
    
    // Redirect immediately
    router.push("/dashboard");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
        <div className="text-center">
          <p className="text-xl mb-4">Loading workout...</p>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white mx-auto"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
        <div className="text-center max-w-md">
          <p className="text-xl mb-4 text-red-600 dark:text-red-400">{error}</p>
          <Button onClick={() => router.push("/plans")} variant="primary" size="lg">
            Back to Plans
          </Button>
        </div>
      </div>
    );
  }

  if (exercises.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
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
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white relative">
      {/* Navigation - Top Left */}
      <div className="fixed top-4 left-4 z-10">
        <button
          onClick={handleNavigateToDashboard}
          disabled={navigatingToDashboard}
          className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Back to Dashboard"
        >
          {navigatingToDashboard ? (
            <svg
              className="animate-spin h-6 w-6"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Workout Timer - Bottom Right on Mobile, Top Right on Desktop */}
      {sessionStartedAt && (
        <div className="fixed bottom-4 right-4 md:bottom-auto md:top-4 bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 md:px-4 shadow-lg z-10">
          <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400">Workout Time</div>
          <div className="text-lg md:text-2xl font-bold font-mono">{formatTime(workoutElapsedTime)}</div>
          {isPaused && (
            <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">Paused</div>
          )}
        </div>
      )}

      {/* Headphone Selector - Bottom Left - Always visible */}
      <div className="fixed bottom-4 left-4 z-10" data-headphone-selector>
        <button
          onClick={() => {
            // Disable selector if audio cues are off
            if (userPreferences?.audio?.audio_cues_enabled === false) return;
            setShowHeadphoneSelector(!showHeadphoneSelector);
          }}
          disabled={userPreferences?.audio?.audio_cues_enabled === false}
          className={`bg-gray-100 dark:bg-gray-800 rounded-lg p-2 md:p-3 shadow-lg transition-colors flex items-center gap-2 ${
            userPreferences?.audio?.audio_cues_enabled === false
              ? "opacity-50 cursor-not-allowed"
              : "hover:bg-gray-200 dark:hover:bg-gray-700"
          }`}
          title={
            userPreferences?.audio?.audio_cues_enabled === false
              ? "Headphones disabled (audio cues off)"
              : selectedHeadphone?.name || "No headphones"
          }
        >
          <svg
            className="w-5 h-5 md:w-6 md:h-6 text-gray-700 dark:text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
            />
          </svg>
          <span className="hidden md:block text-xs text-gray-600 dark:text-gray-400 max-w-[120px] truncate">
            {selectedHeadphone ? selectedHeadphone.name : "No headphones"}
          </span>
        </button>
        
        {showHeadphoneSelector && userPreferences?.audio?.audio_cues_enabled !== false && (
          <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 min-w-[200px] max-w-[300px]">
            <div className="p-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Select Headphones</h3>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {/* No Headphones Option */}
              <button
                onClick={() => handleHeadphoneChange(null)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                  !selectedHeadphone
                    ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400"
                    : "text-gray-700 dark:text-gray-300"
                }`}
              >
                <span>No Headphones</span>
              </button>
              
              {/* Available Headphones */}
              {availableHeadphones.map((headphone) => (
                <button
                  key={headphone.id}
                  onClick={() => handleHeadphoneChange(headphone.id)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                    selectedHeadphone?.id === headphone.id
                      ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400"
                      : "text-gray-700 dark:text-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{headphone.name}</span>
                    {headphone.is_default && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">Default</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Show message when audio cues are disabled */}
        {userPreferences?.audio?.audio_cues_enabled === false && (
          <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-yellow-200 dark:border-yellow-800 min-w-[200px] max-w-[300px] p-3">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Headphones are disabled because audio cues are turned off. Enable audio cues in Settings to use headphones.
            </p>
          </div>
        )}
      </div>
      
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <h1 className="text-3xl font-bold">{plan?.name}</h1>
            {plan?.recommended_day_of_week !== null && plan?.recommended_day_of_week !== undefined && (
              <span className="px-2 py-1 text-xs font-semibold rounded bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300">
                {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][plan.recommended_day_of_week]}
              </span>
            )}
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Exercise {currentExerciseIndex + 1} of {exercises.length}
          </p>
        </div>

        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-8 mb-6">
          <h2 className="text-2xl font-bold mb-4">{currentExercise.name}</h2>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-gray-600 dark:text-gray-400">Set</p>
              <p className="text-3xl font-bold">
                {currentSet} / {currentExercise.sets}
              </p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400">Target Reps</p>
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
              <p className="text-gray-600 dark:text-gray-400">Weight</p>
              <p className="text-2xl font-bold">{currentExercise.weight_lbs} lbs</p>
            </div>
          )}
          {lastCompletedSet && (
            <div className="mt-6 pt-6 border-t border-gray-300 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Last Completed Set (Set {lastCompletedSet.set_number})</p>
              <div className="flex justify-center items-center gap-6">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-500">Reps</p>
                  <p className="text-xl font-semibold">{lastCompletedSet.reps}</p>
                </div>
                {lastCompletedSet.weight_lbs !== null && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-500">Weight</p>
                    <p className="text-xl font-semibold">{lastCompletedSet.weight_lbs} lbs</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {restTime > 0 && (
          <div className="bg-blue-100 dark:bg-blue-900 rounded-lg p-6 mb-6 text-center">
            <p className="text-lg mb-2">Rest Time</p>
            <p className="text-4xl font-bold">{restTime}s</p>
          </div>
        )}

        {showManualInput && (
          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6 mb-6">
            <h3 className="text-xl font-bold mb-4">Record Set Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Reps *
                </label>
                <input
                  type="number"
                  value={manualReps || ""}
                  onChange={(e) => setManualReps(parseInt(e.target.value) || null)}
                  className="w-full px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md border border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="Enter reps"
                  autoFocus
                />
              </div>
              {exercises[currentExerciseIndex]?.weight_lbs && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Weight (lbs)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={manualWeight || ""}
                    onChange={(e) => setManualWeight(parseFloat(e.target.value) || null)}
                    className="w-full px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md border border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:ring-indigo-500"
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
              {/* Pause/Resume Button - Button 1 */}
              <div className="relative">
                <Button
                  onClick={async () => {
                    const newPausedState = !isPaused;
                    setIsPaused(newPausedState);
                    if (newPausedState) {
                      await announceWorkoutPaused(userPreferences?.audio);
                    } else {
                      await announceWorkoutResumed(userPreferences?.audio);
                    }
                  }}
                  variant="secondary"
                  size="lg"
                >
                  {isPaused ? "Resume" : "Pause"}
                </Button>
                {headphoneMappings?.button_1 && (
                  <span className="absolute -top-2 -right-2 bg-indigo-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-white dark:border-gray-900">
                    1
                  </span>
                )}
              </div>
              
              {/* Complete Set Button - Button 2 */}
              <div className="relative">
                <Button onClick={completeSet} variant="primary" size="lg">
                  Complete Set
                </Button>
                {headphoneMappings?.button_2 && (
                  <span className="absolute -top-2 -right-2 bg-indigo-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-white dark:border-gray-900">
                    2
                  </span>
                )}
              </div>
              
              {/* Complete Exercise Button - Button 3 */}
              {!awaitingSetInput && (
                <div className="relative">
                  <Button
                    onClick={async () => {
                      const exercise = exercises[currentExerciseIndex];
                      setShowCompleteExerciseDialog(true);
                      await askExerciseCompletionOption(exercise.name, userPreferences?.audio);
                    }}
                    variant="purple"
                    size="lg"
                  >
                    Complete Exercise
                  </Button>
                  {headphoneMappings?.button_3 && (
                    <span className="absolute -top-2 -right-2 bg-indigo-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-white dark:border-gray-900">
                      3
                    </span>
                  )}
                </div>
              )}
              {awaitingSetInput && (
                <div className="text-center">
                  <p className="text-gray-600 dark:text-gray-400 mb-2">
                    {isListening ? "🎤 Listening... (up to 15 seconds)" : "Waiting for microphone..."}
                  </p>
                  {voiceError && (
                    <p className="text-red-600 dark:text-red-400 text-sm mb-2">
                      Error: {voiceError}. Please check microphone permissions.
                    </p>
                  )}
                  <p className="text-gray-500 dark:text-gray-500 text-xs mb-2">
                    Say something like: "10 reps" or "12 reps with 25 pounds"
                  </p>
                  <Button
                    onClick={() => {
                      if (voiceInputTimeoutRef.current) {
                        clearTimeout(voiceInputTimeoutRef.current);
                        voiceInputTimeoutRef.current = null;
                      }
                      stopListening();
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
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4">
              <h3 className="text-xl font-bold mb-4">Complete Workout?</h3>
              <p className="text-gray-700 dark:text-gray-300 mb-6">
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

        {showCompleteExerciseDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4">
              <h3 className="text-xl font-bold mb-4">
                Complete {exercises[currentExerciseIndex]?.name}?
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                Do you want to skip this exercise completely, or finish it later?
              </p>
              <div className="flex flex-col space-y-3">
                <Button
                  onClick={() => handleCompleteExercise(true)}
                  variant="danger"
                  className="w-full"
                >
                  Skip Exercise
                </Button>
                <Button
                  onClick={() => handleCompleteExercise(false)}
                  variant="purple"
                  className="w-full"
                >
                  Finish Later (Move to End)
                </Button>
                <Button
                  onClick={() => setShowCompleteExerciseDialog(false)}
                  variant="outline"
                  className="w-full"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {selectedHeadphone && (
          <div className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
            <p>Use headphone buttons to control workout</p>
          </div>
        )}
      </div>
    </div>
  );
}
