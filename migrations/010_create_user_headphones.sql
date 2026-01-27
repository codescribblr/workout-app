-- Migration: 010_create_user_headphones
-- Description: Create user_headphones table to support multiple headphones per user with button mappings

-- Create user_headphones table
CREATE TABLE IF NOT EXISTS user_headphones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(100) NOT NULL,
  is_default BOOLEAN DEFAULT false,
  button_mappings JSONB NOT NULL DEFAULT '{
    "button_1": null,
    "button_2": null,
    "button_3": null
  }'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for user lookups
CREATE INDEX IF NOT EXISTS idx_user_headphones_user_id ON user_headphones(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE user_headphones ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own headphones" ON user_headphones
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own headphones" ON user_headphones
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own headphones" ON user_headphones
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own headphones" ON user_headphones
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_headphones_updated_at
  BEFORE UPDATE ON user_headphones
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TABLE user_headphones IS 'Stores user headphone configurations with button mappings. Each user can have multiple headphones.';
COMMENT ON COLUMN user_headphones.button_mappings IS 'JSONB object mapping Button 1, 2, 3 to detected button presses. Format: {"button_1": {"type": "single_press"|"double_press"|"long_press"|"volume_up"|"volume_down", "media_action": "play"|"pause"|"nexttrack"|"previoustrack"|"seekforward"|"seekbackward"}, "button_2": {...}, "button_3": {...}}';
