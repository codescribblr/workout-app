/**
 * Personality-specific wording for workout announcements when in coach mode.
 * OpenAI TTS does not support tone/intensity parameters; we achieve intensity via wording.
 * Optional: use slightly higher speech_rate for "military" in preferences if desired.
 */

import type { CoachPersonality } from "./speechManager";

type Template = Record<CoachPersonality, string>;

function fill(t: string, data: Record<string, string | number>): string {
  let out = t;
  for (const [k, v] of Object.entries(data)) {
    out = out.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
  }
  return out;
}

const restPeriodTemplates: Template = {
  gentle: "Take a break for {seconds} seconds. When you're ready, {nextUp}.",
  encouraging: "Rest for {seconds} seconds. Next up, {nextUp}. You've got this!",
  hardcore: "{seconds} seconds rest. Then {nextUp}. Let's go.",
  military: "{seconds} seconds. Then {nextUp}. Move.",
};

const nextSetTemplates: Template = {
  gentle: "{intro}Set {currentSet} of {totalSets}. Do {reps}{weight}. Whenever you're ready.",
  encouraging: "{intro}Set {currentSet} of {totalSets}. Do {reps}{weight}. You've got this!",
  hardcore: "{intro}Set {currentSet} of {totalSets}. Do {reps}{weight}. Let's go.",
  military: "{intro}Set {currentSet} of {totalSets}. {reps}{weight}. Go.",
};

const nextExerciseTemplates: Template = {
  gentle: "Moving to {exerciseName} when you're ready.",
  encouraging: "Next up, {exerciseName}. You're doing great!",
  hardcore: "Next exercise: {exerciseName}. Let's go.",
  military: "Next: {exerciseName}. Move.",
};

const askForSetInputTemplates: Template = {
  gentle: "Whenever you're ready, let me know how many reps you did{weightPhrase}.",
  encouraging: "How many reps did you do{weightPhrase}? You've got this!",
  hardcore: "Reps{weightPhrase}? Let's go.",
  military: "Report. Reps{weightPhrase}.",
};

const askForMinutesInputTemplates: Template = {
  gentle: "Whenever you're ready, let me know how many minutes you did.",
  encouraging: "How many minutes did you do? You've got this!",
  hardcore: "Minutes? Report.",
  military: "Report duration. Minutes.",
};

const confirmSetTemplates: Template = {
  gentle: "Got it. {reps} reps{weightPhrase}. Nice.",
  encouraging: "Nice! {reps} reps{weightPhrase}. Keep it up!",
  hardcore: "Logged. {reps} reps{weightPhrase}. ... Next.",
  military: "Noted. {reps} reps{weightPhrase}.",
};

const manualInputNeededTemplates: Template = {
  gentle: "When you can, record your set and we'll move to the rest period.",
  encouraging: "Record your set when you're ready, then we'll rest. You're doing great!",
  hardcore: "Record your set. Then we rest.",
  military: "Record set. Then rest.",
};

const pausedTemplates: Template = {
  gentle: "Workout paused. Take your time.",
  encouraging: "Workout paused. Rest up!",
  hardcore: "Paused. Don't cool down too long.",
  military: "Paused.",
};

const resumedTemplates: Template = {
  gentle: "Resumed whenever you're ready.",
  encouraging: "Back at it! Let's go!",
  hardcore: "Resumed. Let's go.",
  military: "Resumed. Move.",
};

const workoutCompleteTemplates: Template = {
  gentle: "Workout complete. Great job. Rest well.",
  encouraging: "Workout complete! Great job! You did it!",
  hardcore: "Workout complete. Strong work. Rest and recover.",
  military: "Workout complete. Dismissed.",
};

const warmupConfirmTemplates: Template = {
  gentle: "Got it. Warm-up done in {duration} {minWord}. Nice.",
  encouraging: "Warm-up done in {duration} {minWord}. You're ready!",
  hardcore: "Warm-up logged. {duration} {minWord}. Let's go.",
  military: "Noted. {duration} {minWord} warm-up.",
};

const timeBasedConfirmTemplates: Template = {
  gentle: "Got it. {duration} {minWord}. Nice.",
  encouraging: "Nice! {duration} {minWord}. Keep it up!",
  hardcore: "Logged. {duration} {minWord}. ... Next.",
  military: "Noted. {duration} {minWord}.",
};

const exerciseSkippedTemplates: Template = {
  gentle: "{exerciseName} skipped. That's okay.",
  encouraging: "{exerciseName} skipped. We'll get it next time!",
  hardcore: "{exerciseName} skipped. Next.",
  military: "{exerciseName} skipped.",
};

const exerciseMovedToEndTemplates: Template = {
  gentle: "{exerciseName} moved to the end. We'll come back to it later.",
  encouraging: "{exerciseName} moved to the end. We'll hit it later!",
  hardcore: "{exerciseName} to the end. We'll get it.",
  military: "{exerciseName} to end. Later.",
};

const askWarmupTemplates: Template = {
  gentle: "How did the warm-up go when you're ready?",
  encouraging: "How did the warm-up go? Ready for more?",
  hardcore: "Warm-up done? Report.",
  military: "Warm-up status.",
};

const askExerciseCompletionTemplates: Template = {
  gentle: "Do you want to skip {exerciseName} or finish it later?",
  encouraging: "Skip {exerciseName} or save it for later? Your call!",
  hardcore: "Skip {exerciseName} or do it later?",
  military: "Skip {exerciseName} or defer. Choose.",
};

const askWarmupCooldownSkipTemplates: Template = {
  gentle: "Do you want to skip {exerciseName}?",
  encouraging: "Skip {exerciseName} and mark as complete?",
  hardcore: "Skip {exerciseName}?",
  military: "Skip {exerciseName}?",
};

export function getRestPeriodText(
  seconds: number,
  nextUp: string,
  personality: CoachPersonality
): string {
  return fill(restPeriodTemplates[personality], { seconds, nextUp });
}

export function getNextSetText(
  intro: string,
  currentSet: number,
  totalSets: number,
  reps: string,
  weight: string,
  personality: CoachPersonality
): string {
  return fill(nextSetTemplates[personality], {
    intro,
    currentSet,
    totalSets,
    reps,
    weight,
  });
}

export function getNextExerciseText(
  exerciseName: string,
  personality: CoachPersonality
): string {
  return fill(nextExerciseTemplates[personality], { exerciseName });
}

export function getAskForSetInputText(
  hasWeight: boolean,
  personality: CoachPersonality,
  isTimeBased?: boolean
): string {
  if (isTimeBased) {
    return askForMinutesInputTemplates[personality];
  }
  const weightPhrase = hasWeight ? " and weight" : "";
  return fill(askForSetInputTemplates[personality], { weightPhrase });
}

export function getTimeBasedConfirmText(
  duration: number,
  personality: CoachPersonality
): string {
  const minWord = duration === 1 ? "minute" : "minutes";
  return fill(timeBasedConfirmTemplates[personality], {
    duration: String(duration),
    minWord,
  });
}

export function getConfirmSetText(
  reps: number,
  weightPhrase: string,
  personality: CoachPersonality
): string {
  return fill(confirmSetTemplates[personality], { reps: String(reps), weightPhrase });
}

export function getManualInputNeededText(personality: CoachPersonality): string {
  return manualInputNeededTemplates[personality];
}

export function getPausedText(personality: CoachPersonality): string {
  return pausedTemplates[personality];
}

export function getResumedText(personality: CoachPersonality): string {
  return resumedTemplates[personality];
}

export function getWorkoutCompleteText(personality: CoachPersonality): string {
  return workoutCompleteTemplates[personality];
}

export function getWarmupConfirmText(
  duration: number,
  personality: CoachPersonality
): string {
  const minWord = duration === 1 ? "minute" : "minutes";
  return fill(warmupConfirmTemplates[personality], {
    duration: String(duration),
    minWord,
  });
}

export function getExerciseSkippedText(
  exerciseName: string,
  personality: CoachPersonality
): string {
  return fill(exerciseSkippedTemplates[personality], { exerciseName });
}

export function getExerciseMovedToEndText(
  exerciseName: string,
  personality: CoachPersonality
): string {
  return fill(exerciseMovedToEndTemplates[personality], { exerciseName });
}

export function getAskWarmupText(personality: CoachPersonality): string {
  return askWarmupTemplates[personality];
}

export function getAskExerciseCompletionText(
  exerciseName: string,
  personality: CoachPersonality,
  isWarmupOrCooldown?: boolean
): string {
  const templates = isWarmupOrCooldown
    ? askWarmupCooldownSkipTemplates
    : askExerciseCompletionTemplates;
  return fill(templates[personality], { exerciseName });
}
