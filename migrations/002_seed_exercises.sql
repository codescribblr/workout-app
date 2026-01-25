-- Migration: 002_seed_exercises
-- Description: Seed the exercises table with common exercises

-- Insert exercises (using ON CONFLICT to make it idempotent)
INSERT INTO exercises (name, category, muscle_groups, equipment_needed, description, instructions) VALUES
-- Chest
('Bench Press', 'strength', ARRAY['chest', 'shoulders', 'triceps'], ARRAY['barbell', 'bench'], 'Classic chest exercise performed lying on a bench', ARRAY['Lie on bench with feet flat on floor', 'Grip bar slightly wider than shoulder width', 'Lower bar to chest with control', 'Press bar up until arms are fully extended']),
('Push-ups', 'strength', ARRAY['chest', 'shoulders', 'triceps'], ARRAY['bodyweight'], 'Bodyweight chest exercise', ARRAY['Start in plank position', 'Lower body until chest nearly touches ground', 'Push back up to starting position']),
('Dumbbell Flyes', 'strength', ARRAY['chest'], ARRAY['dumbbells', 'bench'], 'Isolation exercise for chest', ARRAY['Lie on bench holding dumbbells above chest', 'Lower weights in wide arc', 'Bring weights back together above chest']),

-- Back
('Pull-ups', 'strength', ARRAY['back', 'biceps'], ARRAY['pull-up bar'], 'Bodyweight back exercise', ARRAY['Hang from bar with palms facing away', 'Pull body up until chin clears bar', 'Lower with control']),
('Bent-Over Rows', 'strength', ARRAY['back', 'biceps'], ARRAY['barbell'], 'Compound back exercise', ARRAY['Bend at hips, keep back straight', 'Pull bar to lower chest/upper abdomen', 'Lower with control']),
('Lat Pulldowns', 'strength', ARRAY['back', 'biceps'], ARRAY['cable machine'], 'Machine-based back exercise', ARRAY['Sit at lat pulldown machine', 'Pull bar to upper chest', 'Control the weight back up']),

-- Legs
('Squats', 'strength', ARRAY['legs', 'glutes'], ARRAY['barbell'], 'King of leg exercises', ARRAY['Stand with feet shoulder-width apart', 'Lower as if sitting in chair', 'Keep knees behind toes', 'Return to standing position']),
('Deadlifts', 'strength', ARRAY['legs', 'back', 'glutes'], ARRAY['barbell'], 'Full-body compound movement', ARRAY['Stand with feet hip-width apart', 'Bend at hips and knees', 'Grip bar, keep back straight', 'Stand up, pulling bar along legs']),
('Lunges', 'strength', ARRAY['legs', 'glutes'], ARRAY['bodyweight', 'dumbbells'], 'Unilateral leg exercise', ARRAY['Step forward into lunge position', 'Lower back knee toward ground', 'Push back to starting position', 'Alternate legs']),
('Leg Press', 'strength', ARRAY['legs', 'glutes'], ARRAY['leg press machine'], 'Machine-based leg exercise', ARRAY['Sit in leg press machine', 'Place feet on platform', 'Lower weight by bending knees', 'Press weight back up']),

-- Shoulders
('Overhead Press', 'strength', ARRAY['shoulders', 'triceps'], ARRAY['barbell', 'dumbbells'], 'Shoulder pressing movement', ARRAY['Stand with feet shoulder-width apart', 'Press weight overhead', 'Lower with control']),
('Lateral Raises', 'strength', ARRAY['shoulders'], ARRAY['dumbbells'], 'Shoulder isolation exercise', ARRAY['Stand holding dumbbells at sides', 'Raise arms out to sides', 'Lower with control']),

-- Arms
('Bicep Curls', 'strength', ARRAY['biceps'], ARRAY['dumbbells', 'barbell'], 'Bicep isolation exercise', ARRAY['Hold weights with arms at sides', 'Curl weights toward shoulders', 'Lower with control']),
('Tricep Dips', 'strength', ARRAY['triceps'], ARRAY['bodyweight', 'bench'], 'Bodyweight tricep exercise', ARRAY['Sit on edge of bench', 'Lower body by bending arms', 'Push back up']),

-- Cardio
('Running', 'cardio', ARRAY['legs'], ARRAY[]::text[], 'Cardiovascular exercise', ARRAY['Maintain steady pace', 'Keep good form']),
('Cycling', 'cardio', ARRAY['legs'], ARRAY['bicycle', 'stationary bike'], 'Low-impact cardio', ARRAY['Maintain consistent cadence', 'Adjust resistance as needed']),
('Jumping Jacks', 'cardio', ARRAY['full body'], ARRAY['bodyweight'], 'Full-body cardio movement', ARRAY['Jump feet apart while raising arms', 'Jump feet together while lowering arms', 'Repeat at steady pace'])

ON CONFLICT (name) DO NOTHING;
