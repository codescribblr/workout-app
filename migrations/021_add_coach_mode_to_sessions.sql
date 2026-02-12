-- Migration: 021_add_coach_mode_to_sessions
-- Description: Add coach_mode to workout_sessions so the app knows to run AI assessment
--              on load and to use coach audio/interjections during the workout.

ALTER TABLE workout_sessions
  ADD COLUMN IF NOT EXISTS coach_mode BOOLEAN DEFAULT false;

COMMENT ON COLUMN workout_sessions.coach_mode IS
  'When true, session uses AI coach: pre-workout set_targets assessment and mid-workout encouragement/next-set adjustments. Audio mode is set to coach for the session.';
