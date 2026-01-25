import { createClient } from "@supabase/supabase-js";

// Use service role key for admin operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing required environment variables:");
  console.error("  NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL");
  console.error("  SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const exercises = [
  // Chest
  {
    name: "Bench Press",
    category: "strength",
    muscle_groups: ["chest", "shoulders", "triceps"],
    equipment_needed: ["barbell", "bench"],
    description: "Classic chest exercise performed lying on a bench",
    instructions: [
      "Lie on bench with feet flat on floor",
      "Grip bar slightly wider than shoulder width",
      "Lower bar to chest with control",
      "Press bar up until arms are fully extended",
    ],
  },
  {
    name: "Push-ups",
    category: "strength",
    muscle_groups: ["chest", "shoulders", "triceps"],
    equipment_needed: ["bodyweight"],
    description: "Bodyweight chest exercise",
    instructions: [
      "Start in plank position",
      "Lower body until chest nearly touches ground",
      "Push back up to starting position",
    ],
  },
  {
    name: "Dumbbell Flyes",
    category: "strength",
    muscle_groups: ["chest"],
    equipment_needed: ["dumbbells", "bench"],
    description: "Isolation exercise for chest",
    instructions: [
      "Lie on bench holding dumbbells above chest",
      "Lower weights in wide arc",
      "Bring weights back together above chest",
    ],
  },
  // Back
  {
    name: "Pull-ups",
    category: "strength",
    muscle_groups: ["back", "biceps"],
    equipment_needed: ["pull-up bar"],
    description: "Bodyweight back exercise",
    instructions: [
      "Hang from bar with palms facing away",
      "Pull body up until chin clears bar",
      "Lower with control",
    ],
  },
  {
    name: "Bent-Over Rows",
    category: "strength",
    muscle_groups: ["back", "biceps"],
    equipment_needed: ["barbell"],
    description: "Compound back exercise",
    instructions: [
      "Bend at hips, keep back straight",
      "Pull bar to lower chest/upper abdomen",
      "Lower with control",
    ],
  },
  {
    name: "Lat Pulldowns",
    category: "strength",
    muscle_groups: ["back", "biceps"],
    equipment_needed: ["cable machine"],
    description: "Machine-based back exercise",
    instructions: [
      "Sit at lat pulldown machine",
      "Pull bar to upper chest",
      "Control the weight back up",
    ],
  },
  // Legs
  {
    name: "Squats",
    category: "strength",
    muscle_groups: ["legs", "glutes"],
    equipment_needed: ["barbell"],
    description: "King of leg exercises",
    instructions: [
      "Stand with feet shoulder-width apart",
      "Lower as if sitting in chair",
      "Keep knees behind toes",
      "Return to standing position",
    ],
  },
  {
    name: "Deadlifts",
    category: "strength",
    muscle_groups: ["legs", "back", "glutes"],
    equipment_needed: ["barbell"],
    description: "Full-body compound movement",
    instructions: [
      "Stand with feet hip-width apart",
      "Bend at hips and knees",
      "Grip bar, keep back straight",
      "Stand up, pulling bar along legs",
    ],
  },
  {
    name: "Lunges",
    category: "strength",
    muscle_groups: ["legs", "glutes"],
    equipment_needed: ["bodyweight", "dumbbells"],
    description: "Unilateral leg exercise",
    instructions: [
      "Step forward into lunge position",
      "Lower back knee toward ground",
      "Push back to starting position",
      "Alternate legs",
    ],
  },
  {
    name: "Leg Press",
    category: "strength",
    muscle_groups: ["legs", "glutes"],
    equipment_needed: ["leg press machine"],
    description: "Machine-based leg exercise",
    instructions: [
      "Sit in leg press machine",
      "Place feet on platform",
      "Lower weight by bending knees",
      "Press weight back up",
    ],
  },
  // Shoulders
  {
    name: "Overhead Press",
    category: "strength",
    muscle_groups: ["shoulders", "triceps"],
    equipment_needed: ["barbell", "dumbbells"],
    description: "Shoulder pressing movement",
    instructions: [
      "Stand with feet shoulder-width apart",
      "Press weight overhead",
      "Lower with control",
    ],
  },
  {
    name: "Lateral Raises",
    category: "strength",
    muscle_groups: ["shoulders"],
    equipment_needed: ["dumbbells"],
    description: "Shoulder isolation exercise",
    instructions: [
      "Stand holding dumbbells at sides",
      "Raise arms out to sides",
      "Lower with control",
    ],
  },
  // Arms
  {
    name: "Bicep Curls",
    category: "strength",
    muscle_groups: ["biceps"],
    equipment_needed: ["dumbbells", "barbell"],
    description: "Bicep isolation exercise",
    instructions: [
      "Hold weights with arms at sides",
      "Curl weights toward shoulders",
      "Lower with control",
    ],
  },
  {
    name: "Tricep Dips",
    category: "strength",
    muscle_groups: ["triceps"],
    equipment_needed: ["bodyweight", "bench"],
    description: "Bodyweight tricep exercise",
    instructions: [
      "Sit on edge of bench",
      "Lower body by bending arms",
      "Push back up",
    ],
  },
  // Cardio
  {
    name: "Running",
    category: "cardio",
    muscle_groups: ["legs"],
    equipment_needed: [],
    description: "Cardiovascular exercise",
    instructions: ["Maintain steady pace", "Keep good form"],
  },
  {
    name: "Cycling",
    category: "cardio",
    muscle_groups: ["legs"],
    equipment_needed: ["bicycle", "stationary bike"],
    description: "Low-impact cardio",
    instructions: ["Maintain consistent cadence", "Adjust resistance as needed"],
  },
  {
    name: "Jumping Jacks",
    category: "cardio",
    muscle_groups: ["full body"],
    equipment_needed: ["bodyweight"],
    description: "Full-body cardio movement",
    instructions: [
      "Jump feet apart while raising arms",
      "Jump feet together while lowering arms",
      "Repeat at steady pace",
    ],
  },
];

async function seed() {
  console.log("Seeding exercises...");
  console.log(`Connecting to: ${supabaseUrl}`);

  let successCount = 0;
  let errorCount = 0;

  for (const exercise of exercises) {
    const { error } = await supabase.from("exercises").upsert(exercise, {
      onConflict: "name",
    });

    if (error) {
      console.error(`✗ Error seeding ${exercise.name}:`, error.message);
      errorCount++;
    } else {
      console.log(`✓ Seeded: ${exercise.name}`);
      successCount++;
    }
  }

  console.log("\nSeeding complete!");
  console.log(`  Success: ${successCount}`);
  console.log(`  Errors: ${errorCount}`);
}

seed().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
