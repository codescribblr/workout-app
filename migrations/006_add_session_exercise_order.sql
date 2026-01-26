-- Migration: 006_add_session_exercise_order
-- Description: Add table to track exercise order per workout session (allows reordering exercises within a session)

-- Table to track exercise order and completion per session
CREATE TABLE IF NOT EXISTS workout_session_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_session_id UUID REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id UUID REFERENCES exercises(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  skipped BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workout_session_id, exercise_id, order_index)
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_session_exercises_session_id ON workout_session_exercises(workout_session_id, order_index);

-- RLS Policy
ALTER TABLE workout_session_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view exercises for own sessions" ON workout_session_exercises
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workout_sessions
      WHERE workout_sessions.id = workout_session_exercises.workout_session_id
      AND workout_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage exercises for own sessions" ON workout_session_exercises
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workout_sessions
      WHERE workout_sessions.id = workout_session_exercises.workout_session_id
      AND workout_sessions.user_id = auth.uid()
    )
  );
