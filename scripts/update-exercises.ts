import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

// Use service role key for admin operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing required environment variables:");
  console.error("  NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL");
  console.error("  SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

if (!openaiApiKey) {
  console.error("Missing required environment variable:");
  console.error("  OPENAI_API_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const openai = new OpenAI({ apiKey: openaiApiKey });

interface Exercise {
  id: string;
  name: string;
  category: string | null;
  muscle_groups: string[] | null;
  equipment_needed: string[] | null;
  description: string | null;
  instructions: string[] | null;
  voice_explanation: string | null;
  text_explanation: string | null;
}

interface ExplanationResponse {
  voice_explanation: string;
  text_explanation: string;
}

/**
 * Generate both voice and text explanations for an exercise in a single API call
 */
async function generateExplanations(exercise: Exercise): Promise<ExplanationResponse | null> {
  const equipmentList = exercise.equipment_needed?.join(", ") || "bodyweight";
  const muscleGroups = exercise.muscle_groups?.join(", ") || "various muscles";
  const category = exercise.category || "exercise";
  const existingInstructions = exercise.instructions?.join(". ") || exercise.description || "";

  const systemPrompt = `You are a fitness coach creating exercise explanations. Generate two versions of an explanation for how to perform an exercise:

1. **voice_explanation**: Optimized for audio playback. The user will be LISTENING, not viewing a screen. Use clear, descriptive language that helps someone understand body positioning, movement patterns, and form cues without visual reference. Be conversational and detailed. Include specific cues like "keep your back straight", "lower until your thighs are parallel to the floor", etc. Aim for 100-200 words.

2. **text_explanation**: Optimized for screen display. Can include formatting-friendly language, can be slightly more concise, and can assume the user can reference the text while performing the exercise. Aim for 80-150 words.

Return ONLY a JSON object with this exact structure:
{
  "voice_explanation": "...",
  "text_explanation": "..."
}

Do not include any markdown formatting, code blocks, or additional text.`;

  const userPrompt = `Exercise: ${exercise.name}
Category: ${category}
Muscle Groups: ${muscleGroups}
Equipment Needed: ${equipmentList}
${existingInstructions ? `Existing Instructions: ${existingInstructions}` : ""}

Generate both explanations for this exercise. The voice explanation should be detailed enough for someone to perform the exercise correctly while listening to audio only. The text explanation can be more concise and formatted for reading.`;

  try {
    // Using GPT-3.5-turbo for cost efficiency. Change to "gpt-4" or "gpt-4-turbo" for higher quality.
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
      max_tokens: 800,
    });

    const responseText = completion.choices[0]?.message?.content?.trim();
    if (!responseText) {
      console.error(`  ✗ No response from OpenAI for ${exercise.name}`);
      return null;
    }

    // Parse the JSON response
    let parsed: ExplanationResponse;
    try {
      // Remove any markdown code blocks if present
      const cleaned = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      console.error(`  ✗ Failed to parse JSON response for ${exercise.name}:`, parseError);
      console.error(`  Response was: ${responseText.substring(0, 200)}...`);
      return null;
    }

    // Validate response structure
    if (!parsed.voice_explanation || !parsed.text_explanation) {
      console.error(`  ✗ Invalid response structure for ${exercise.name}`);
      console.error(`  Response:`, parsed);
      return null;
    }

    return parsed;
  } catch (error: any) {
    console.error(`  ✗ OpenAI API error for ${exercise.name}:`, error.message);
    return null;
  }
}

/**
 * Update exercise with generated explanations
 */
async function updateExercise(exerciseId: string, explanations: ExplanationResponse): Promise<boolean> {
  const { error } = await supabase
    .from("exercises")
    .update({
      voice_explanation: explanations.voice_explanation.trim(),
      text_explanation: explanations.text_explanation.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", exerciseId);

  if (error) {
    console.error(`  ✗ Database error updating ${exerciseId}:`, error.message);
    return false;
  }

  return true;
}

/**
 * Main function to update all exercises
 */
async function updateExercises(regenerate: boolean = false) {
  console.log("Fetching exercises from database...");
  console.log(`Connecting to: ${supabaseUrl}`);

  // Fetch exercises
  let query = supabase.from("exercises").select("*").order("name");
  
  if (!regenerate) {
    // Only fetch exercises missing explanations (either voice or text is null)
    query = query.or("voice_explanation.is.null,text_explanation.is.null");
  }

  const { data: exercises, error } = await query;

  if (error) {
    console.error("Error fetching exercises:", error.message);
    process.exit(1);
  }

  if (!exercises || exercises.length === 0) {
    console.log("No exercises found that need explanations.");
    if (!regenerate) {
      console.log("Use --regenerate flag to regenerate all explanations.");
    }
    return;
  }

  console.log(`\nFound ${exercises.length} exercise(s) to process.`);
  console.log("Generating explanations...\n");

  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  // Process exercises one at a time to avoid rate limits
  for (let i = 0; i < exercises.length; i++) {
    const exercise = exercises[i] as Exercise;
    const progress = `[${i + 1}/${exercises.length}]`;

    // Skip if explanations already exist and not regenerating
    if (!regenerate && exercise.voice_explanation && exercise.text_explanation) {
      console.log(`${progress} ⊘ Skipping ${exercise.name} (already has explanations)`);
      skippedCount++;
      continue;
    }

    console.log(`${progress} Processing: ${exercise.name}`);

    // Generate explanations
    const explanations = await generateExplanations(exercise);

    if (!explanations) {
      errorCount++;
      console.log(`  ✗ Failed to generate explanations for ${exercise.name}\n`);
      continue;
    }

    // Update database
    const updated = await updateExercise(exercise.id, explanations);

    if (updated) {
      successCount++;
      console.log(`  ✓ Successfully updated ${exercise.name}`);
      console.log(`    Voice: ${explanations.voice_explanation.length} chars`);
      console.log(`    Text: ${explanations.text_explanation.length} chars\n`);
    } else {
      errorCount++;
      console.log(`  ✗ Failed to update ${exercise.name} in database\n`);
    }

    // Add a small delay to avoid rate limits (OpenAI has rate limits)
    if (i < exercises.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500)); // 500ms delay between requests
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log("Update complete!");
  console.log(`  Success: ${successCount}`);
  console.log(`  Errors: ${errorCount}`);
  console.log(`  Skipped: ${skippedCount}`);
  console.log("=".repeat(50));
}

// Parse command line arguments
const args = process.argv.slice(2);
const regenerate = args.includes("--regenerate") || args.includes("-r");

if (regenerate) {
  console.log("⚠️  Regenerate mode: Will update ALL exercises, even if they already have explanations.\n");
}

// Run the script
updateExercises(regenerate).catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
