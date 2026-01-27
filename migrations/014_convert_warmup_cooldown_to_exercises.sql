-- Migration: 014_convert_warmup_cooldown_to_exercises
-- Description: Convert warm-up and cooldown to special exercises, remove fields from workout_sessions

-- Step 1: Add time tracking to workout_sets for time-based exercises (like warm-up/cooldown)
ALTER TABLE workout_sets
ADD COLUMN IF NOT EXISTS time_minutes DECIMAL(5,2);

COMMENT ON COLUMN workout_sets.time_minutes IS 'Time duration in minutes for time-based exercises (warm-up, cooldown, etc.)';

-- Step 2: Add warm-up and cooldown exercises to the exercises table
INSERT INTO exercises (name, category, muscle_groups, equipment_needed, description, instructions) VALUES
(
  'Warm-up',
  'warmup',
  ARRAY[]::text[],
  ARRAY[]::text[],
  'Dynamic warm-up routine to prepare the body for exercise. Description and exercises vary by workout plan.',
  ARRAY['Follow the warm-up routine specified in your workout plan', 'Focus on dynamic movements', 'Gradually increase intensity', 'Complete the full warm-up duration']
),
(
  'Cooldown',
  'cooldown',
  ARRAY[]::text[],
  ARRAY[]::text[],
  'Cool-down routine to help the body recover after exercise. Description and exercises vary by workout plan.',
  ARRAY['Follow the cool-down routine specified in your workout plan', 'Focus on static stretching', 'Hold stretches for 15-30 seconds', 'Complete the full cool-down duration']
)
ON CONFLICT (name) DO NOTHING;

-- Step 3: Remove warm-up and cooldown fields from workout_sessions
ALTER TABLE workout_sessions
DROP COLUMN IF EXISTS warmup_completed_at,
DROP COLUMN IF EXISTS warmup_completion_data,
DROP COLUMN IF EXISTS cooldown_completed_at,
DROP COLUMN IF EXISTS cooldown_completion_data;

-- Note: The warmup_exercises and cooldown_exercises fields in workout_plans will remain
-- as they contain the dynamic exercise lists/descriptions for each plan.
-- These will be referenced when adding warm-up/cooldown exercises to workout_plan_exercises.
