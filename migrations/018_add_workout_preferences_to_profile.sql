-- Migration: 018_add_workout_preferences_to_profile
-- Description: Add workout preferences fields to user_profiles for AI plan generator sync

-- Add equipment array (list of available equipment)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS equipment TEXT[];

-- Add preferred workout days (array of day numbers 0-6, where 0=Sunday, 6=Saturday)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS preferred_workout_days INTEGER[];

-- Add preferred workout duration in minutes
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS preferred_workout_duration INTEGER;

-- Add preferred focus area (e.g., "full body", "upper body", "chest", etc.)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS preferred_focus_area VARCHAR(50);

-- Add workout preferences description (additional details, injuries, etc.)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS workout_preferences_description TEXT;

-- Add comments
COMMENT ON COLUMN user_profiles.equipment IS 'Array of available equipment for workouts (e.g., ["dumbbells", "barbell", "bodyweight"])';
COMMENT ON COLUMN user_profiles.preferred_workout_days IS 'Array of preferred workout days (0=Sunday, 1=Monday, ..., 6=Saturday)';
COMMENT ON COLUMN user_profiles.preferred_workout_duration IS 'Preferred workout duration in minutes';
COMMENT ON COLUMN user_profiles.preferred_focus_area IS 'Preferred workout focus area (e.g., "full body", "upper body", "chest", "legs", etc.)';
COMMENT ON COLUMN user_profiles.workout_preferences_description IS 'Additional workout preferences, injuries, exercise inclusions/exclusions, etc.';
