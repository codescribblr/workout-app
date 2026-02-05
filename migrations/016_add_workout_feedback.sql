-- Migration: 016_add_workout_feedback
-- Description: Add table to store post-workout feedback for AI coaching improvements

-- Create workout_feedback table
CREATE TABLE IF NOT EXISTS workout_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_session_id UUID REFERENCES workout_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Raw user input (free text response)
  raw_feedback TEXT,
  
  -- Structured/parsed data
  parsed_data JSONB DEFAULT '{}'::jsonb,
  
  -- Core sentiment and effort metrics
  overall_sentiment INTEGER, -- 1-10 scale: 1=terrible, 5=neutral, 10=excellent
  effort_level VARCHAR(20), -- 'too_hard', 'just_right', 'too_easy', 'varied'
  
  -- Problematic exercises (array of exercise IDs)
  problematic_exercise_ids UUID[],
  
  -- Injury concerns
  has_injury_concern BOOLEAN DEFAULT false,
  affected_muscle_groups TEXT[], -- e.g., ['shoulder', 'lower_back', 'knee']
  injury_description TEXT, -- Free text description of injury concern
  
  -- Additional structured data stored in parsed_data JSONB:
  -- - sentiment_breakdown: { energy: 1-10, satisfaction: 1-10, motivation: 1-10 }
  -- - exercise_feedback: [{ exercise_id, issue_type, notes }]
  -- - recommendations_requested: boolean
  -- - skipped: boolean (if user skipped feedback)
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_workout_feedback_session_id ON workout_feedback(workout_session_id);
CREATE INDEX IF NOT EXISTS idx_workout_feedback_user_id ON workout_feedback(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workout_feedback_sentiment ON workout_feedback(overall_sentiment);
CREATE INDEX IF NOT EXISTS idx_workout_feedback_effort_level ON workout_feedback(effort_level);
CREATE INDEX IF NOT EXISTS idx_workout_feedback_injury ON workout_feedback(has_injury_concern) WHERE has_injury_concern = true;

-- Enable RLS
ALTER TABLE workout_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own workout feedback" ON workout_feedback
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own workout feedback" ON workout_feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workout feedback" ON workout_feedback
  FOR UPDATE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_workout_feedback_updated_at
  BEFORE UPDATE ON workout_feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
