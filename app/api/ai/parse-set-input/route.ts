import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { transcript, hasWeight } = await request.json();

    if (!transcript || typeof transcript !== "string") {
      return NextResponse.json(
        { error: "Transcript is required" },
        { status: 400 }
      );
    }

    // Use AI to parse the speech input
    const systemPrompt = `You are a workout tracking assistant. Parse the user's speech input about their workout set.

The user is providing information about:
- Number of reps completed
${hasWeight ? "- Weight used (in pounds)" : "- This is a bodyweight exercise, so there is NO weight"}

IMPORTANT CONTEXT:
${!hasWeight ? "- This is a BODYWEIGHT exercise - the user was ONLY asked about reps, NOT weight" : ""}
${!hasWeight ? `- If the user provides a single number (like "25"), it MUST be reps, NOT weight` : ""}
${!hasWeight ? "- Weight should ALWAYS be null for bodyweight exercises" : ""}

Extract this information from their natural language input. Return ONLY a JSON object with this exact structure:
{
  "reps": <number or null>,
  "weight": <number or null>
}

Examples${!hasWeight ? " (bodyweight exercise - no weight)" : ""}:
- "10 reps" → {"reps": 10, "weight": null}
- "I did 12 reps${hasWeight ? " with 25 pounds" : ""}" → {"reps": 12, ${hasWeight ? '"weight": 25' : '"weight": null'}}
- "ten reps" → {"reps": 10, "weight": null}
${hasWeight ? '- "12 at 30" → {"reps": 12, "weight": 30}' : '- "25" (single number, bodyweight) → {"reps": 25, "weight": null}'}
${hasWeight ? '- "fifteen reps with 20 pounds" → {"reps": 15, "weight": 20}' : '- "just 8" (single number, bodyweight) → {"reps": 8, "weight": null}'}
- "just 8 reps" → {"reps": 8, "weight": null}
${!hasWeight ? '- "25" → {"reps": 25, "weight": null} (single number = reps for bodyweight)' : ""}

CRITICAL RULES:
${!hasWeight ? "- For bodyweight exercises: ANY single number provided MUST be interpreted as reps" : ""}
${!hasWeight ? "- For bodyweight exercises: weight MUST always be null" : ""}
- If you cannot determine the reps, return null for reps
- If weight is mentioned but not clear, return null for weight
${!hasWeight ? "- Never interpret a number as weight for bodyweight exercises" : ""}
Return ONLY the JSON object, no other text.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: transcript },
      ],
      temperature: 0.3,
      max_tokens: 100,
    });

    const responseText = completion.choices[0]?.message?.content?.trim();
    if (!responseText) {
      return NextResponse.json(
        { error: "No response from AI" },
        { status: 500 }
      );
    }

    // Parse the JSON response
    let parsed;
    try {
      // Remove any markdown code blocks if present
      const cleaned = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
      console.error("Response text:", responseText);
      return NextResponse.json(
        { error: "Failed to parse AI response", raw: responseText },
        { status: 500 }
      );
    }

    return NextResponse.json({
      reps: parsed.reps ?? null,
      weight: parsed.weight ?? null,
    });
  } catch (error: any) {
    console.error("Error parsing set input:", error);
    return NextResponse.json(
      { error: error.message || "Failed to parse input" },
      { status: 500 }
    );
  }
}
