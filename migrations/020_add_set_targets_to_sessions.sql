-- Migration: 020_add_set_targets_to_sessions
-- Description: Add per-set target recommendations to workout sessions for AI-driven or manual
--              set-level targets (exact reps/weight per set) without changing the plan.
--              Enables: pre-workout adjustments, mid-workout next-set recommendations,
--              and display of "do X reps @ Y lbs" for each set.

ALTER TABLE workout_sessions
  ADD COLUMN IF NOT EXISTS set_targets JSONB DEFAULT NULL;

COMMENT ON COLUMN workout_sessions.set_targets IS
  'Per-set targets for this session only. Shape: { "<exercise_id>": { "<set_number>": { "reps"?: number, "reps_min"?: number, "reps_max"?: number, "weight_lbs"?: number | null } } }. Used by UI and AI to show/store exact or range targets per set; plan defaults used when missing.';
