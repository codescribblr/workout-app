// Centralized Speech Manager
// All workout announcements are defined here and managed through this single interface

import { speakText, stopSpeech } from "./tts";

// Global state tracking current speech
let isSpeaking = false;
let currentSpeechType: SpeechType | null = null;

// Queue for coach (and other) messages so only one speech plays at a time
interface QueuedSpeechItem {
  text: string;
  preferences?: SpeechPreferences;
  resolve: () => void;
}
const speechQueue: QueuedSpeechItem[] = [];

// Speech types for tracking
export const SpeechType = {
  CURRENT_EXERCISE: "current_exercise",
  REST_PERIOD: "rest_period",
  NEXT_SET: "next_set",
  NEXT_EXERCISE: "next_exercise",
  ASK_FOR_INPUT: "ask_for_input",
  CONFIRM_SET: "confirm_set",
  MANUAL_INPUT_NEEDED: "manual_input_needed",
  WORKOUT_PAUSED: "workout_paused",
  WORKOUT_RESUMED: "workout_resumed",
  WORKOUT_COMPLETE: "workout_complete",
  COACH_MESSAGE: "coach_message",
  ANNOUNCEMENT: "announcement", // Generic one-off (e.g. headphone setup); always use this path so one voice plays
} as const;

type SpeechType = typeof SpeechType[keyof typeof SpeechType];

export type AudioMode = "coach" | "standard" | "tones-only" | "mute";

/** Coach personality: tone of coach messages and announcements (coach workouts only). */
export type CoachPersonality = "gentle" | "encouraging" | "hardcore" | "military";

export const COACH_PERSONALITIES: { id: CoachPersonality; label: string }[] = [
  { id: "gentle", label: "Gentle" },
  { id: "encouraging", label: "Encouraging" },
  { id: "hardcore", label: "Hard-core" },
  { id: "military", label: "Military" },
];

interface SpeechPreferences {
  tts_provider?: string;
  voice_id?: string;
  speech_rate?: number;
  volume?: number;
  audio_cues_enabled?: boolean; // If false, no audio will be played
  audio_mode?: AudioMode; // Controls what audio cues are played
  coach_personality?: CoachPersonality; // When audio_mode is "coach"
}

const DEFAULT_TTS_PREFS: SpeechPreferences = {
  tts_provider: "browser",
  voice_id: "alloy",
  speech_rate: 1.0,
  volume: 0.8,
};

/**
 * Stop any currently playing speech
 */
function stopCurrentSpeech() {
  if (isSpeaking) {
    stopSpeech();
    isSpeaking = false;
    currentSpeechType = null;
  }
}

/**
 * Internal function to speak text with proper state management
 */
async function speak(
  text: string,
  speechType: SpeechType,
  preferences?: SpeechPreferences
): Promise<void> {
  // Check if audio cues are disabled
  if (preferences?.audio_cues_enabled === false) {
    // Audio cues are disabled - don't play any audio
    return;
  }

  // Check audio mode
  const audioMode = preferences?.audio_mode || "standard";
  if (audioMode === "mute") {
    // Mute mode - no audio at all
    return;
  }
  if (audioMode === "tones-only") {
    // Tones-only mode - skip speech, only dings/beeps are played elsewhere
    return;
  }

  // Always stop current speech before starting new speech
  stopCurrentSpeech();

  isSpeaking = true;
  currentSpeechType = speechType;

  try {
    await speakText(text, preferences ?? DEFAULT_TTS_PREFS);
  } catch (error) {
    console.error(`Error speaking ${speechType}:`, error);
  } finally {
    isSpeaking = false;
    currentSpeechType = null;
    processSpeechQueue();
  }
}

/**
 * Process next item in the speech queue (used for coach messages so they never overlap).
 */
async function processSpeechQueue(): Promise<void> {
  if (isSpeaking || speechQueue.length === 0) return;
  const item = speechQueue.shift()!;
  if (item.preferences?.audio_cues_enabled === false) {
    item.resolve();
    processSpeechQueue();
    return;
  }
  const audioMode = item.preferences?.audio_mode || "standard";
  if (audioMode === "mute" || audioMode === "tones-only") {
    item.resolve();
    processSpeechQueue();
    return;
  }
  isSpeaking = true;
  currentSpeechType = SpeechType.COACH_MESSAGE;
  try {
    await speakText(item.text, item.preferences ?? DEFAULT_TTS_PREFS);
  } catch (error) {
    console.error("Error speaking queued coach message:", error);
  } finally {
    isSpeaking = false;
    currentSpeechType = null;
    item.resolve();
    processSpeechQueue();
  }
}

/**
 * Queue coach (or any) message to be spoken after current speech finishes.
 * Returns a Promise that resolves when this message has been spoken.
 * Use this so coach interjections never play over workout announcements.
 */
export function speakQueued(
  text: string,
  preferences?: SpeechPreferences
): Promise<void> {
  return new Promise((resolve) => {
    speechQueue.push({ text, preferences, resolve });
    processSpeechQueue();
  });
}

/**
 * Check if speech is currently playing
 */
export function isCurrentlySpeaking(): boolean {
  return isSpeaking;
}

/**
 * Get the type of speech currently playing
 */
export function getCurrentSpeechType(): SpeechType | null {
  return currentSpeechType;
}

// ============================================================================
// ANNOUNCEMENT FUNCTIONS
// ============================================================================

interface ExerciseInfo {
  exerciseNumber: number;
  exerciseName: string;
  currentSet: number;
  totalSets: number;
  repsMin: number;
  repsMax: number;
  weightLbs?: number | null;
  is_warmup?: boolean;
  is_cooldown?: boolean;
  notes?: string | null;
}

/**
 * Announce the current exercise
 */
export async function announceCurrentExercise(
  exercise: ExerciseInfo,
  preferences?: SpeechPreferences
): Promise<void> {
  let text: string;

  // Handle warm-up/cooldown exercises differently
  if (exercise.is_warmup || exercise.is_cooldown) {
    const duration = exercise.repsMin; // For warm-up/cooldown, repsMin stores duration in minutes
    const notesText = exercise.notes ? ` ${exercise.notes}` : "";
    text = `Exercise ${exercise.exerciseNumber}: ${exercise.exerciseName}. Target:${notesText} for ${duration} ${duration === 1 ? 'minute' : 'minutes'}.`;
  } else {
    const repsText =
      exercise.repsMax === 999
        ? `${exercise.repsMin} reps or max`
        : exercise.repsMin === exercise.repsMax
        ? `${exercise.repsMin} reps`
        : `${exercise.repsMin} to ${exercise.repsMax} reps`;
    const weightText = exercise.weightLbs ? ` at ${exercise.weightLbs} pounds` : "";
    text = `Exercise ${exercise.exerciseNumber}: ${exercise.exerciseName}. Set ${exercise.currentSet} of ${exercise.totalSets}. Target: ${repsText}${weightText}.`;
  }
  // Coach personality doesn't change exercise intro much; same info, optional tone later if we add templates
  await speak(text, SpeechType.CURRENT_EXERCISE, preferences);
}

/**
 * Announce rest period
 */
export async function announceRestPeriod(
  seconds: number,
  preferences?: SpeechPreferences,
  nextInfo?: {
    exerciseName: string;
    setNumber: number;
    isNewExercise?: boolean;
  }
): Promise<void> {
  const personality = preferences?.audio_mode === "coach" ? preferences?.coach_personality : undefined;
  let text: string;
  const nextUp = nextInfo
    ? nextInfo.isNewExercise
      ? `set 1 of ${nextInfo.exerciseName}`
      : `set ${nextInfo.setNumber} of ${nextInfo.exerciseName}`
    : "";
  if (personality && nextUp) {
    const { getRestPeriodText } = await import("./coachAnnouncements");
    text = getRestPeriodText(seconds, nextUp, personality);
  } else if (nextUp) {
    text = `Rest for ${seconds} seconds. Next up, ${nextUp}.`;
  } else {
    text = `Rest for ${seconds} seconds.`;
  }
  await speak(text, SpeechType.REST_PERIOD, preferences);
}

/**
 * Announce next set (after rest period)
 */
export async function announceNextSet(
  exercise: {
    currentSet: number;
    totalSets: number;
    repsMin: number;
    repsMax: number;
    weightLbs?: number | null;
    exerciseName?: string;
    is_warmup?: boolean;
    is_cooldown?: boolean;
    notes?: string | null;
  },
  preferences?: SpeechPreferences
): Promise<void> {
  const personality = preferences?.audio_mode === "coach" ? preferences?.coach_personality : undefined;
  let text: string;

  if (exercise.is_warmup || exercise.is_cooldown) {
    const duration = exercise.repsMin;
    const notesText = exercise.notes ? ` ${exercise.notes}` : "";
    text = `${exercise.exerciseName || (exercise.is_warmup ? "Warm-up" : "Cooldown")}. Target:${notesText} for ${duration} ${duration === 1 ? 'minute' : 'minutes'}. Ready?`;
  } else {
    const repsText =
      exercise.repsMax === 999
        ? `${exercise.repsMin} reps or max`
        : exercise.repsMin === exercise.repsMax
        ? `${exercise.repsMin} reps`
        : `${exercise.repsMin} to ${exercise.repsMax} reps`;
    const weightText = exercise.weightLbs ? ` with ${exercise.weightLbs} pounds` : "";
    const intro = exercise.currentSet === 1 && exercise.exerciseName ? `${exercise.exerciseName}. ` : "";
    if (personality) {
      const { getNextSetText } = await import("./coachAnnouncements");
      text = getNextSetText(
        intro,
        exercise.currentSet,
        exercise.totalSets,
        repsText,
        weightText,
        personality
      );
    } else if (intro) {
      text = `${intro} Set ${exercise.currentSet} of ${exercise.totalSets}. Do ${repsText}${weightText}. Ready?`;
    } else {
      text = `Set ${exercise.currentSet} of ${exercise.totalSets}. Do ${repsText}${weightText}. Ready?`;
    }
  }
  await speak(text, SpeechType.NEXT_SET, preferences);
}

/**
 * Announce moving to next exercise
 */
export async function announceNextExercise(
  exerciseName: string,
  preferences?: SpeechPreferences
): Promise<void> {
  const personality = preferences?.audio_mode === "coach" ? preferences?.coach_personality : undefined;
  const text = personality
    ? (await import("./coachAnnouncements")).getNextExerciseText(exerciseName, personality)
    : `Moving to ${exerciseName}.`;
  await speak(text, SpeechType.NEXT_EXERCISE, preferences);
}

/**
 * Ask for set input (reps and optionally weight, or minutes for time-based exercises)
 */
export async function askForSetInput(
  hasWeight: boolean,
  preferences?: SpeechPreferences,
  options?: { isTimeBased?: boolean }
): Promise<void> {
  const personality = preferences?.audio_mode === "coach" ? preferences?.coach_personality : undefined;
  const isTimeBased = options?.isTimeBased ?? false;
  const text = personality
    ? (await import("./coachAnnouncements")).getAskForSetInputText(hasWeight, personality, isTimeBased)
    : isTimeBased
    ? "How many minutes did you do?"
    : hasWeight
    ? "How many reps did you do and what weight did you use?"
    : "How many reps did you do?";
  await speak(text, SpeechType.ASK_FOR_INPUT, preferences);
}

/**
 * Ask for warm-up completion feedback
 */
export async function askForWarmupInput(
  preferences?: SpeechPreferences
): Promise<void> {
  const personality = preferences?.audio_mode === "coach" ? preferences?.coach_personality : undefined;
  const text = personality
    ? (await import("./coachAnnouncements")).getAskWarmupText(personality)
    : "How did the warm-up go?";
  await speak(text, SpeechType.ASK_FOR_INPUT, preferences);
}

/**
 * Confirm what was recorded
 */
export async function confirmSetRecorded(
  reps: number,
  weightLbs?: number | null,
  preferences?: SpeechPreferences,
  options?: { isTimeBased?: boolean }
): Promise<void> {
  const personality = preferences?.audio_mode === "coach" ? preferences?.coach_personality : undefined;
  const isTimeBased = options?.isTimeBased ?? false;
  if (isTimeBased) {
    const text = personality
      ? (await import("./coachAnnouncements")).getTimeBasedConfirmText(reps, personality)
      : `Great. ${reps} ${reps === 1 ? "minute" : "minutes"}.`;
    await speak(text, SpeechType.CONFIRM_SET, preferences);
    return;
  }
  const weightPhrase = weightLbs ? ` with ${weightLbs} pounds` : "";
  const text = personality
    ? (await import("./coachAnnouncements")).getConfirmSetText(reps, weightPhrase, personality)
    : weightLbs
    ? `Great. ${reps} reps with ${weightLbs} pounds.`
    : `Great. ${reps} reps.`;
  await speak(text, SpeechType.CONFIRM_SET, preferences);
}

/**
 * Confirm warm-up completion was recorded
 */
export async function confirmWarmupRecorded(
  duration: number,
  preferences?: SpeechPreferences
): Promise<void> {
  const personality = preferences?.audio_mode === "coach" ? preferences?.coach_personality : undefined;
  const text = personality
    ? (await import("./coachAnnouncements")).getWarmupConfirmText(duration, personality)
    : `Great. Warm-up completed in ${duration} ${duration === 1 ? 'minute' : 'minutes'}.`;
  await speak(text, SpeechType.CONFIRM_SET, preferences);
}

/**
 * Announce that manual input is needed
 */
export async function announceManualInputNeeded(
  preferences?: SpeechPreferences
): Promise<void> {
  const personality = preferences?.audio_mode === "coach" ? preferences?.coach_personality : undefined;
  const text = personality
    ? (await import("./coachAnnouncements")).getManualInputNeededText(personality)
    : "Please record your set information and then we'll move to the rest period.";
  await speak(text, SpeechType.MANUAL_INPUT_NEEDED, preferences);
}

/**
 * Announce workout paused
 */
export async function announceWorkoutPaused(
  preferences?: SpeechPreferences
): Promise<void> {
  const personality = preferences?.audio_mode === "coach" ? preferences?.coach_personality : undefined;
  const text = personality
    ? (await import("./coachAnnouncements")).getPausedText(personality)
    : "Workout paused";
  await speak(text, SpeechType.WORKOUT_PAUSED, preferences);
}

/**
 * Announce workout resumed
 */
export async function announceWorkoutResumed(
  preferences?: SpeechPreferences
): Promise<void> {
  const personality = preferences?.audio_mode === "coach" ? preferences?.coach_personality : undefined;
  const text = personality
    ? (await import("./coachAnnouncements")).getResumedText(personality)
    : "Workout resumed";
  await speak(text, SpeechType.WORKOUT_RESUMED, preferences);
}

/**
 * Announce workout complete
 */
export async function announceWorkoutComplete(
  preferences?: SpeechPreferences
): Promise<void> {
  const personality = preferences?.audio_mode === "coach" ? preferences?.coach_personality : undefined;
  const text = personality
    ? (await import("./coachAnnouncements")).getWorkoutCompleteText(personality)
    : "Workout complete! Great job!";
  await speak(text, SpeechType.WORKOUT_COMPLETE, preferences);
}

/**
 * Ask if user wants to skip exercise or finish later.
 * For warmup/cooldown, only offers skip (no move to end).
 */
export async function askExerciseCompletionOption(
  exerciseName: string,
  preferences?: SpeechPreferences,
  options?: { isWarmupOrCooldown?: boolean }
): Promise<void> {
  const personality = preferences?.audio_mode === "coach" ? preferences?.coach_personality : undefined;
  const isWarmupOrCooldown = options?.isWarmupOrCooldown ?? false;
  const text = personality
    ? (await import("./coachAnnouncements")).getAskExerciseCompletionText(exerciseName, personality, isWarmupOrCooldown)
    : isWarmupOrCooldown
      ? `Do you want to skip ${exerciseName}?`
      : `Do you want to skip ${exerciseName} completely, or finish it later?`;
  await speak(text, SpeechType.ASK_FOR_INPUT, preferences);
}

/**
 * Announce exercise skipped
 */
export async function announceExerciseSkipped(
  exerciseName: string,
  preferences?: SpeechPreferences
): Promise<void> {
  const personality = preferences?.audio_mode === "coach" ? preferences?.coach_personality : undefined;
  const text = personality
    ? (await import("./coachAnnouncements")).getExerciseSkippedText(exerciseName, personality)
    : `${exerciseName} skipped.`;
  await speak(text, SpeechType.NEXT_EXERCISE, preferences);
}

/**
 * Announce exercise moved to end
 */
export async function announceExerciseMovedToEnd(
  exerciseName: string,
  preferences?: SpeechPreferences
): Promise<void> {
  const personality = preferences?.audio_mode === "coach" ? preferences?.coach_personality : undefined;
  const text = personality
    ? (await import("./coachAnnouncements")).getExerciseMovedToEndText(exerciseName, personality)
    : `${exerciseName} moved to the end. We'll come back to it later.`;
  await speak(text, SpeechType.NEXT_EXERCISE, preferences);
}

/**
 * Announce exercise explanation (voice-optimized)
 */
export async function announceExerciseExplanation(
  explanation: string,
  preferences?: SpeechPreferences
): Promise<void> {
  await speak(explanation, SpeechType.CURRENT_EXERCISE, preferences);
}

/**
 * Stop any current speech (exported for manual control)
 */
export function stopCurrentAnnouncement(): void {
  stopCurrentSpeech();
}

/**
 * Speak arbitrary text through the speech manager so the correct TTS provider/voice
 * is used and only one speech plays at a time. Use this for any one-off messages
 * (e.g. headphone setup) instead of calling tts.speakText directly.
 */
export async function speakAnnouncement(
  text: string,
  preferences?: SpeechPreferences
): Promise<void> {
  await speak(text, SpeechType.ANNOUNCEMENT, preferences);
}
