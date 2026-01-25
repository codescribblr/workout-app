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

    const { prompt, duration, focusArea } = await request.json();

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
          weight_kg
        )
      `
      )
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(5);

    const systemPrompt = `You are a fitness coach. Generate a structured workout plan based on user information.
Return ONLY valid JSON in this exact format:
{
  "name": "Workout plan name",
  "description": "Brief description",
  "exercises": [
    {
      "name": "Exercise name (must match common exercise names)",
      "sets": 3,
      "reps_min": 8,
      "reps_max": 12,
      "weight_kg": null or number,
      "rest_seconds": 60
    }
  ]
}`;

    const userPrompt = `User Profile:
- Fitness Level: ${profile?.fitness_level || "intermediate"}
- Goals: ${profile?.goals?.join(", ") || "General fitness"}
- Age: ${profile?.age || "Not specified"}
- Weight: ${profile?.weight_kg || "Not specified"} kg
- Height: ${profile?.height_cm || "Not specified"} cm

Recent Workout History: ${recentWorkouts?.length || 0} recent sessions

User Request: ${prompt}
Duration: ${duration || 60} minutes
Focus Area: ${focusArea || "Full body"}

Generate a workout plan that matches the user's fitness level and goals. Use common exercise names that exist in a standard exercise database.`;

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

    return NextResponse.json(planData);
  } catch (error) {
    console.error("AI plan generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate workout plan" },
      { status: 500 }
    );
  }
}
