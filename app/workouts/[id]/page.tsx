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
  askForWarmupInput,
  confirmWarmupRecorded,
  announceExerciseExplanation,
  speakQueued,
  COACH_PERSONALITIES,
  type CoachPersonality,
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
import PostWorkoutFeedback from "@/components/workout/PostWorkoutFeedback";
import {
  getSetTarget,
  type ResolvedSetTarget,
  type SetTarget,
} from "@/lib/workout/setTargets";

interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps_min: number;
  reps_max: number;
  weight_lbs: number | null;
  rest_seconds: number;
  order_index: number;
  originalOrderIndex?: number; // Original position in full exercise list (including skipped/completed)
  is_warmup?: boolean;
  is_cooldown?: boolean;
  notes?: string;
  voice_explanation?: string | null;
  text_explanation?: string | null;
  muscle_groups?: string[] | null;
  /** Per-set target overrides (e.g. AI recommendations). Key = set number (1-based). */
  set_targets?: Record<number, SetTarget>;
}

export default function WorkoutPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;
  const supabase = createClient();
  const { user, profile } = useUser();

  const [plan, setPlan] = useState<any>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [totalExerciseCount, setTotalExerciseCount] = useState<number>(0); // Total count including skipped/completed
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);
  const [restTime, setRestTime] = useState(0);
  const [userPreferences, setUserPreferences] = useState<any>(null);
  const [headphoneMappings, setHeadphoneMappings] = useState<any>(null);
  const [selectedHeadphone, setSelectedHeadphone] = useState<any>(null);
  const [actionButtonBehavior, setActionButtonBehavior] = useState<string>("complete_set");
  const [availableHeadphones, setAvailableHeadphones] = useState<any[]>([]);
  const [showHeadphoneSelector, setShowHeadphoneSelector] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isResting, setIsResting] = useState(false);
  const [availableExercises, setAvailableExercises] = useState<any[]>([]);
  const [awaitingWarmupInput, setAwaitingWarmupInput] = useState(false);
  const awaitingWarmupInputRef = useRef(false);
  // Standard session: standard | tones-only | mute. Coach session: gentle | encouraging | hardcore | military | tones-only | mute.
  type WorkoutAudioMode = "standard" | "tones-only" | "mute" | CoachPersonality;
  const [audioMode, setAudioMode] = useState<WorkoutAudioMode>("standard");
  const [showAudioModeSelector, setShowAudioModeSelector] = useState(false);
  const isCoachPersonality = (m: string): m is CoachPersonality =>
    ["gentle", "encouraging", "hardcore", "military"].includes(m);
  const lastDingTimeRef = useRef<number>(0);
  const hasAnnouncedRef = useRef(false);
  const lastAnnouncedIndexRef = useRef<string>("");
  const isAnnouncingRef = useRef(false);
  const workoutStateLoadedRef = useRef(false);
  const loadingWorkoutRef = useRef(false);
  const loadingPreferencesRef = useRef(false);
  const loadedSessionIdRef = useRef<string | null>(null);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [showCompleteExerciseDialog, setShowCompleteExerciseDialog] = useState(false);
  const [showExplanationDialog, setShowExplanationDialog] = useState(false);
  const [explanationText, setExplanationText] = useState<string | null>(null);
  const [buttonDisabledUntil, setButtonDisabledUntil] = useState<Record<string, number>>({});
  const [coachAssessing, setCoachAssessing] = useState(false);
  const [coachLoadingMessage, setCoachLoadingMessage] = useState("Preparing your workout...");
  const [isCoachSession, setIsCoachSession] = useState(false);
  const isCoachSessionRef = useRef(false);
  const lastKnownAudioPreferencesRef = useRef<{
    tts_provider?: string;
    voice_id?: string;
    speech_rate?: number;
    volume?: number;
    audio_cues_enabled?: boolean;
    audio_mode?: string;
    coach_personality?: CoachPersonality;
  } | null>(null);
  const coachNextSetTargetRef = useRef<{
    exerciseId: string;
    setNumber: number;
    target: ResolvedSetTarget;
  } | null>(null);

  const loadWorkoutState = async (
    sessionId: string,
    planId: string | null,
    options?: { skipSetLoading?: boolean }
  ) => {
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
      // Load session for set_targets (per-set recommendations; used by AI or pre-workout adjustments)
      const { data: sessionRow } = await supabase
        .from("workout_sessions")
        .select("set_targets")
        .eq("id", sessionId)
        .single();
      const sessionSetTargets = (sessionRow?.set_targets as Record<
        string,
        Record<string, SetTarget>
      > | null) ?? null;

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

      // Load available exercises for warm-up/cooldown display
      const { data: exercisesList } = await supabase
        .from("exercises")
        .select("id, name")
        .order("name");
      if (exercisesList) {
        setAvailableExercises(exercisesList);
      }


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
            name,
            muscle_groups,
            voice_explanation,
            text_explanation
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
      let allExerciseIds: string[] = []; // All exercises for counting purposes
      
      if (sessionExercises && sessionExercises.length > 0) {
        // Get ALL exercise IDs for counting (including skipped/completed)
        allExerciseIds = sessionExercises
          .sort((a: any, b: any) => a.order_index - b.order_index)
          .map((se: any) => se.exercise_id);
        
        // Use session-specific order, filtering out completed/skipped exercises for workout flow
        orderedExerciseIds = sessionExercises
          .filter((se: any) => !se.is_completed && !se.skipped)
          .sort((a: any, b: any) => a.order_index - b.order_index)
          .map((se: any) => se.exercise_id);
        
        // Add any exercises from plan that aren't in session exercises
        exercisesData.forEach((pe: any) => {
          if (pe.exercises && !sessionExercises.some((se: any) => se.exercise_id === pe.exercises.id)) {
            orderedExerciseIds.push(pe.exercises.id);
            allExerciseIds.push(pe.exercises.id);
          }
        });
      } else {
        // No session order yet, use plan order and create session exercise records
        orderedExerciseIds = exercisesData
          .filter((pe: any) => pe.exercises)
          .map((pe: any) => pe.exercises.id);
        
        // All exercises for counting (same as ordered since nothing is skipped yet)
        allExerciseIds = [...orderedExerciseIds];
        
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

      // Set total exercise count (including skipped/completed) for display purposes
      setTotalExerciseCount(allExerciseIds.length);

      // Create a map of all exercises (including skipped/completed) for position lookup
      const allExercisesMap = new Map<string, number>();
      allExerciseIds.forEach((id, idx) => {
        allExercisesMap.set(id, idx);
      });

      // Format exercises preserving order from orderedExerciseIds.
      // When user has reordered (e.g. moved to end), session order takes precedence.
      // Do NOT force warmup first / cooldown last - that would undo "move to end" and
      // cause warmup to reappear after completing the moved exercise.
      const formatted: Exercise[] = [];
      
      for (const exerciseId of orderedExerciseIds) {
        const pe = exerciseDataMap.get(exerciseId);
        if (!pe || !pe.exercises) continue;
        
        const targetSets = pe.sets_max && pe.sets_max > pe.sets ? pe.sets_max : pe.sets;
        const targetRepsMax = pe.reps_max === 999 ? pe.reps_min : pe.reps_max;
        
        // Get original position in full exercise list (including skipped/completed)
        const originalPosition = allExercisesMap.get(exerciseId) ?? orderedExerciseIds.indexOf(exerciseId);
        
        const rawSetTargets = sessionSetTargets?.[pe.exercises.id];
        const set_targets: Record<number, SetTarget> | undefined = rawSetTargets
          ? Object.fromEntries(
              Object.entries(rawSetTargets).map(([k, v]) => [parseInt(k, 10), v])
            )
          : undefined;

        const exercise: Exercise = {
          id: pe.exercises.id,
          name: pe.exercises.name,
          sets: targetSets,
          reps_min: pe.reps_min,
          reps_max: targetRepsMax,
          weight_lbs: (pe as any).weight_lbs,
          rest_seconds: pe.rest_seconds,
          order_index: formatted.length,
          originalOrderIndex: originalPosition,
          is_warmup: (pe as any).is_warmup || false,
          is_cooldown: (pe as any).is_cooldown || false,
          notes: (pe as any).notes || null,
          voice_explanation: pe.exercises.voice_explanation || null,
          text_explanation: pe.exercises.text_explanation || null,
          muscle_groups: pe.exercises.muscle_groups || null,
          set_targets: Object.keys(set_targets ?? {}).length > 0 ? set_targets : undefined,
        };
        
        formatted.push(exercise);
      }
      
      // Update order_index to reflect final order
      formatted.forEach((ex, idx) => {
        ex.order_index = idx;
      });

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
      if (!options?.skipSetLoading) setLoading(false);
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
      stopBackgroundMusic();
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

    localStorage.setItem("activeWorkoutSessionId", session.id);
    setSessionStartedAt(session.started_at);
    totalPausedTimeRef.current = 0;
    pauseStartTimeRef.current = null;
    loadedSessionIdRef.current = sessionId;

    const coachMode = !!(session as { coach_mode?: boolean }).coach_mode;
    isCoachSessionRef.current = coachMode;
    setIsCoachSession(coachMode);
    if (coachMode) setAudioMode((profile?.preferences?.audio?.coach_personality as CoachPersonality) || "encouraging");

    const hasSetTargets =
      session.set_targets &&
      typeof session.set_targets === "object" &&
      Object.keys(session.set_targets).length > 0;

    if (coachMode && !hasSetTargets) {
      setCoachAssessing(true);
      setCoachLoadingMessage("Assessing your progress...");
      try {
        const assessRes = await fetch("/api/ai/coach-assess", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: session.id }),
        });
        if (!assessRes.ok) {
          const errData = await assessRes.json().catch(() => ({}));
          throw new Error(errData.error || "Coach assessment failed");
        }
        const assessData = await assessRes.json();
        setCoachLoadingMessage("Personalizing your sets...");
        await loadWorkoutState(session.id, session.workout_plan_id, {
          skipSetLoading: true,
        });
        const welcomeMessage =
          assessData.welcome_message?.trim() || "Let's have a great workout.";
        // Use profile preferences—userPreferences may not be loaded yet when coach starts
        let audioPrefs = userPreferences?.audio ?? profile?.preferences?.audio;
        if (!audioPrefs && user) {
          const { data: profileRow } = await supabase
            .from("user_profiles")
            .select("preferences")
            .eq("id", user.id)
            .single();
          audioPrefs = (profileRow?.preferences as any)?.audio;
        }
        const prefs = {
          ...audioPrefs,
          tts_provider: audioPrefs?.tts_provider ?? "browser",
          voice_id: audioPrefs?.voice_id ?? "alloy",
          speech_rate: audioPrefs?.speech_rate ?? 1.0,
          volume: audioPrefs?.volume ?? 0.8,
          audio_mode: "coach" as const,
          audio_cues_enabled: audioPrefs?.audio_cues_enabled !== false,
          coach_personality: (audioPrefs?.coach_personality as CoachPersonality) ?? "encouraging",
        };
        // Seed userPreferences so the warmup announcement can run immediately after welcome
        // (it otherwise waits for loadPreferences, causing a long delay)
        const coachFlowPrefs = { ...(profile?.preferences || userPreferences || {}), audio: prefs };
        setUserPreferences(coachFlowPrefs);
        lastKnownAudioPreferencesRef.current = prefs;
        await speakQueued(welcomeMessage, prefs);
      } catch (err) {
        console.error("Coach assessment error:", err);
        setError(err instanceof Error ? err.message : "Coach preparation failed");
        setLoading(false);
      } finally {
        setCoachAssessing(false);
        setLoading(false);
      }
      return;
    }

    await loadWorkoutState(session.id, session.workout_plan_id);
  };

  useEffect(() => {
    if (loadedSessionIdRef.current !== sessionId) {
      loadedSessionIdRef.current = null;
      loadingWorkoutRef.current = false;
      workoutStateLoadedRef.current = false;
      isCoachSessionRef.current = false;
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
  const [lastCompletedSet, setLastCompletedSet] = useState<{
    id: string;
    reps: number;
    weight_lbs: number | null;
    set_number: number;
    exercise_id: string;
    exercise_name: string;
    is_warmup?: boolean;
    is_cooldown?: boolean;
  } | null>(null);
  const [showEditLastSet, setShowEditLastSet] = useState(false);
  const [editLastSetReps, setEditLastSetReps] = useState<number>(0);
  const [editLastSetWeight, setEditLastSetWeight] = useState<number | null>(null);
  const [workoutElapsedTime, setWorkoutElapsedTime] = useState(0);
  const pauseStartTimeRef = useRef<number | null>(null);
  const totalPausedTimeRef = useRef<number>(0);
  const voiceInputTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const nextSetAnnouncedRef = useRef<string>("");
  const restEndHandledRef = useRef(false);
  const fetchingLastSetRef = useRef(false);

  // Keep refs in sync with state
  useEffect(() => {
    awaitingSetInputRef.current = awaitingSetInput;
  }, [awaitingSetInput]);

  // Fetch last completed set in entire session (so we show it even on first set of new exercise)
  useEffect(() => {
    const fetchLastCompletedSet = async () => {
      if (fetchingLastSetRef.current) return;
      if (!sessionId || exercises.length === 0) {
        setLastCompletedSet(null);
        return;
      }

      fetchingLastSetRef.current = true;
      try {
        const { data: lastSet, error: setsError } = await supabase
          .from("workout_sets")
          .select(`
            id,
            reps,
            weight_lbs,
            set_number,
            exercise_id,
            exercises (
              id,
              name,
              category
            )
          `)
          .eq("workout_session_id", sessionId)
          .order("completed_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (setsError) {
          console.error("Error fetching last completed set:", setsError);
          setLastCompletedSet(null);
        } else if (lastSet && lastSet.exercises) {
          const raw = lastSet.exercises;
          const ex = Array.isArray(raw) ? raw[0] : raw;
          const isWarmup = ex?.category === "warmup";
          const isCooldown = ex?.category === "cooldown";
          setLastCompletedSet({
            id: lastSet.id,
            reps: lastSet.reps ?? 0,
            weight_lbs: lastSet.weight_lbs,
            set_number: lastSet.set_number,
            exercise_id: lastSet.exercise_id,
            exercise_name: ex?.name ?? "Unknown",
            is_warmup: isWarmup,
            is_cooldown: isCooldown,
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

  // Handle browser navigation (back button, closing tab, etc.)
  useEffect(() => {
    const handleBeforeUnload = () => {
      stopBackgroundMusic();
    };

    // Listen for browser navigation events (back button, closing tab, etc.)
    window.addEventListener("beforeunload", handleBeforeUnload);

    // Cleanup
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // Ensure music is stopped on cleanup
      stopBackgroundMusic();
    };
  }, []);

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
      const preferences = {
        ...profile.preferences,
        audio: {
          ...profile.preferences.audio,
          audio_cues_enabled: profile.preferences.audio?.audio_cues_enabled !== false,
          audio_mode: ((profile.preferences.audio as any)?.audio_mode || "standard") as "coach" | "standard" | "tones-only" | "mute",
          coach_personality: (profile.preferences.audio as any)?.coach_personality as CoachPersonality | undefined,
        },
      };
      setUserPreferences(preferences);
      lastKnownAudioPreferencesRef.current = preferences.audio;
      if (!isCoachSessionRef.current) {
        setAudioMode((preferences.audio.audio_mode === "coach" ? "standard" : preferences.audio.audio_mode) || "standard");
      } else {
        setAudioMode((preferences.audio.coach_personality as CoachPersonality) || "encouraging");
      }
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
      lastKnownAudioPreferencesRef.current = defaultPreferences.audio;
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
        setActionButtonBehavior("complete_set");
        return;
      }
      
      // Load default headphone (or first one if no default)
      if (allHeadphones.length > 0) {
        const defaultHeadphone = allHeadphones.find(h => h.is_default) || allHeadphones[0];
        setSelectedHeadphone(defaultHeadphone);
        setHeadphoneMappings(defaultHeadphone.button_mappings);
        setActionButtonBehavior(defaultHeadphone.action_button_behavior || "complete_set");
      } else {
        // No headphones configured - default to "No Headphones"
        setSelectedHeadphone(null);
        setHeadphoneMappings(null);
        setActionButtonBehavior("complete_set");
      }
    }
  };

  const handleHeadphoneChange = (headphoneId: string | null) => {
    if (headphoneId === null) {
      // "No Headphones" selected
      setSelectedHeadphone(null);
      setHeadphoneMappings(null);
      setActionButtonBehavior("complete_set");
      setShowHeadphoneSelector(false);
    } else {
      const headphone = availableHeadphones.find(h => h.id === headphoneId);
      if (headphone) {
        setSelectedHeadphone(headphone);
        setHeadphoneMappings(headphone.button_mappings);
        setActionButtonBehavior(headphone.action_button_behavior || "complete_set");
        setShowHeadphoneSelector(false);
      }
    }
  };

  // Announce current exercise (including warm-up/cooldown)
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
      // Use originalOrderIndex for exercise number to include skipped/completed exercises in count
      const exerciseNumber = exercise.originalOrderIndex !== undefined && totalExerciseCount > 0
        ? exercise.originalOrderIndex + 1
        : currentExerciseIndex + 1;
      
      // Play transition ding if in tones-only mode
      if (audioMode === "tones-only" || audioMode === "mute") {
        if (audioMode === "tones-only") {
          playTransitionDing();
        }
      } else {
        const setT = getSetTarget(exercise, currentSet);
        await announceCurrentExercise(
          {
            exerciseNumber: exerciseNumber,
            exerciseName: exercise.name,
            currentSet: currentSet,
            totalSets: exercise.sets,
            repsMin: setT.reps_min,
            repsMax: setT.reps_max,
            weightLbs: setT.weight_lbs,
            is_warmup: exercise.is_warmup,
            is_cooldown: exercise.is_cooldown,
            notes: exercise.notes,
          },
          getAudioPreferences()
        );
      }
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
    
    // Play transition ding if in tones-only mode
    if (audioMode === "tones-only") {
      playTransitionDing();
    } else if (audioMode !== "mute") {
      await announceRestPeriod(seconds, getAudioPreferences(), nextInfo);
    }
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
      const coachRef = coachNextSetTargetRef.current;
      const useCoachTarget =
        isCoachSession &&
        coachRef &&
        coachRef.exerciseId === exercise.id &&
        coachRef.setNumber === currentSet;
      const setT = useCoachTarget
        ? coachRef.target
        : getSetTarget(exercise, currentSet);
      if (useCoachTarget) coachNextSetTargetRef.current = null;

      await announceNextSet(
        {
          currentSet: currentSet,
          totalSets: exercise.sets,
          repsMin: setT.reps_min,
          repsMax: setT.reps_max,
          weightLbs: setT.weight_lbs,
          exerciseName: exercise.name,
          is_warmup: exercise.is_warmup,
          is_cooldown: exercise.is_cooldown,
          notes: exercise.notes,
        },
        getAudioPreferences()
      );
    } else if (currentExerciseIndex < exercises.length - 1) {
      const nextExercise = exercises[currentExerciseIndex + 1];
      // Play transition ding if in tones-only mode
      if (audioMode === "tones-only") {
        playTransitionDing();
      } else if (audioMode !== "mute") {
        await announceNextExercise(nextExercise.name, getAudioPreferences());
      }
    }
    
    isAnnouncingRef.current = false;
  };

  const handleRestEnd = async () => {
    restAnnouncedRef.current = false;
    disableButtonTemporarily("skipRest");
    setIsResting(false);
    
    const announcementKey = `${currentExerciseIndex}-${currentSet}`;
    lastAnnouncedIndexRef.current = announcementKey;
    hasAnnouncedRef.current = true;
    isAnnouncingRef.current = true;
    
    nextSetAnnouncedRef.current = "";
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    await handleAnnounceNextSet();
    
    isAnnouncingRef.current = false;
  };

  const handleButtonPress = async (buttonNumber: 1 | 2 | 3) => {
    // Button 1 uses action_button_behavior from selected headphone
    // Button 2 and 3 are not used anymore (only single button supported)
    
    if (buttonNumber === 1) {
      // Use the action_button_behavior setting
      switch (actionButtonBehavior) {
        case "pause_resume":
          const newPausedState = !isPaused;
          setIsPaused(newPausedState);
          if (newPausedState) {
            if (audioMode !== "mute") {
              await announceWorkoutPaused(getAudioPreferences());
            }
          } else {
            if (audioMode !== "mute") {
              await announceWorkoutResumed(getAudioPreferences());
            }
          }
          break;
        case "complete_set":
          if (isResting) {
            handleRestEnd();
          } else {
            completeSet();
          }
          break;
        case "complete_exercise":
          if (!awaitingSetInput && exercises.length > 0) {
            const exercise = exercises[currentExerciseIndex];
            setShowCompleteExerciseDialog(true);
            if (audioMode !== "mute") {
              await askExerciseCompletionOption(exercise.name, getAudioPreferences(), {
                isWarmupOrCooldown: exercise.is_warmup || exercise.is_cooldown,
              });
            }
          }
          break;
        case "complete_workout":
          setShowCompleteConfirm(true);
          break;
        default:
          // Default to complete_set / skip rest
          if (isResting) {
            handleRestEnd();
          } else {
            completeSet();
          }
      }
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
    if (audioMode === "mute") return; // Don't play any sounds in mute mode
    
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
    if (audioMode === "mute") return; // Don't play any sounds in mute mode
    
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
    if (audioMode === "mute") return; // Don't play any sounds in mute mode
    
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

  const playTransitionDing = () => {
    if (audioMode === "mute") return; // Don't play any sounds in mute mode
    
    // Prevent duplicate dings if multiple transitions happen at once
    const now = Date.now();
    if (now - lastDingTimeRef.current < 200) {
      return; // Skip if ding was played within last 200ms
    }
    lastDingTimeRef.current = now;

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = "sine";
      
      gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.error("Error playing transition ding:", error);
    }
  };

  // Helper: always return a preferences object so TTS never gets undefined and falls back to browser.
  // Use last-known prefs from ref when state is missing (e.g. stale closure or race during timeout).
  const getAudioPreferences = () => {
    const audio = userPreferences?.audio ?? lastKnownAudioPreferencesRef.current;
    const base = audio ?? {
      tts_provider: "browser",
      voice_id: "alloy",
      speech_rate: 1.0,
      volume: 0.8,
      audio_cues_enabled: true,
    };
    const mode = audioMode;
    const effectiveAudioMode: "coach" | "standard" | "tones-only" | "mute" =
      isCoachSession && isCoachPersonality(mode) ? "coach" : (mode as "standard" | "tones-only" | "mute");
    const coach_personality =
      isCoachSession && isCoachPersonality(mode) ? (mode as CoachPersonality) : undefined;
    return {
      ...base,
      audio_mode: effectiveAudioMode,
      coach_personality,
    };
  };

  // Handle showing exercise explanation
  const handleShowExplanation = async () => {
    if (!currentExercise || isButtonDisabled("explanation")) return;

    const hasVoiceExplanation = currentExercise.voice_explanation && currentExercise.voice_explanation.trim() !== "";
    const hasTextExplanation = currentExercise.text_explanation && currentExercise.text_explanation.trim() !== "";
    
    if (!hasVoiceExplanation && !hasTextExplanation) {
      // No explanation available
      return;
    }

    disableButtonTemporarily("explanation");

    const audioPrefs = getAudioPreferences();
    const voiceOn = audioMode !== "mute" && audioMode !== "tones-only";
    const shouldPlayAudio =
      audioPrefs?.audio_cues_enabled !== false && voiceOn && hasVoiceExplanation;

    if (shouldPlayAudio) {
      // Play voice explanation using speech manager
      await announceExerciseExplanation(currentExercise.voice_explanation!, audioPrefs);
    } else {
      // Show text dialog (for mute, tones-only, or when only text is available)
      setExplanationText(hasTextExplanation ? currentExercise.text_explanation! : currentExercise.voice_explanation!);
      setShowExplanationDialog(true);
    }
  };

  // Save audio mode preference to database
  const saveAudioMode = async (mode: WorkoutAudioMode) => {
    if (!user) return;

    const audio: typeof userPreferences.audio = {
      ...userPreferences?.audio,
    };
    if (isCoachSession) {
      if (isCoachPersonality(mode)) {
        audio.audio_mode = "coach";
        audio.coach_personality = mode;
      } else {
        audio.audio_mode = mode as "tones-only" | "mute";
      }
    } else {
      audio.audio_mode = mode as "standard" | "tones-only" | "mute";
    }

    const updatedPreferences = { ...userPreferences, audio };
    setUserPreferences(updatedPreferences);
    lastKnownAudioPreferencesRef.current = audio;

    const { error } = await supabase
      .from("user_profiles")
      .update({ preferences: updatedPreferences })
      .eq("id", user.id);

    if (error) {
      console.error("Error saving audio mode:", error);
    }
  };

  const { startListening, isListening, stopListening, error: voiceError } = useVoiceInput(
    async (text) => {
      // Handle voice input
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
      
      const exercise = exercises[currentExerciseIndex];
      const setTForVoice = exercise ? getSetTarget(exercise, currentSet) : null;
      const hasWeightForSet = !!setTForVoice?.weight_lbs;

      // Handle regular exercise set input
      try {
        const isTimeBasedForVoice = exercise?.is_warmup || exercise?.is_cooldown;
        const response = await fetch("/api/ai/parse-set-input", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript: text,
            hasWeight: hasWeightForSet && !isTimeBasedForVoice,
            isTimeBased: isTimeBasedForVoice,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to parse input");
        }

        const { reps, weight } = await response.json();

        // Log for debugging
        console.log("AI parsed input:", { transcript: text, reps, weight, hasWeight: hasWeightForSet });

        if (reps !== null && reps > 0) {
          // If this set has weight but none parsed, log a warning but still proceed (handleSetInput will use set target default)
          if (hasWeightForSet && weight === null) {
            console.warn("Weight exercise but no weight parsed from:", text);
          }
          await handleSetInput(reps, weight);
        } else {
          console.warn("AI could not parse reps from voice input:", text);
          setAwaitingSetInput(true);
          awaitingSetInputRef.current = true;
          const isTimeBasedRetry = exercise?.is_warmup || exercise?.is_cooldown;
          await askForSetInput(hasWeightForSet && !isTimeBasedRetry, getAudioPreferences(), { isTimeBased: isTimeBasedRetry });
          playListeningSound();
          startListening();
          voiceInputTimeoutRef.current = setTimeout(() => {
            handleVoiceInputTimeout();
          }, 15000);
        }
      } catch (error) {
        console.error("Error parsing voice input with AI:", error);
        const isTimeBasedCatch = exercise?.is_warmup || exercise?.is_cooldown;
        const hasWeight = hasWeightForSet && !isTimeBasedCatch;

        if (!hasWeight) {
          // For time-based or bodyweight: single number is minutes (warmup/cooldown) or reps
          const repsMatch = text.match(/(\d+)/i);
          const reps = repsMatch ? parseInt(repsMatch[1]) : null;
          
          if (reps !== null && reps > 0) {
            await handleSetInput(reps, null);
          } else {
            setAwaitingSetInput(true);
            awaitingSetInputRef.current = true;
            await askForSetInput(false, getAudioPreferences(), { isTimeBased: isTimeBasedCatch });
            playListeningSound();
            startListening();
            voiceInputTimeoutRef.current = setTimeout(() => {
              handleVoiceInputTimeout();
            }, 15000);
          }
        } else {
          // Improved regex patterns to capture weight in various formats
          // Pattern 1: "X reps with Y pounds/lbs/kg"
          // Pattern 2: "X reps Y pounds/lbs/kg"
          // Pattern 3: "X at Y" or "X with Y"
          // Pattern 4: Just "Y pounds/lbs/kg" after reps
          // IMPORTANT: 0 lbs or 0 kg = body weight, must be captured as weight: 0
          const repsMatch = text.match(/(\d+)\s*reps?/i) || text.match(/(\d+)(?:\s+reps?)?/i);
          const weightMatch = text.match(/(?:with|at|\s+)(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?|lb|kgs?|kilos?)/i) ||
                              text.match(/(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?|lb|kgs?|kilos?)/i);
          
          const reps = repsMatch ? parseInt(repsMatch[1]) : null;
          // Use null only when no match; 0 from "0 lbs" or "0 kg" is valid (body weight)
          let weight: number | null = weightMatch ? parseFloat(weightMatch[1]) : null;
          
          // If no explicit weight match but we have two numbers, the second might be weight (including 0)
          if (weight === null && reps) {
            const allNumbers = text.match(/\d+(?:\.\d+)?/g);
            if (allNumbers && allNumbers.length >= 2) {
              const potentialWeight = parseFloat(allNumbers[1]);
              // Include 0 (body weight); reasonable range 0-500 lbs
              if (potentialWeight >= 0 && potentialWeight <= 500) {
                weight = potentialWeight;
              }
            }
          }
          
          if (reps !== null && reps > 0) {
            await handleSetInput(reps, weight);
          } else {
            setAwaitingSetInput(true);
            awaitingSetInputRef.current = true;
            await askForSetInput(true, getAudioPreferences(), { isTimeBased: isTimeBasedCatch });
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


  const handleVoiceInputTimeout = async (options?: { skipAnnouncement?: boolean }) => {
    if (!awaitingSetInputRef.current) return;

    stopListening();

    playDoubleBeep();

    await new Promise((resolve) => setTimeout(resolve, 300));

    setAwaitingSetInput(false);
    awaitingSetInputRef.current = false;
    setShowManualInput(true);

    const exercise = exercises[currentExerciseIndex];
    if (exercise) {
      const setT = getSetTarget(exercise, currentSet);
      setManualReps(setT.reps_min);
      setManualWeight(setT.weight_lbs);
    }

    // Only announce "please fill it out manually" when the 15s timeout fired, not when
    // the user clicked "Skip to Manual" (they already know). Avoids redundant speech
    // and reduces chance of overlap if they save quickly.
    if (audioMode !== "mute" && !options?.skipAnnouncement) {
      await announceManualInputNeeded(getAudioPreferences());
    }
  };

  const completeSet = async () => {
    if (!userPreferences || exercises.length === 0 || isButtonDisabled("completeSet")) return;
    
    const exercise = exercises[currentExerciseIndex];
    if (!exercise) return;

    disableButtonTemporarily("completeSet");

    // Handle regular set completion
    setAwaitingSetInput(true);
    awaitingSetInputRef.current = true;
    setShowManualInput(false);
    
    const setT = getSetTarget(exercise, currentSet);
    const isTimeBased = exercise.is_warmup || exercise.is_cooldown;
    await askForSetInput(!!setT.weight_lbs && !isTimeBased, getAudioPreferences(), { isTimeBased });

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
    if (isButtonDisabled("manualSave")) return;
    
    // Handle regular set completion
    if (manualReps === null || manualReps <= 0) {
      alert("Please enter the number of reps");
      return;
    }
    
    disableButtonTemporarily("manualSave");
    setShowManualInput(false);
    await handleSetInput(manualReps, manualWeight);
  };


  const handleSetInput = async (reps: number, weight: number | null) => {
    if (!sessionId || exercises.length === 0) return;
    
    const exercise = exercises[currentExerciseIndex];
    if (!exercise) return;

    // Handle regular set completion
    
    if (voiceInputTimeoutRef.current) {
      clearTimeout(voiceInputTimeoutRef.current);
      voiceInputTimeoutRef.current = null;
    }
    
    setAwaitingSetInput(false);
    setShowManualInput(false);
    
    const setT = getSetTarget(exercise, currentSet);
    const weightToSave = weight !== null ? weight : setT.weight_lbs;
    
    // Play transition ding if in tones-only mode
    if (audioMode === "tones-only") {
      playTransitionDing();
    } else if (audioMode !== "mute") {
      const isTimeBasedConfirm = exercise.is_warmup || exercise.is_cooldown;
      await confirmSetRecorded(reps, weightToSave, getAudioPreferences(), { isTimeBased: isTimeBasedConfirm });
    }
    
    const { data: insertedSet } = await supabase
      .from("workout_sets")
      .insert({
        workout_session_id: sessionId,
        exercise_id: exercise.id,
        set_number: currentSet,
        reps: reps,
        weight_lbs: weightToSave,
        rest_seconds: exercise.rest_seconds,
      })
      .select("id")
      .single();

    setLastCompletedSet({
      id: insertedSet?.id ?? "",
      reps: reps,
      weight_lbs: weightToSave,
      set_number: currentSet,
      exercise_id: exercise.id,
      exercise_name: exercise.name,
      is_warmup: exercise.is_warmup,
      is_cooldown: exercise.is_cooldown,
    });

    if (isCoachSession && !exercise.is_warmup && !exercise.is_cooldown) {
      const nextSetNumber = currentSet + 1;
      const nextSetPlanDefault =
        nextSetNumber <= exercise.sets
          ? getSetTarget(exercise, nextSetNumber)
          : null;
      fetch("/api/ai/coach-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          setNumberJustCompleted: currentSet,
          totalSets: exercise.sets,
          completedReps: reps,
          completedWeightLbs: weightToSave,
          completedSetsSoFar: [{ set_number: currentSet, reps, weight_lbs: weightToSave }],
          nextSetPlanDefault: nextSetPlanDefault
            ? { reps_min: nextSetPlanDefault.reps_min, reps_max: nextSetPlanDefault.reps_max, weight_lbs: nextSetPlanDefault.weight_lbs }
            : null,
          muscle_groups: exercise.muscle_groups ?? undefined,
          form_cue: exercise.text_explanation ?? exercise.voice_explanation ?? undefined,
          coach_personality: getAudioPreferences().coach_personality ?? "encouraging",
        }),
      })
        .then((res) => res.ok && res.json())
        .then((data: { encouragement?: string | null; next_set_target?: { reps?: number; weight_lbs?: number | null } | null }) => {
          if (data?.encouragement && data.encouragement.trim()) {
            speakQueued(data.encouragement.trim(), getAudioPreferences());
          }
          if (data?.next_set_target && nextSetNumber <= exercise.sets) {
            const nt = data.next_set_target;
            const resolved: ResolvedSetTarget = {
              reps_min: nt.reps ?? exercise.reps_min,
              reps_max: nt.reps ?? exercise.reps_max,
              weight_lbs: nt.weight_lbs ?? null,
            };
            coachNextSetTargetRef.current = {
              exerciseId: exercise.id,
              setNumber: nextSetNumber,
              target: resolved,
            };
            setExercises((prev) =>
              prev.map((ex) =>
                ex.id === exercise.id
                  ? {
                      ...ex,
                      set_targets: {
                        ...ex.set_targets,
                        [nextSetNumber]: data.next_set_target!,
                      },
                    }
                  : ex
              )
            );
          }
        })
        .catch((err) => console.error("Coach message error:", err));
    }

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
        // Play transition ding if in tones-only mode when moving to next exercise
        if (audioMode === "tones-only") {
          playTransitionDing();
        }
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
        coachNextSetTargetRef.current = null;
      } else {
        // Check if there's a cooldown
        const hasCooldown = !!plan?.cooldown_duration_minutes;
        if (hasCooldown) {
          // Transition to cooldown - play ding if in tones-only mode
          if (audioMode === "tones-only") {
            playTransitionDing();
          }
          // Cooldown will be shown automatically by loadWorkoutState logic
          // Don't complete workout yet - wait for cooldown
        } else {
          await completeWorkout();
        }
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

    // Play transition ding if in tones-only mode
    if (audioMode === "tones-only") {
      playTransitionDing();
    } else if (userPreferences && audioMode !== "mute") {
      await announceWorkoutComplete(getAudioPreferences());
    }

    // Mark workout as completed and show feedback form
    setWorkoutCompleted(true);
    setShowFeedbackForm(true);
  };

  const handleFeedbackComplete = () => {
    setShowFeedbackForm(false);
    router.push("/history");
  };

  const handleFeedbackSkip = () => {
    setShowFeedbackForm(false);
    router.push("/history");
  };


  // Helper function to disable a button for 5 seconds
  const disableButtonTemporarily = (buttonId: string) => {
    const disabledUntil = Date.now() + 5000; // 5 seconds
    setButtonDisabledUntil((prev) => ({
      ...prev,
      [buttonId]: disabledUntil,
    }));
    
    // Auto-enable after 5 seconds
    setTimeout(() => {
      setButtonDisabledUntil((prev) => {
        const updated = { ...prev };
        delete updated[buttonId];
        return updated;
      });
    }, 5000);
  };

  // Check if a button is currently disabled
  const isButtonDisabled = (buttonId: string): boolean => {
    const disabledUntil = buttonDisabledUntil[buttonId];
    if (!disabledUntil) return false;
    return Date.now() < disabledUntil;
  };
  const [navigatingToDashboard, setNavigatingToDashboard] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [workoutCompleted, setWorkoutCompleted] = useState(false);

  const handleCompleteWorkoutClick = () => {
    if (isButtonDisabled("completeWorkout")) return;
    disableButtonTemporarily("completeWorkout");
    setShowCompleteConfirm(true);
  };

  const handleConfirmComplete = async () => {
    if (isButtonDisabled("confirmComplete")) return;
    disableButtonTemporarily("confirmComplete");
    setShowCompleteConfirm(false);
    await completeWorkout();
  };

  const handleCompleteExercise = async (skip: boolean) => {
    if (!sessionId || exercises.length === 0 || isButtonDisabled("completeExercise")) return;

    disableButtonTemporarily("completeExercise");
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

      // Play transition ding if in tones-only mode
      if (audioMode === "tones-only") {
        playTransitionDing();
      } else if (audioMode !== "mute") {
        await announceExerciseSkipped(exercise.name, getAudioPreferences());
      }
      
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

      // Play transition ding if in tones-only mode
      if (audioMode === "tones-only") {
        playTransitionDing();
      } else if (audioMode !== "mute") {
        await announceExerciseMovedToEnd(exercise.name, getAudioPreferences());
      }
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
    
    // Stop background music before navigation
    stopBackgroundMusic();
    
    // Pause workout immediately (don't wait for announcement)
    if (!isPaused && sessionStartedAt) {
      setIsPaused(true);
      // Announce in background - don't wait for it
      if (userPreferences) {
        announceWorkoutPaused(getAudioPreferences()).catch(console.error);
      }
    }
    
    // Redirect immediately
    router.push("/dashboard");
  };

  // Show feedback form after workout completion
  if (showFeedbackForm && workoutCompleted && sessionId && plan) {
    const exerciseIds = exercises.map((e) => e.id);
    return (
      <PostWorkoutFeedback
        sessionId={sessionId}
        planName={plan.name || "Workout"}
        exerciseIds={exerciseIds}
        onComplete={handleFeedbackComplete}
        onSkip={handleFeedbackSkip}
      />
    );
  }

  if (loading || coachAssessing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
        <div className="text-center max-w-sm px-4">
          {coachAssessing ? (
            <>
              <p className="text-xl font-semibold mb-2">Your Coach is preparing your workout</p>
              <p className="text-gray-600 dark:text-gray-400 mb-6">{coachLoadingMessage}</p>
            </>
          ) : (
            <p className="text-xl mb-6">Loading workout...</p>
          )}
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
          <Button onClick={() => {
            stopBackgroundMusic();
            router.push("/plans");
          }} variant="primary" size="lg">
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
          <Button onClick={() => {
            stopBackgroundMusic();
            router.push("/plans");
          }} variant="primary" size="lg">
            Back to Plans
          </Button>
        </div>
      </div>
    );
  }

  const currentExercise = exercises.length > 0 && currentExerciseIndex < exercises.length 
    ? exercises[currentExerciseIndex] 
    : null;

  // Calculate exercise number based on original position in all exercises (including skipped/completed)
  const exerciseNumber = currentExercise && currentExercise.originalOrderIndex !== undefined && totalExerciseCount > 0
    ? currentExercise.originalOrderIndex + 1
    : (currentExerciseIndex < exercises.length ? currentExerciseIndex + 1 : null);

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

      {/* Workout Timer - Top Right on Desktop, Above Audio Mode Selector on Mobile */}
      {sessionStartedAt && (
        <div className="fixed bottom-20 right-4 md:bottom-auto md:top-4 bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 md:px-4 shadow-lg z-10">
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

      {/* Audio Mode Selector - Bottom Right. Standard session: Standard / Tones / Mute. Coach session: personality + Tones / Mute. */}
      <div className="fixed bottom-4 right-4 z-10" data-audio-mode-selector>
        <button
          onClick={() => setShowAudioModeSelector(!showAudioModeSelector)}
          className="bg-gray-100 dark:bg-gray-800 rounded-lg p-2 md:p-3 shadow-lg transition-colors hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center gap-2"
          title={`Audio: ${isCoachSession && isCoachPersonality(audioMode) ? COACH_PERSONALITIES.find((p) => p.id === audioMode)?.label ?? audioMode : audioMode === "standard" ? "Standard" : audioMode === "tones-only" ? "Tones Only" : "Mute"}`}
        >
          {isCoachSession && isCoachPersonality(audioMode) && (
            <svg className="w-5 h-5 md:w-6 md:h-6 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 4h8M8 4a2 2 0 00-2 2v1a2 2 0 002 2h8a2 2 0 002-2V6a2 2 0 00-2-2" />
            </svg>
          )}
          {(!isCoachSession || !isCoachPersonality(audioMode)) && audioMode === "standard" && (
            <svg className="w-5 h-5 md:w-6 md:h-6 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          )}
          {audioMode === "tones-only" && (
            <svg className="w-5 h-5 md:w-6 md:h-6 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          )}
          {audioMode === "mute" && (
            <svg className="w-5 h-5 md:w-6 md:h-6 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          )}
          <span className="hidden md:block text-xs text-gray-600 dark:text-gray-400 max-w-[100px] truncate">
            {isCoachSession && isCoachPersonality(audioMode) ? COACH_PERSONALITIES.find((p) => p.id === audioMode)?.label ?? audioMode : audioMode === "standard" ? "Standard" : audioMode === "tones-only" ? "Tones" : "Mute"}
          </span>
        </button>
        
        {showAudioModeSelector && (
          <div className="absolute bottom-full right-0 mb-2 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 min-w-[200px]">
            <div className="p-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{isCoachSession ? "Coach tone" : "Audio Mode"}</h3>
            </div>
            <div>
              {isCoachSession ? (
                <>
                  {COACH_PERSONALITIES.map((p) => (
                    <button
                      key={p.id}
                      onClick={async () => {
                        setAudioMode(p.id);
                        setShowAudioModeSelector(false);
                        await saveAudioMode(p.id);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 ${
                        audioMode === p.id ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400" : "text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 4h8M8 4a2 2 0 00-2 2v1a2 2 0 002 2h8a2 2 0 002-2V6a2 2 0 00-2-2" />
                      </svg>
                      <span>{p.label}</span>
                    </button>
                  ))}
                </>
              ) : (
                <button
                  onClick={async () => {
                    setAudioMode("standard");
                    setShowAudioModeSelector(false);
                    await saveAudioMode("standard");
                  }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 ${
                    audioMode === "standard" ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400" : "text-gray-700 dark:text-gray-300"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                  <span>Standard</span>
                </button>
              )}
              <button
                onClick={async () => {
                  setAudioMode("tones-only");
                  setShowAudioModeSelector(false);
                  await saveAudioMode("tones-only");
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 ${
                  audioMode === "tones-only" ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400" : "text-gray-700 dark:text-gray-300"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span>Tones Only</span>
              </button>
              <button
                onClick={async () => {
                  setAudioMode("mute");
                  setShowAudioModeSelector(false);
                  await saveAudioMode("mute");
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 ${
                  audioMode === "mute" ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400" : "text-gray-700 dark:text-gray-300"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
                <span>Mute</span>
              </button>
            </div>
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
          {exerciseNumber !== null && (
            <p className="text-gray-600 dark:text-gray-400">
              Exercise {exerciseNumber} of {totalExerciseCount || exercises.length}
            </p>
          )}
        </div>

        {currentExercise && !isResting && (
          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-8 mb-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold">{currentExercise.name}</h2>
              {(currentExercise.voice_explanation || currentExercise.text_explanation) && (
                <Button
                  onClick={handleShowExplanation}
                  variant="outline"
                  size="sm"
                  className="ml-4"
                  disabled={isButtonDisabled("explanation")}
                >
                  How to do this
                </Button>
              )}
            </div>
            {(currentExercise.is_warmup || currentExercise.is_cooldown) ? (
              // Warm-up/Cooldown display
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-gray-600 dark:text-gray-400">Duration</p>
                  <p className="text-3xl font-bold">
                    {currentExercise.reps_min} {currentExercise.reps_min === 1 ? 'minute' : 'minutes'}
                  </p>
                </div>
                {currentExercise.notes ? (
                  <div className="mt-4">
                    <p className="text-gray-600 dark:text-gray-400 mb-2">Notes</p>
                    <p className="text-lg">{currentExercise.notes}</p>
                  </div>
                ) : (
                  <div className="mt-4">
                    <p className="text-gray-600 dark:text-gray-400 text-sm italic">
                      {currentExercise.is_warmup 
                        ? "Follow your warm-up routine" 
                        : "Follow your cool-down routine"}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              // Regular exercise display (use per-set target when available, e.g. from AI)
              (() => {
                const setT = getSetTarget(currentExercise, currentSet);
                return (
                  <>
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
                          {setT.reps_min === setT.reps_max ? setT.reps_min : `${setT.reps_min}-${setT.reps_max}`}
                        </p>
                      </div>
                    </div>
                    {setT.weight_lbs != null && setT.weight_lbs !== 0 && (
                      <div className="mt-4 text-center">
                        <p className="text-gray-600 dark:text-gray-400">Weight</p>
                        <p className="text-2xl font-bold">{setT.weight_lbs} lbs</p>
                      </div>
                    )}
                  </>
                );
              })()
            )}
            {lastCompletedSet && (
              <div className="mt-6 pt-6 border-t border-gray-300 dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {lastCompletedSet.is_warmup || lastCompletedSet.is_cooldown
                      ? `Last Completed: ${lastCompletedSet.exercise_name}`
                      : `Last Completed: ${lastCompletedSet.exercise_name} Set ${lastCompletedSet.set_number}`}
                  </p>
                  {lastCompletedSet.id && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditLastSetReps(lastCompletedSet.reps);
                        setEditLastSetWeight(lastCompletedSet.weight_lbs);
                        setShowEditLastSet(true);
                      }}
                      className="p-1.5 rounded-md text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                      title="Edit last set"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  )}
                </div>
                <div className="flex justify-center items-center gap-6">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      {lastCompletedSet.is_warmup || lastCompletedSet.is_cooldown ? "Duration" : "Reps"}
                    </p>
                    <p className="text-xl font-semibold">
                      {lastCompletedSet.is_warmup || lastCompletedSet.is_cooldown
                        ? `${lastCompletedSet.reps} ${lastCompletedSet.reps === 1 ? "minute" : "minutes"}`
                        : lastCompletedSet.reps}
                    </p>
                  </div>
                  {lastCompletedSet.weight_lbs !== null && !lastCompletedSet.is_warmup && !lastCompletedSet.is_cooldown && (
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-500">Weight</p>
                      <p className="text-xl font-semibold">{lastCompletedSet.weight_lbs} lbs</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            {showEditLastSet && lastCompletedSet && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-sm w-full p-6">
                  <h3 className="text-lg font-semibold mb-4">Edit Last Set</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{lastCompletedSet.exercise_name}</p>
                  <div className="space-y-4">
                    {lastCompletedSet.is_warmup || lastCompletedSet.is_cooldown ? (
                      <div>
                        <label className="block text-sm font-medium mb-1">Duration (minutes)</label>
                        <input
                          type="number"
                          min={1}
                          value={editLastSetReps}
                          onChange={(e) => setEditLastSetReps(parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 rounded-md border dark:bg-gray-700 dark:border-gray-600"
                        />
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-sm font-medium mb-1">Reps</label>
                          <input
                            type="number"
                            min={1}
                            value={editLastSetReps}
                            onChange={(e) => setEditLastSetReps(parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 rounded-md border dark:bg-gray-700 dark:border-gray-600"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Weight (lbs, optional)</label>
                          <input
                            type="number"
                            min={0}
                            step={0.5}
                            value={editLastSetWeight ?? ""}
                            onChange={(e) => setEditLastSetWeight(e.target.value === "" ? null : parseFloat(e.target.value))}
                            placeholder="Body weight"
                            className="w-full px-3 py-2 rounded-md border dark:bg-gray-700 dark:border-gray-600"
                          />
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex gap-2 mt-6">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowEditLastSet(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      className="flex-1"
                      onClick={async () => {
                        if (editLastSetReps <= 0) return;
                        const payload = lastCompletedSet.is_warmup || lastCompletedSet.is_cooldown
                          ? { reps: editLastSetReps }
                          : { reps: editLastSetReps, weight_lbs: editLastSetWeight };
                        const { error } = await supabase
                          .from("workout_sets")
                          .update(payload)
                          .eq("id", lastCompletedSet.id);
                        if (error) {
                          console.error("Error updating set:", error);
                        } else {
                          setLastCompletedSet({
                            ...lastCompletedSet,
                            reps: editLastSetReps,
                            weight_lbs: lastCompletedSet.is_warmup || lastCompletedSet.is_cooldown ? null : editLastSetWeight,
                          });
                          setShowEditLastSet(false);
                        }
                      }}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {restTime > 0 && (
          <div className="bg-blue-100 dark:bg-blue-900 rounded-lg p-6 mb-6 text-center">
            <p className="text-lg mb-2">Rest Time</p>
            <p className="text-4xl font-bold mb-4">{restTime}s</p>
            {(() => {
              // During rest period, currentExerciseIndex and currentSet already point to what's coming next
              const nextExercise = exercises[currentExerciseIndex];
              if (!nextExercise) return null;
              
              return (
                <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-700">
                  <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                    {(nextExercise.is_warmup || nextExercise.is_cooldown) 
                      ? "Next" 
                      : `Next: Set ${currentSet} of ${nextExercise.sets}`}
                  </p>
                  <p className="text-lg font-semibold text-blue-900 dark:text-blue-100">{nextExercise.name}</p>
                  {(nextExercise.is_warmup || nextExercise.is_cooldown) ? (
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      Duration: {nextExercise.reps_min} {nextExercise.reps_min === 1 ? 'minute' : 'minutes'}
                      {nextExercise.notes && ` - ${nextExercise.notes}`}
                    </p>
                  ) : (
                    (() => {
                      const t = getSetTarget(nextExercise, currentSet);
                      return (
                        <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                          Target: {t.reps_min === t.reps_max ? t.reps_min : `${t.reps_min}-${t.reps_max}`} reps
                          {t.weight_lbs != null && t.weight_lbs !== 0 && ` at ${t.weight_lbs} lbs`}
                        </p>
                      );
                    })()
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {showManualInput && (
          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6 mb-6">
            <h3 className="text-xl font-bold mb-4">Record Set Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {currentExercise?.is_warmup || currentExercise?.is_cooldown ? "Minutes *" : "Reps *"}
                </label>
                <input
                  type="number"
                  value={manualReps || ""}
                  onChange={(e) => setManualReps(parseInt(e.target.value) || null)}
                  className="w-full px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md border border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder={currentExercise?.is_warmup || currentExercise?.is_cooldown ? "Enter minutes" : "Enter reps"}
                  autoFocus
                />
              </div>
              {currentExercise && !currentExercise.is_warmup && !currentExercise.is_cooldown && getSetTarget(currentExercise, currentSet).weight_lbs != null && (
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
                disabled={isButtonDisabled("manualSave")}
              >
                Save Set
              </Button>
            </div>
          </div>
        )}

        {!showManualInput && (
          <div className="space-y-4">
            {!awaitingSetInput ? (
              <div className="flex justify-center space-x-4">
                {/* Pause/Resume Button */}
                <div className="relative">
                  <Button
                    onClick={async () => {
                      if (isButtonDisabled("pauseResume")) return;
                      disableButtonTemporarily("pauseResume");
                      const newPausedState = !isPaused;
                      setIsPaused(newPausedState);
                      if (newPausedState) {
                        if (audioMode !== "mute") {
              await announceWorkoutPaused(getAudioPreferences());
            }
                      } else {
                        if (audioMode !== "mute") {
              await announceWorkoutResumed(getAudioPreferences());
            }
                      }
                    }}
                    variant="secondary"
                    size="lg"
                    disabled={isButtonDisabled("pauseResume")}
                  >
                    {isPaused ? "Resume" : "Pause"}
                  </Button>
                  {headphoneMappings?.button_1 && actionButtonBehavior === "pause_resume" && (
                    <span className="absolute -top-2 -right-2 bg-indigo-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-white dark:border-gray-900">
                      1
                    </span>
                  )}
                </div>
                
                {/* Complete Set / Skip Rest Button - Skip Rest during rest period, else Complete Set */}
                <div className="relative">
                  <Button 
                    onClick={isResting ? handleRestEnd : completeSet} 
                    variant="primary" 
                    size="lg" 
                    disabled={awaitingSetInput || isButtonDisabled(isResting ? "skipRest" : "completeSet")}
                  >
                    {isResting 
                      ? "Skip Rest" 
                      : currentExercise?.is_warmup 
                      ? "Complete Warm-up" 
                      : currentExercise?.is_cooldown 
                      ? "Complete Cooldown" 
                      : "Complete Set"}
                  </Button>
                  {headphoneMappings?.button_1 && actionButtonBehavior === "complete_set" && (
                    <span className="absolute -top-2 -right-2 bg-indigo-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-white dark:border-gray-900">
                      1
                    </span>
                  )}
                </div>
                
                {/* Complete Exercise Button - Hidden for warm-up/cooldown */}
                {currentExercise && !currentExercise.is_warmup && !currentExercise.is_cooldown && (
                  <div className="relative">
                    <Button
                      onClick={async () => {
                        if (isButtonDisabled("completeExerciseBtn")) return;
                        disableButtonTemporarily("completeExerciseBtn");
                        const exercise = exercises[currentExerciseIndex];
                        setShowCompleteExerciseDialog(true);
                        if (audioMode !== "mute") {
              await askExerciseCompletionOption(exercise.name, getAudioPreferences(), {
                isWarmupOrCooldown: exercise.is_warmup || exercise.is_cooldown,
              });
            }
                      }}
                      variant="purple"
                      size="lg"
                      disabled={isButtonDisabled("completeExerciseBtn")}
                    >
                      Complete Exercise
                    </Button>
                    {headphoneMappings?.button_1 && actionButtonBehavior === "complete_exercise" && (
                      <span className="absolute -top-2 -right-2 bg-indigo-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-white dark:border-gray-900">
                        1
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : (
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
                  Say something like: &quot;10 reps&quot; or &quot;12 reps with 25 pounds&quot;
                </p>
                <Button
                  onClick={() => {
                    if (isButtonDisabled("skipToManual")) return;
                    disableButtonTemporarily("skipToManual");
                    if (voiceInputTimeoutRef.current) {
                      clearTimeout(voiceInputTimeoutRef.current);
                      voiceInputTimeoutRef.current = null;
                    }
                    stopListening();
                    handleVoiceInputTimeout({ skipAnnouncement: true });
                  }}
                  variant="outline"
                  size="lg"
                  disabled={isButtonDisabled("skipToManual")}
                >
                  Skip to Manual Input
                </Button>
              </div>
            )}
            <div className="flex justify-center">
              <div className="relative">
                <Button
                  onClick={handleCompleteWorkoutClick}
                  variant="danger"
                  size="lg"
                  disabled={isButtonDisabled("completeWorkout")}
                >
                  Complete Workout
                </Button>
                {headphoneMappings?.button_1 && actionButtonBehavior === "complete_workout" && (
                  <span className="absolute -top-2 -right-2 bg-indigo-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-white dark:border-gray-900">
                    1
                  </span>
                )}
              </div>
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
                  disabled={isButtonDisabled("confirmComplete")}
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
                {exercises[currentExerciseIndex]?.is_warmup || exercises[currentExerciseIndex]?.is_cooldown
                  ? "Skip this and mark as complete?"
                  : "Do you want to skip this exercise completely, or finish it later?"}
              </p>
              <div className="flex flex-col space-y-3">
                <Button
                  onClick={() => handleCompleteExercise(true)}
                  variant="danger"
                  className="w-full"
                  disabled={isButtonDisabled("completeExercise")}
                >
                  {exercises[currentExerciseIndex]?.is_warmup || exercises[currentExerciseIndex]?.is_cooldown
                    ? "Skip"
                    : "Skip Exercise"}
                </Button>
                {!exercises[currentExerciseIndex]?.is_warmup && !exercises[currentExerciseIndex]?.is_cooldown && (
                  <Button
                    onClick={() => handleCompleteExercise(false)}
                    variant="purple"
                    className="w-full"
                    disabled={isButtonDisabled("completeExercise")}
                  >
                    Finish Later (Move to End)
                  </Button>
                )}
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

        {showExplanationDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold">How to do {currentExercise?.name}</h3>
                <button
                  onClick={() => setShowExplanationDialog(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  aria-label="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="text-gray-700 dark:text-gray-300 whitespace-pre-line mb-6">
                {explanationText}
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={() => setShowExplanationDialog(false)}
                  variant="primary"
                >
                  Got it
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
