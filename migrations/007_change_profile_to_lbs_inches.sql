-- Migration: 007_change_profile_to_lbs_inches
-- Description: Change user_profiles weight_kg to weight_lbs and height_cm to height_inches

-- Rename weight column
ALTER TABLE user_profiles
  RENAME COLUMN weight_kg TO weight_lbs;

-- Rename height column
ALTER TABLE user_profiles
  RENAME COLUMN height_cm TO height_inches;
