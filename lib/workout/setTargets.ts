/** Per-set target override (e.g. from AI). Exact reps or range; weight optional. */
export interface SetTarget {
  reps?: number;
  reps_min?: number;
  reps_max?: number;
  weight_lbs?: number | null;
}

/** Normalized target for display/announcements: always has reps_min, reps_max, weight_lbs. */
export interface ResolvedSetTarget {
  reps_min: number;
  reps_max: number;
  weight_lbs: number | null;
}

/** Minimal exercise shape needed to resolve a set target. */
export interface ExerciseSetTargetInput {
  reps_min: number;
  reps_max: number;
  weight_lbs: number | null;
  set_targets?: Record<number, SetTarget>;
}

/**
 * Resolve target for a specific set: use per-set override if present, else plan default.
 */
export function getSetTarget(
  exercise: ExerciseSetTargetInput,
  setNumber: number
): ResolvedSetTarget {
  const st = exercise.set_targets?.[setNumber];
  if (st) {
    const repsMin = st.reps ?? st.reps_min ?? exercise.reps_min;
    const repsMax = st.reps ?? st.reps_max ?? exercise.reps_max;
    const weight =
      st.weight_lbs !== undefined ? st.weight_lbs : exercise.weight_lbs;
    return {
      reps_min: repsMin,
      reps_max: repsMax,
      weight_lbs: weight ?? null,
    };
  }
  return {
    reps_min: exercise.reps_min,
    reps_max: exercise.reps_max,
    weight_lbs: exercise.weight_lbs ?? null,
  };
}
