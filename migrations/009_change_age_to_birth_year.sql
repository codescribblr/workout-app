-- Migration: 009_change_age_to_birth_year
-- Description: Change user_profiles age column to birth_year for automatic age calculation

-- Rename age column to birth_year
ALTER TABLE user_profiles
  RENAME COLUMN age TO birth_year;

-- Add comment to clarify the field
COMMENT ON COLUMN user_profiles.birth_year IS 'User birth year (4 digits, e.g., 1990). Used to calculate age automatically.';
