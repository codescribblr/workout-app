-- Migration: 005_add_delete_policy_for_sessions
-- Description: Add DELETE policy for workout_sessions to allow users to delete their own sessions

CREATE POLICY "Users can delete own workout sessions" ON workout_sessions
  FOR DELETE USING (auth.uid() = user_id);
