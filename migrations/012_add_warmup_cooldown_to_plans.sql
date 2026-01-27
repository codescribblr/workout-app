-- Migration: 012_add_warmup_cooldown_to_plans
-- Description: Add warm-up and cooldown fields to workout_plans table

-- Add warm-up fields
ALTER TABLE workout_plans
ADD COLUMN IF NOT EXISTS warmup_duration_minutes INTEGER,
ADD COLUMN IF NOT EXISTS warmup_exercises JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS warmup_rest_seconds INTEGER DEFAULT 60;

-- Add cooldown fields
ALTER TABLE workout_plans
ADD COLUMN IF NOT EXISTS cooldown_duration_minutes INTEGER,
ADD COLUMN IF NOT EXISTS cooldown_exercises JSONB DEFAULT '[]'::jsonb;

-- Add comments
COMMENT ON COLUMN workout_plans.warmup_duration_minutes IS 'Duration of warm-up period in minutes';
COMMENT ON COLUMN workout_plans.warmup_exercises IS 'Array of warm-up exercises/stretches (can be exercise IDs or text descriptions)';
COMMENT ON COLUMN workout_plans.warmup_rest_seconds IS 'Rest period after warm-up in seconds';
COMMENT ON COLUMN workout_plans.cooldown_duration_minutes IS 'Duration of cooldown period in minutes';
COMMENT ON COLUMN workout_plans.cooldown_exercises IS 'Array of cooldown exercises/stretches (can be exercise IDs or text descriptions)';
