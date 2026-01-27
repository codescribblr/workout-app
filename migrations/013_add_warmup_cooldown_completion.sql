-- Migration: 013_add_warmup_cooldown_completion
-- Description: Add warm-up and cooldown completion tracking to workout_sessions table

-- Add warm-up and cooldown completion fields
ALTER TABLE workout_sessions
ADD COLUMN IF NOT EXISTS warmup_completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS warmup_completion_data JSONB,
ADD COLUMN IF NOT EXISTS cooldown_completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cooldown_completion_data JSONB;

-- Add comments
COMMENT ON COLUMN workout_sessions.warmup_completed_at IS 'Timestamp when warm-up was completed';
COMMENT ON COLUMN workout_sessions.warmup_completion_data IS 'Data about warm-up completion (duration, exercises completed, etc.)';
COMMENT ON COLUMN workout_sessions.cooldown_completed_at IS 'Timestamp when cooldown was completed';
COMMENT ON COLUMN workout_sessions.cooldown_completion_data IS 'Data about cooldown completion (duration, exercises completed, etc.)';
