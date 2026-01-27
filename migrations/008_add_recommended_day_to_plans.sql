-- Migration: 008_add_recommended_day_to_plans
-- Description: Add recommended_day_of_week field to workout_plans table

-- Add recommended_day_of_week column (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
ALTER TABLE workout_plans
  ADD COLUMN IF NOT EXISTS recommended_day_of_week INTEGER;

-- Add comment to clarify day values
COMMENT ON COLUMN workout_plans.recommended_day_of_week IS 'Recommended day of week: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday';
