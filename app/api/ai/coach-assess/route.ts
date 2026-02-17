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

    const { sessionId } = await request.json();
    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    const { data: session, error: sessionError } = await supabase
      .from("workout_sessions")
      .select("id, workout_plan_id, user_id, coach_mode")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (!session.coach_mode) {
      return NextResponse.json(
        { error: "Session is not in coach mode" },
        { status: 400 }
      );
    }

    const planId = session.workout_plan_id;
    if (!planId) {
      return NextResponse.json(
        { error: "Session has no plan" },
        { status: 400 }
      );
    }

    const { data: plan } = await supabase
      .from("workout_plans")
      .select("id, name")
      .eq("id", planId)
      .single();

    const { data: planExercises } = await supabase
      .from("workout_plan_exercises")
      .select(
        `
        id,
        exercise_id,
        order_index,
        sets,
        sets_max,
        reps_min,
        reps_max,
        weight_lbs,
        rest_seconds,
        notes,
        is_warmup,
        is_cooldown,
        exercises ( id, name )
      `
      )
      .eq("workout_plan_id", planId)
      .order("order_index");

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("fitness_level, goals, preferences")
      .eq("id", user.id)
      .single();

    const { data: lastWorkoutSession } = await supabase
      .from("workout_sessions")
      .select("id, started_at, completed_at, notes, ai_summary")
      .eq("user_id", user.id)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let lastWorkoutFeedback: any = null;
    let lastWorkoutSets: any[] = [];
    if (lastWorkoutSession?.id) {
      const { data: fb } = await supabase
        .from("workout_feedback")
        .select("*")
        .eq("workout_session_id", lastWorkoutSession.id)
        .maybeSingle();
      lastWorkoutFeedback = fb;
      const { data: sets } = await supabase
        .from("workout_sets")
        .select("exercise_id, set_number, reps, weight_lbs")
        .eq("workout_session_id", lastWorkoutSession.id)
        .order("exercise_id")
        .order("set_number");
      lastWorkoutSets = sets || [];
    }

    const { data: lastSamePlanSession } = await supabase
      .from("workout_sessions")
      .select("id, started_at, completed_at, notes, ai_summary")
      .eq("user_id", user.id)
      .eq("workout_plan_id", planId)
      .neq("id", sessionId)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let lastSamePlanFeedback: any = null;
    let lastSamePlanSets: any[] = [];
    if (lastSamePlanSession?.id) {
      const { data: fb } = await supabase
        .from("workout_feedback")
        .select("*")
        .eq("workout_session_id", lastSamePlanSession.id)
        .maybeSingle();
      lastSamePlanFeedback = fb;
      const { data: sets } = await supabase
        .from("workout_sets")
        .select("exercise_id, set_number, reps, weight_lbs")
        .eq("workout_session_id", lastSamePlanSession.id)
        .order("exercise_id")
        .order("set_number");
      lastSamePlanSets = sets || [];
    }

    const exerciseList = (planExercises || [])
      .filter((pe: any) => pe.exercises)
      .map((pe: any) => ({
        exercise_id: pe.exercise_id,
        name: (pe.exercises as any).name,
        sets: pe.sets_max && pe.sets_max > pe.sets ? pe.sets_max : pe.sets,
        reps_min: pe.reps_min,
        reps_max: pe.reps_max,
        weight_lbs: (pe as any).weight_lbs,
        is_warmup: (pe as any).is_warmup || false,
        is_cooldown: (pe as any).is_cooldown || false,
      }));

    const systemPrompt = `You are a supportive fitness coach. Your job is to personalize today's workout by:
1. Reviewing the user's last workout (any plan) and last workout on THIS same plan.
2. Considering post-workout feedback (effort_level: too_easy, just_right, too_hard, varied; overall_sentiment 1-10; problematic_exercise_ids; injury concerns).
3. Producing set_targets: per-exercise, per-set recommended reps and weight_lbs for THIS session only. Use exact numbers when you want to push progression or dial back (e.g. "10 reps at 22 lbs" for set 2). You can leave a set as the plan default by omitting it.
4. Writing a short welcome_message (1-2 sentences) to say at the start of the workout. Match the coach tone: ${(function () {
      const p = (profile?.preferences as any)?.audio?.coach_personality || "encouraging";
      const tones: Record<string, string> = {
        gentle: "Warm, calm, no pressure.",
        encouraging: "Positive, upbeat, motivating.",
        hardcore: "Direct, intense, push them.",
        military: "Terse, commanding, no filler.",
      };
      return tones[p] || tones.encouraging;
    })()}. Reference their progress or today's focus. Keep it brief for voice (under 15 seconds when spoken).

Output ONLY valid JSON with this exact shape (no markdown, no code block):
{
  "set_targets": {
    "<exercise_id_uuid>": {
      "1": { "reps": 10, "weight_lbs": 20 },
      "2": { "reps": 10, "weight_lbs": 22 }
    }
  },
  "welcome_message": "One or two short sentences."
}

Rules:
- set_targets keys are exercise_id (UUID) and set number as string "1", "2", etc.
- Only include exercises that need a change from the plan default. Omit warm-up/cooldown unless you have a specific duration change.
- If feedback said too_easy, consider increasing weight or reps for some sets. If too_hard, reduce.
- Use last same-plan sets to suggest progressive overload (e.g. last time set 1 was 10@20, suggest 10@22 or 11@20).
- welcome_message must be concise and spoken aloud; no bullet points.`;

    const userPrompt = `Plan: ${plan?.name || "Unnamed"}
Exercises in order (exercise_id, name, sets, reps_min, reps_max, weight_lbs, is_warmup, is_cooldown):
${JSON.stringify(exerciseList)}

Last workout (any plan): ${lastWorkoutSession ? `completed ${lastWorkoutSession.completed_at}, notes: ${lastWorkoutSession.notes || "none"}, ai_summary: ${lastWorkoutSession.ai_summary || "none"}` : "No previous workout"}
Last workout feedback: ${lastWorkoutFeedback ? JSON.stringify({ overall_sentiment: lastWorkoutFeedback.overall_sentiment, effort_level: lastWorkoutFeedback.effort_level, raw_feedback: lastWorkoutFeedback.raw_feedback, problematic_exercise_ids: lastWorkoutFeedback.problematic_exercise_ids }) : "None"}
Last workout sets (exercise_id, set_number, reps, weight_lbs): ${JSON.stringify(lastWorkoutSets)}

Last workout on THIS plan: ${lastSamePlanSession ? `completed ${lastSamePlanSession.completed_at}` : "None"}
Last same-plan feedback: ${lastSamePlanFeedback ? JSON.stringify({ effort_level: lastSamePlanFeedback.effort_level, raw_feedback: lastSamePlanFeedback.raw_feedback }) : "None"}
Last same-plan sets: ${JSON.stringify(lastSamePlanSets)}

User profile (fitness_level, goals): ${JSON.stringify(profile?.fitness_level || null)}, ${JSON.stringify(profile?.goals || null)}

Return the JSON object only.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.5,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "No response from coach" },
        { status: 500 }
      );
    }

    let parsed: { set_targets?: Record<string, Record<string, { reps?: number; reps_min?: number; reps_max?: number; weight_lbs?: number | null }>>; welcome_message?: string };
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: "Invalid coach response format" },
        { status: 500 }
      );
    }

    const set_targets = parsed.set_targets || {};
    const welcome_message = typeof parsed.welcome_message === "string" ? parsed.welcome_message.trim() : undefined;

    const { error: updateError } = await supabase
      .from("workout_sessions")
      .update({ set_targets })
      .eq("id", sessionId)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Coach assess: failed to update session set_targets", updateError);
      return NextResponse.json(
        { error: "Failed to save coach recommendations" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      set_targets,
      welcome_message: welcome_message || null,
    });
  } catch (error) {
    console.error("Coach assess error:", error);
    return NextResponse.json(
      { error: "Coach assessment failed" },
      { status: 500 }
    );
  }
}
