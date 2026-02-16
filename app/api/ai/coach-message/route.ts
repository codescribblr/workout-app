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

    const body = await request.json();
    const {
      sessionId,
      exerciseId,
      exerciseName,
      setNumberJustCompleted,
      totalSets,
      completedReps,
      completedWeightLbs,
      completedSetsSoFar,
      nextSetPlanDefault,
      muscle_groups,
      form_cue,
    } = body;

    if (!sessionId || !exerciseId || setNumberJustCompleted == null) {
      return NextResponse.json(
        { error: "sessionId, exerciseId, and setNumberJustCompleted required" },
        { status: 400 }
      );
    }

    // Reminder plays after set 2 (during rest before set 3), never after exercise is done. Skip if only 2 sets.
    const isBeforeThirdSet =
      setNumberJustCompleted === 2 && (totalSets ?? 0) >= 3;
    const muscles = Array.isArray(muscle_groups) && muscle_groups.length > 0
      ? muscle_groups.join(", ")
      : "";
    const hasFormCue = typeof form_cue === "string" && form_cue.trim().length > 0;

    const { data: session } = await supabase
      .from("workout_sessions")
      .select("id, user_id, coach_mode")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (!session?.coach_mode) {
      return NextResponse.json(
        { error: "Session not in coach mode" },
        { status: 400 }
      );
    }

    const nextSetNumber = setNumberJustCompleted + 1;
    const hasNextSet = nextSetNumber <= (totalSets ?? 999);

    const systemPrompt = `You are a supportive fitness coach during a live workout. The user just completed a set. Your job:
1. Give one short encouragement line. Keep it brief enough to be spoken in under 10 seconds.
${isBeforeThirdSet && (muscles || hasFormCue) ? `
SPECIAL (before set 3): The user just finished their 2nd set and is about to do set 3. In your encouragement, include:
- A quick reminder of the muscle(s) being targeted (e.g. "Remember, you're really working the biceps here").
- One brief form or technique cue for the upcoming set 3 (e.g. "focus on squeezing at the top of each curl" or "drive through the heels and squeeze the glutes at the top"). Use the exercise explanation below if provided to pull a concise, spoken-friendly cue. Keep the whole encouragement to 1–2 sentences so it stays under ~10 seconds when spoken.
` : "If they hit the target, acknowledge it. If they went lighter or fewer reps, encourage without criticism. Be natural and brief (e.g. \"Nice work.\" \"Strong set.\" \"Keep it up.\")."}
2. If there is a next set (set ${nextSetNumber}), suggest a concrete target for that set: reps and/or weight_lbs. Consider what they just did (reps, weight) and the plan default for the next set. Return as next_set_target: { "reps": number, "weight_lbs": number | null } or omit if no change from plan.

Output ONLY valid JSON:
{ "encouragement": "One short sentence (or two for set-3 reminder).", "next_set_target": { "reps": 10, "weight_lbs": 20 } or null }
If no next set, set next_set_target to null.`;

    const userPrompt = `Exercise: ${exerciseName || "Unknown"}
${muscles ? `Muscles targeted: ${muscles}\n` : ""}${hasFormCue ? `Exercise form/explanation (use to craft a brief spoken cue for set 3): ${form_cue.trim().slice(0, 500)}\n` : ""}
Set ${setNumberJustCompleted} just completed: ${completedReps ?? "?"} reps${completedWeightLbs != null ? ` at ${completedWeightLbs} lbs` : ""}
All sets so far this exercise: ${JSON.stringify(completedSetsSoFar || [])}
Plan default for next set (set ${nextSetNumber}): ${JSON.stringify(nextSetPlanDefault || {})}
${!hasNextSet ? "There is no next set for this exercise." : ""}

Return JSON only.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.6,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "No response from coach" },
        { status: 500 }
      );
    }

    let parsed: {
      encouragement?: string;
      next_set_target?: { reps?: number; weight_lbs?: number | null } | null;
    };
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: "Invalid coach response format" },
        { status: 500 }
      );
    }

    const encouragement =
      typeof parsed.encouragement === "string"
        ? parsed.encouragement.trim()
        : undefined;
    const next_set_target =
      hasNextSet && parsed.next_set_target && typeof parsed.next_set_target === "object"
        ? parsed.next_set_target
        : null;

    if (next_set_target && nextSetNumber >= 1) {
      const { data: sessionRow } = await supabase
        .from("workout_sessions")
        .select("set_targets")
        .eq("id", sessionId)
        .single();

      const currentTargets = (sessionRow?.set_targets as Record<string, Record<string, unknown>>) || {};
      const exerciseTargets = { ...(currentTargets[exerciseId] || {}) };
      exerciseTargets[String(nextSetNumber)] = next_set_target;
      const newSetTargets = { ...currentTargets, [exerciseId]: exerciseTargets };

      await supabase
        .from("workout_sessions")
        .update({ set_targets: newSetTargets })
        .eq("id", sessionId)
        .eq("user_id", user.id);
    }

    return NextResponse.json({
      encouragement: encouragement || null,
      next_set_target: next_set_target || null,
    });
  } catch (error) {
    console.error("Coach message error:", error);
    return NextResponse.json(
      { error: "Coach message failed" },
      { status: 500 }
    );
  }
}
