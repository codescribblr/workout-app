-- Migration: 004_change_weight_to_lbs
-- Description: Change weight_kg to weight_lbs in workout_plan_exercises and workout_sets tables

-- Rename column in workout_plan_exercises
ALTER TABLE workout_plan_exercises 
  RENAME COLUMN weight_kg TO weight_lbs;

-- Rename column in workout_sets
ALTER TABLE workout_sets 
  RENAME COLUMN weight_kg TO weight_lbs;
