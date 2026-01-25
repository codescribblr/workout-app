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
('Jumping Jacks', 'cardio', ARRAY['full body'], ARRAY['bodyweight'], 'Full-body cardio movement', ARRAY['Jump feet apart while raising arms', 'Jump feet together while lowering arms', 'Repeat at steady pace']),

-- Additional exercises from user's plan
('Bench Dips', 'strength', ARRAY['triceps'], ARRAY['bench', 'bodyweight'], 'Tricep exercise using a bench', ARRAY['Sit on edge of bench with hands gripping edge', 'Slide forward off bench', 'Lower body by bending arms', 'Push back up']),
('Overhead DB Triceps Extension', 'strength', ARRAY['triceps'], ARRAY['dumbbells'], 'Tricep isolation exercise', ARRAY['Hold dumbbell overhead with both hands', 'Lower behind head by bending elbows', 'Extend arms back up']),
('Single-Arm DB Row', 'strength', ARRAY['back', 'biceps'], ARRAY['dumbbells', 'bench'], 'Unilateral back exercise', ARRAY['Place knee and hand on bench', 'Pull dumbbell to hip', 'Lower with control', 'Alternate sides']),
('Incline DB Curls', 'strength', ARRAY['biceps'], ARRAY['dumbbells', 'bench'], 'Bicep exercise on inclined bench', ARRAY['Sit on inclined bench', 'Curl dumbbells toward shoulders', 'Lower with control']),
('Goblet Squats', 'strength', ARRAY['legs', 'glutes'], ARRAY['dumbbell'], 'Squat variation holding weight at chest', ARRAY['Hold dumbbell at chest', 'Squat down keeping weight close', 'Stand back up']),
('Reverse Lunges', 'strength', ARRAY['legs', 'glutes'], ARRAY['bodyweight', 'dumbbells'], 'Lunge variation stepping backward', ARRAY['Step backward into lunge', 'Lower back knee toward ground', 'Push back to starting position', 'Alternate legs']),
('DB Romanian Deadlifts', 'strength', ARRAY['legs', 'glutes', 'back'], ARRAY['dumbbells'], 'Hip hinge movement with dumbbells', ARRAY['Hold dumbbells at sides', 'Hinge at hips, keep back straight', 'Lower weights along legs', 'Return to standing']),
('Hip Thrusts', 'strength', ARRAY['glutes'], ARRAY['bodyweight', 'barbell', 'dumbbell'], 'Glute-focused exercise', ARRAY['Sit with upper back against bench', 'Drive hips up', 'Squeeze glutes at top', 'Lower with control']),
('Pike Push-ups', 'strength', ARRAY['shoulders', 'triceps'], ARRAY['bodyweight'], 'Shoulder-focused push-up variation', ARRAY['Start in downward dog position', 'Lower head toward ground', 'Push back up']),
('Hanging Knee Raises', 'strength', ARRAY['core'], ARRAY['pull-up bar'], 'Core exercise hanging from bar', ARRAY['Hang from pull-up bar', 'Raise knees toward chest', 'Lower with control']),
('DB Bench Press', 'strength', ARRAY['chest', 'shoulders', 'triceps'], ARRAY['dumbbells', 'bench'], 'Chest exercise with dumbbells', ARRAY['Lie on bench holding dumbbells', 'Press weights up until arms extended', 'Lower with control']),
('Chin-ups', 'strength', ARRAY['back', 'biceps'], ARRAY['pull-up bar'], 'Pull-up variation with palms facing you', ARRAY['Hang from bar with palms facing you', 'Pull body up until chin clears bar', 'Lower with control'])

ON CONFLICT (name) DO NOTHING;
