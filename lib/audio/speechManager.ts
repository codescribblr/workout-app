// Centralized Speech Manager
// All workout announcements are defined here and managed through this single interface

import { speakText, stopSpeech } from "./tts";

// Global state tracking current speech
let isSpeaking = false;
let currentSpeechType: string | null = null;

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
} as const;

type SpeechType = typeof SpeechType[keyof typeof SpeechType];

interface SpeechPreferences {
  tts_provider?: string;
  voice_id?: string;
  speech_rate?: number;
  volume?: number;
  audio_cues_enabled?: boolean; // If false, no audio will be played
}

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

  // Always stop current speech before starting new speech
  stopCurrentSpeech();

  isSpeaking = true;
  currentSpeechType = speechType;

  try {
    await speakText(text, preferences);
  } catch (error) {
    console.error(`Error speaking ${speechType}:`, error);
  } finally {
    isSpeaking = false;
    currentSpeechType = null;
  }
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
}

/**
 * Announce the current exercise
 */
export async function announceCurrentExercise(
  exercise: ExerciseInfo,
  preferences?: SpeechPreferences
): Promise<void> {
  const repsText =
    exercise.repsMax === 999
      ? `${exercise.repsMin} reps or max`
      : exercise.repsMin === exercise.repsMax
      ? `${exercise.repsMin} reps`
      : `${exercise.repsMin} to ${exercise.repsMax} reps`;

  const weightText = exercise.weightLbs
    ? ` at ${exercise.weightLbs} pounds`
    : "";

  const text = `Exercise ${exercise.exerciseNumber}: ${exercise.exerciseName}. Set ${exercise.currentSet} of ${exercise.totalSets}. Target: ${repsText}${weightText}.`;

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
  let text = `Rest for ${seconds} seconds.`;
  
  if (nextInfo) {
    if (nextInfo.isNewExercise) {
      text += ` Next up, set 1 of ${nextInfo.exerciseName}.`;
    } else {
      text += ` Next up, set ${nextInfo.setNumber} of ${nextInfo.exerciseName}.`;
    }
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
  },
  preferences?: SpeechPreferences
): Promise<void> {
  const repsText =
    exercise.repsMax === 999
      ? `${exercise.repsMin} reps or max`
      : exercise.repsMin === exercise.repsMax
      ? `${exercise.repsMin} reps`
      : `${exercise.repsMin} to ${exercise.repsMax} reps`;

  const weightText = exercise.weightLbs ? ` with ${exercise.weightLbs} pounds` : "";

  // If it's set 1 and we have an exercise name, announce the exercise name first
  let text: string;
  if (exercise.currentSet === 1 && exercise.exerciseName) {
    text = `${exercise.exerciseName}. Set ${exercise.currentSet} of ${exercise.totalSets}. Do ${repsText}${weightText}. Ready?`;
  } else {
    text = `Set ${exercise.currentSet} of ${exercise.totalSets}. Do ${repsText}${weightText}. Ready?`;
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
  const text = `Moving to ${exerciseName}.`;
  await speak(text, SpeechType.NEXT_EXERCISE, preferences);
}

/**
 * Ask for set input (reps and optionally weight)
 */
export async function askForSetInput(
  hasWeight: boolean,
  preferences?: SpeechPreferences
): Promise<void> {
  const text = hasWeight
    ? "How many reps did you do and what weight did you use?"
    : "How many reps did you do?";
  await speak(text, SpeechType.ASK_FOR_INPUT, preferences);
}

/**
 * Confirm what was recorded
 */
export async function confirmSetRecorded(
  reps: number,
  weightLbs?: number | null,
  preferences?: SpeechPreferences
): Promise<void> {
  const text = weightLbs
    ? `Great. ${reps} reps with ${weightLbs} pounds.`
    : `Great. ${reps} reps.`;
  await speak(text, SpeechType.CONFIRM_SET, preferences);
}

/**
 * Announce that manual input is needed
 */
export async function announceManualInputNeeded(
  preferences?: SpeechPreferences
): Promise<void> {
  const text =
    "Please record your set information and then we'll move to the rest period.";
  await speak(text, SpeechType.MANUAL_INPUT_NEEDED, preferences);
}

/**
 * Announce workout paused
 */
export async function announceWorkoutPaused(
  preferences?: SpeechPreferences
): Promise<void> {
  await speak("Workout paused", SpeechType.WORKOUT_PAUSED, preferences);
}

/**
 * Announce workout resumed
 */
export async function announceWorkoutResumed(
  preferences?: SpeechPreferences
): Promise<void> {
  await speak("Workout resumed", SpeechType.WORKOUT_RESUMED, preferences);
}

/**
 * Announce workout complete
 */
export async function announceWorkoutComplete(
  preferences?: SpeechPreferences
): Promise<void> {
  await speak("Workout complete! Great job!", SpeechType.WORKOUT_COMPLETE, preferences);
}

/**
 * Ask if user wants to skip exercise or finish later
 */
export async function askExerciseCompletionOption(
  exerciseName: string,
  preferences?: SpeechPreferences
): Promise<void> {
  const text = `Do you want to skip ${exerciseName} completely, or finish it later?`;
  await speak(text, SpeechType.ASK_FOR_INPUT, preferences);
}

/**
 * Announce exercise skipped
 */
export async function announceExerciseSkipped(
  exerciseName: string,
  preferences?: SpeechPreferences
): Promise<void> {
  const text = `${exerciseName} skipped.`;
  await speak(text, SpeechType.NEXT_EXERCISE, preferences);
}

/**
 * Announce exercise moved to end
 */
export async function announceExerciseMovedToEnd(
  exerciseName: string,
  preferences?: SpeechPreferences
): Promise<void> {
  const text = `${exerciseName} moved to the end. We'll come back to it later.`;
  await speak(text, SpeechType.NEXT_EXERCISE, preferences);
}

/**
 * Stop any current speech (exported for manual control)
 */
export function stopCurrentAnnouncement(): void {
  stopCurrentSpeech();
}
