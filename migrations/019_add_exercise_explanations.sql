-- Migration: 019_add_exercise_explanations
-- Description: Add voice and text explanation fields to exercises table

-- Add voice explanation field (optimized for audio playback)
ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS voice_explanation TEXT;

-- Add text explanation field (optimized for screen display)
ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS text_explanation TEXT;

-- Add comments
COMMENT ON COLUMN exercises.voice_explanation IS 'Voice-optimized explanation of how to perform the exercise, designed for audio playback without visual reference';
COMMENT ON COLUMN exercises.text_explanation IS 'Text-optimized explanation of how to perform the exercise, designed for screen display with formatting';
