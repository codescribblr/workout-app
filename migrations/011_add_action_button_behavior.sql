-- Migration: 011_add_action_button_behavior
-- Description: Add action_button_behavior field to user_headphones table to allow users to configure what button_1 does

-- Add action_button_behavior column
ALTER TABLE user_headphones
ADD COLUMN IF NOT EXISTS action_button_behavior VARCHAR(50) DEFAULT 'complete_set';

-- Update existing records to have default value
UPDATE user_headphones
SET action_button_behavior = 'complete_set'
WHERE action_button_behavior IS NULL;

-- Add comment
COMMENT ON COLUMN user_headphones.action_button_behavior IS 'Defines what action button_1 performs in workout view. Options: pause_resume, complete_set, complete_exercise, complete_workout. Default: complete_set';
