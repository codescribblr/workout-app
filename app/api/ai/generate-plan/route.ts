import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { description, duration, focusArea, equipment, goals, days } = await request.json();

    // Get available exercises from database with equipment information
    const { data: allExercises } = await supabase
      .from("exercises")
      .select("name, equipment_needed")
      .order("name");

    // Normalize equipment values for matching
    const equipmentNormalizationMap: Record<string, string[]> = {
      "stationary bike": ["stationary bike", "bicycle"],
      "rower": ["rower", "rowing machine"],
      "treadmill": ["treadmill"],
      "pull-up bar": ["pull-up bar", "pull up bar"],
      "cable machine": ["cable machine"],
      "leg press machine": ["leg press machine"],
      "free-weight machines": ["free-weight machines", "free weight machines"],
      "pulley machines": ["pulley machines"],
      "dumbbells": ["dumbbells", "dumbbell"],
      "barbell": ["barbell"],
      "bench": ["bench"],
      "bodyweight": ["bodyweight"],
      "kettlebells": ["kettlebells", "kettlebell"],
      "resistance bands": ["resistance bands", "resistance band"],
      "medicine ball": ["medicine ball"],
    };

    // Expand user equipment to include normalized variations
    const userEquipment = equipment && equipment.length > 0 ? equipment : ["bodyweight"];
    const normalizedUserEquipment = new Set<string>();
    
    userEquipment.forEach((eq: string) => {
      normalizedUserEquipment.add(eq.toLowerCase());
      // Add normalized variations
      const normalized = equipmentNormalizationMap[eq.toLowerCase()];
      if (normalized) {
        normalized.forEach((variant) => normalizedUserEquipment.add(variant));
      }
    });

    // Filter exercises based on user's selected equipment
    const compatibleExercises = (allExercises || []).filter((exercise) => {
      if (!exercise.equipment_needed || exercise.equipment_needed.length === 0) {
        // If exercise has no equipment requirement, include it
        return true;
      }
      
      // Check if exercise's equipment needs can be satisfied with user's equipment
      // For exercises with multiple equipment options, we check if user has at least one option
      // Examples:
      // - "Cycling" needs ['bicycle', 'stationary bike'] - user needs ONE of these
      // - "Lunges" needs ['bodyweight', 'dumbbells'] - user needs ONE of these  
      // - "Bench Press" needs ['barbell', 'bench'] - user needs BOTH (but we'll be lenient and require at least the primary equipment)
      // For now, we'll use "any" matching - if user has any of the exercise's equipment, it's compatible
      // This is safer and more permissive
      const hasCompatibleEquipment = exercise.equipment_needed.some((eq: string) => {
        const eqLower = eq.toLowerCase();
        return normalizedUserEquipment.has(eqLower);
      });
      
      return hasCompatibleEquipment;
    });

    const exerciseNames = compatibleExercises.map((e) => e.name);
    const exerciseNamesList = exerciseNames.length > 0 
      ? exerciseNames.join(", ")
      : "No exercises available in database";

    // Log for debugging
    if (compatibleExercises.length === 0) {
      console.warn(`No compatible exercises found for equipment: ${userEquipment.join(", ")}`);
    } else {
      console.log(`Found ${compatibleExercises.length} compatible exercises for equipment: ${userEquipment.join(", ")}`);
    }

    // Get user profile for context
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    // Get recent workout history
    const { data: recentWorkouts } = await supabase
      .from("workout_sessions")
      .select(
        `
        *,
        workout_sets (
          exercise_id,
          reps,
          weight_lbs
        )
      `
      )
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(5);

    const selectedDays = Array.isArray(days) && days.length > 0 ? days : [0]; // Default to Sunday if none selected
    const isMultiDay = selectedDays.length > 1;
    // For multi-day plans, we'll let AI distribute muscle groups across days
    // For single day, use the selected focus area
    const effectiveFocusArea = isMultiDay ? null : (focusArea || "full body");

    const equipmentList =
      equipment && equipment.length > 0
        ? equipment.join(", ")
        : "bodyweight (only)";

    // Create equipment compatibility info for AI
    const equipmentInfo = compatibleExercises.length > 0
      ? `\n\nEXERCISES COMPATIBLE WITH YOUR EQUIPMENT (${equipmentList}):\n${exerciseNamesList}\n\nIMPORTANT: You MUST ONLY use exercises from the list above. Each exercise in the list above is compatible with your selected equipment.`
      : `\n\nWARNING: No exercises found matching your equipment (${equipmentList}). Please select different equipment or use bodyweight exercises.`;

    const goalsList = goals && goals.length > 0
      ? goals.map((goal: string, index: number) => `${index + 1}. ${goal}`).join("\n")
      : "Not specified";

    const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    // Generate plans for each selected day
    const plans = [];

    for (const day of selectedDays) {
      const dayName = DAY_NAMES[day] || "Unknown";

      const systemPrompt = `You are a fitness coach. Generate a structured workout plan for ${dayName} based on user information.
Return ONLY valid JSON in this exact format:
{
  "name": "Creative workout plan name that reflects the specific muscle groups/focus for this day${isMultiDay ? " (e.g., 'Push Day - Chest & Triceps', 'Pull Day - Back & Biceps', 'Leg Day - Quads & Glutes')" : " and goals (e.g., 'Upper Body Power', 'Leg Day Strength', 'Full Body Conditioning')"}",
  "description": "Brief description of the workout plan${isMultiDay ? " and which muscle groups it targets" : ""}",
  "day_of_week": ${day},
  "exercises": [
    {
      "name": "Exercise name (MUST be one of these exact names: ${exerciseNamesList})",
      "sets": 3,
      "reps_min": 8,
      "reps_max": 12,
      "weight_lbs": null or number,
      "rest_seconds": 60
    }
  ]
}

CRITICAL EQUIPMENT REQUIREMENTS:
- User's Available Equipment: ${equipmentList}
- You MUST ONLY use exercises from this pre-filtered list: ${exerciseNamesList}
- ALL exercises in this list have been verified to be compatible with the user's equipment (${equipmentList})
- Do NOT use any exercise that is NOT in the list above
- Do NOT invent exercise names
- Do NOT use exercises that require equipment the user doesn't have
- The list above has already been filtered - every exercise in it can be performed with the user's available equipment
- If you try to use an exercise not in the list, it will be rejected - so stick to the list!

Generate a creative, descriptive name for the workout plan that reflects the focus area and goals. Do NOT include the day name in the plan name - the day is stored separately.`;

      // Build comprehensive user profile section
      const profileSections = [];
      
      // Calculate age from birth year
      let age: number | null = null;
      if (profile?.birth_year) {
        const currentYear = new Date().getFullYear();
        age = currentYear - profile.birth_year;
        profileSections.push(`- Age: ${age} years old (born ${profile.birth_year})`);
      } else {
        profileSections.push(`- Age: Not specified (user should provide birth year for age-appropriate recommendations)`);
      }
      
      if (profile?.weight_lbs) {
        profileSections.push(`- Weight: ${profile.weight_lbs} lbs`);
      } else {
        profileSections.push(`- Weight: Not specified (user should provide this for weight-based exercise recommendations)`);
      }
      
      if (profile?.height_inches) {
        const feet = Math.floor(profile.height_inches / 12);
        const inches = profile.height_inches % 12;
        profileSections.push(`- Height: ${feet}'${inches}" (${profile.height_inches} inches)`);
      } else {
        profileSections.push(`- Height: Not specified (user should provide this for body-proportion considerations)`);
      }
      
      if (profile?.fitness_level) {
        // Map fitness level to descriptive text for AI
        const fitnessLevelMap: Record<string, string> = {
          sedentary: "Sedentary (less than 3,000 steps/day, minimal physical activity)",
          lightly_active: "Lightly Active (3,000-7,500 steps/day, light exercise 1-3 days/week)",
          moderately_active: "Moderately Active (7,500-10,000 steps/day, moderate exercise 3-5 days/week)",
          very_active: "Very Active (10,000+ steps/day, intense exercise 6-7 days/week)",
          extremely_active: "Extremely Active (heavy physical activity daily, physically demanding job)",
        };
        const fitnessDescription = fitnessLevelMap[profile.fitness_level] || profile.fitness_level;
        profileSections.push(`- Fitness Level: ${fitnessDescription}`);
      } else {
        profileSections.push(`- Fitness Level: Not specified (assume moderately active, but user should provide this for appropriate intensity)`);
      }

      const userPrompt = `User Profile:
${profileSections.join("\n")}

Recent Workout History: ${recentWorkouts?.length || 0} recent sessions

Day: ${dayName}
Duration: ${duration || 60} minutes
${isMultiDay ? `This is day ${selectedDays.indexOf(day) + 1} of ${selectedDays.length} workout days.` : `Focus Area: ${effectiveFocusArea}`}
Available Equipment: ${equipmentList}${equipmentInfo}

User Goals (in priority order):
${goalsList}

${description ? `Additional Details: ${description}` : ""}

${isMultiDay ? `CRITICAL MULTI-DAY WORKOUT STRATEGY - READ CAREFULLY:
This is part of a ${selectedDays.length}-day workout schedule. You are generating plan for ${dayName}, which is DAY ${selectedDays.indexOf(day) + 1} of ${selectedDays.length}.

ABSOLUTE REQUIREMENT: Each day MUST target DIFFERENT muscle groups. Never repeat the same muscle groups across multiple days.

MANDATORY MUSCLE GROUP ASSIGNMENT FOR ${selectedDays.length} DAYS:
${(() => {
  const dayIndex = selectedDays.indexOf(day);
  if (selectedDays.length === 2) {
    const assignments = [
      "Day 1: UPPER BODY ONLY (chest, shoulders, triceps, back, biceps)",
      "Day 2: LOWER BODY ONLY (legs, glutes, core)"
    ];
    return assignments[dayIndex];
  } else if (selectedDays.length === 3) {
    const assignments = [
      "Day 1: PUSH MUSCLES ONLY (chest, shoulders, triceps)",
      "Day 2: PULL MUSCLES ONLY (back, biceps)",
      "Day 3: LEGS ONLY (legs, glutes, core)"
    ];
    return assignments[dayIndex];
  } else if (selectedDays.length === 4) {
    const assignments = [
      "Day 1: CHEST & TRICEPS ONLY (chest, triceps)",
      "Day 2: BACK & BICEPS ONLY (back, biceps)",
      "Day 3: LEGS & GLUTES ONLY (legs, glutes)",
      "Day 4: SHOULDERS & CORE ONLY (shoulders, core)"
    ];
    return assignments[dayIndex];
  } else if (selectedDays.length === 5) {
    const assignments = [
      "Day 1: CHEST & TRICEPS ONLY (chest, triceps)",
      "Day 2: BACK & BICEPS ONLY (back, biceps)",
      "Day 3: LEGS (QUADS FOCUS) ONLY (legs/quads)",
      "Day 4: LEGS (GLUTES & HAMSTRINGS) ONLY (glutes, hamstrings)",
      "Day 5: SHOULDERS & CORE ONLY (shoulders, core)"
    ];
    return assignments[dayIndex];
  } else if (selectedDays.length === 6) {
    const assignments = [
      "Day 1: CHEST & TRICEPS ONLY (chest, triceps)",
      "Day 2: BACK & BICEPS ONLY (back, biceps)",
      "Day 3: LEGS (QUADS) ONLY (legs/quads)",
      "Day 4: LEGS (GLUTES & HAMSTRINGS) ONLY (glutes, hamstrings)",
      "Day 5: SHOULDERS ONLY (shoulders)",
      "Day 6: ARMS & CORE ONLY (biceps, triceps, core)"
    ];
    return assignments[dayIndex];
  } else {
    // 7 days - full split
    const assignments = [
      "Day 1: CHEST ONLY (chest)",
      "Day 2: BACK ONLY (back)",
      "Day 3: LEGS (QUADS) ONLY (legs/quads)",
      "Day 4: SHOULDERS ONLY (shoulders)",
      "Day 5: ARMS ONLY (biceps, triceps)",
      "Day 6: LEGS (GLUTES & HAMSTRINGS) ONLY (glutes, hamstrings)",
      "Day 7: CORE & CARDIO ONLY (core, light cardio)"
    ];
    return assignments[dayIndex];
  }
})()}

YOU ARE GENERATING DAY ${selectedDays.indexOf(day) + 1}. Follow the assignment above EXACTLY.

CRITICAL RULES:
1. ONLY target the muscle groups assigned to Day ${selectedDays.indexOf(day) + 1} above
2. DO NOT include exercises for muscle groups assigned to other days
3. DO NOT create full-body workouts
4. DO NOT repeat muscle groups that will be used on other days
5. Focus ONLY on the specific muscle groups listed for your day

Example: If you're Day 1 of a 4-day plan, you ONLY do chest and triceps exercises. Do NOT include back, biceps, legs, glutes, shoulders, or core - those are for other days.

Create a focused workout targeting ONLY the muscle groups assigned to Day ${selectedDays.indexOf(day) + 1}.` : ""}

IMPORTANT: 
- Prioritize the user's goals in the order they provided. The first goal is the highest priority.
- CRITICAL: ONLY use exercise names from this pre-filtered list: ${exerciseNamesList}
- ALL exercises in this list are compatible with equipment: ${equipmentList}
- Do NOT create or invent exercise names. If an exercise isn't in the list above, don't use it.
- Do NOT use exercises that require equipment the user doesn't have. The list above has already been filtered to match the user's equipment.
- Consider the user's goals when selecting exercises and structuring the workout plan.
- CRITICAL: Adjust workout intensity, volume, and exercise selection based on the user's age, weight, height, and fitness level:
  * Age: Consider joint health, recovery time, and age-appropriate intensity for older users
  * Weight: Adjust bodyweight exercise difficulty and weight recommendations accordingly
  * Height: Consider body proportions for proper form and range of motion
  * Fitness Level: 
    - Sedentary: Very low volume, basic exercises, longer rest periods (60-90s), focus on building basic movement patterns, start with bodyweight or very light weights
    - Lightly Active: Low to moderate volume, simple exercises, moderate rest periods (60s), gradual progression, mix of bodyweight and light weights
    - Moderately Active: Moderate volume, standard exercises, standard rest periods (45-60s), progressive overload, balanced workout structure
    - Very Active: Higher volume, more complex movements, shorter rest periods (30-45s), advanced techniques, can handle more intensity
    - Extremely Active: High volume, complex movements, minimal rest periods (30s or less), advanced techniques, high intensity, can handle demanding workouts
- If any profile information is missing, err on the side of caution and use conservative recommendations suitable for moderately active fitness level.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
      });

      const planData = JSON.parse(completion.choices[0].message.content || "{}");
      
      // Validate that all exercises exist in database and match equipment
      if (planData.exercises && Array.isArray(planData.exercises)) {
        planData.exercises = planData.exercises.filter((ex: any) => {
          // Check if exercise exists in compatible exercises list
          const exercise = compatibleExercises.find((e) => e.name === ex.name);
          
          if (!exercise) {
            console.warn(`Exercise "${ex.name}" not found in compatible exercises list, filtering out`);
            return false;
          }
          
          // Double-check equipment compatibility
          if (exercise.equipment_needed && exercise.equipment_needed.length > 0) {
            const isCompatible = exercise.equipment_needed.some((eq: string) => {
              const eqLower = eq.toLowerCase();
              return normalizedUserEquipment.has(eqLower);
            });
            
            if (!isCompatible) {
              console.warn(`Exercise "${ex.name}" requires equipment not available: ${exercise.equipment_needed.join(", ")}, filtering out`);
              return false;
            }
          }
          
          return true;
        });
      }

      plans.push(planData);
    }

    // Return single plan if only one day, array if multiple
    return NextResponse.json(selectedDays.length === 1 ? plans[0] : plans);
  } catch (error) {
    console.error("AI plan generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate workout plan" },
      { status: 500 }
    );
  }
}
