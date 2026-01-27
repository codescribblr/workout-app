-- Migration: 015_remove_warmup_cooldown_from_plans
-- Description: Remove warm-up and cooldown fields from workout_plans and add flags to workout_plan_exercises

-- Step 1: Add is_warmup and is_cooldown flags to workout_plan_exercises
ALTER TABLE workout_plan_exercises
ADD COLUMN IF NOT EXISTS is_warmup BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_cooldown BOOLEAN DEFAULT false;

-- Step 2: Add constraint to ensure an exercise cannot be both warmup and cooldown
ALTER TABLE workout_plan_exercises
ADD CONSTRAINT check_not_both_warmup_cooldown 
CHECK (NOT (is_warmup = true AND is_cooldown = true));

-- Step 3: Add comments
COMMENT ON COLUMN workout_plan_exercises.is_warmup IS 'Flag indicating if this exercise is a warm-up exercise';
COMMENT ON COLUMN workout_plan_exercises.is_cooldown IS 'Flag indicating if this exercise is a cooldown exercise';

-- Step 4: Remove warm-up and cooldown fields from workout_plans
ALTER TABLE workout_plans
DROP COLUMN IF EXISTS warmup_duration_minutes,
DROP COLUMN IF EXISTS warmup_exercises,
DROP COLUMN IF EXISTS warmup_rest_seconds,
DROP COLUMN IF EXISTS cooldown_duration_minutes,
DROP COLUMN IF EXISTS cooldown_exercises;

-- Note: When creating warm-up or cooldown exercises in workout_plan_exercises:
-- - Set is_warmup = true OR is_cooldown = true (not both)
-- - Set sets = 1 (warm-up/cooldown are always single "set")
-- - Set reps_min = target duration in minutes
-- - Store exercise list/description in notes field if needed
