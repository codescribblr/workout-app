-- Migration: 003_add_sets_max_to_plan_exercises
-- Description: Add sets_max column to support variable sets (e.g., 3-4 sets)

ALTER TABLE workout_plan_exercises 
ADD COLUMN IF NOT EXISTS sets_max INTEGER;

COMMENT ON COLUMN workout_plan_exercises.sets_max IS 'Maximum sets for variable set ranges (e.g., if sets=3 and sets_max=4, means 3-4 sets)';
