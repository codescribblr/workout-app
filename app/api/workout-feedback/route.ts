import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      workout_session_id,
      raw_feedback,
      overall_sentiment,
      effort_level,
      problematic_exercise_ids,
      has_injury_concern,
      affected_muscle_groups,
      injury_description,
      parsed_data,
    } = body;

    if (!workout_session_id) {
      return NextResponse.json(
        { error: "workout_session_id is required" },
        { status: 400 }
      );
    }

    // Verify the session belongs to the user
    const { data: session, error: sessionError } = await supabase
      .from("workout_sessions")
      .select("id, user_id")
      .eq("id", workout_session_id)
      .eq("user_id", user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: "Workout session not found" },
        { status: 404 }
      );
    }

    // Insert feedback
    const { data, error } = await supabase
      .from("workout_feedback")
      .insert({
        workout_session_id,
        user_id: user.id,
        raw_feedback: raw_feedback || null,
        parsed_data: parsed_data || {},
        overall_sentiment: overall_sentiment || null,
        effort_level: effort_level || null,
        problematic_exercise_ids:
          problematic_exercise_ids && problematic_exercise_ids.length > 0
            ? problematic_exercise_ids
            : null,
        has_injury_concern: has_injury_concern || false,
        affected_muscle_groups:
          affected_muscle_groups && affected_muscle_groups.length > 0
            ? affected_muscle_groups
            : null,
        injury_description: injury_description || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error inserting feedback:", error);
      return NextResponse.json(
        { error: "Failed to save feedback" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Error in workout feedback API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
