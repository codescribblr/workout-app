"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function AIGeneratePlanPage() {
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(60);
  const [focusArea, setFocusArea] = useState("full body");
  const [generating, setGenerating] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<any>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      alert("Please enter a description for your workout plan");
      return;
    }

    setGenerating(true);

    try {
      const response = await fetch("/api/ai/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, duration, focusArea }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate plan");
      }

      const plan = await response.json();
      setGeneratedPlan(plan);
    } catch (error) {
      console.error("Error generating plan:", error);
      alert("Failed to generate workout plan. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!generatedPlan) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    // Get exercise IDs by name
    const exerciseNames = generatedPlan.exercises.map((e: any) => e.name);
    const { data: exercises } = await supabase
      .from("exercises")
      .select("id, name")
      .in("name", exerciseNames);

    const exerciseMap = new Map(exercises?.map((e) => [e.name, e.id]) || []);

    // Create workout plan
    const { data: plan, error: planError } = await supabase
      .from("workout_plans")
      .insert({
        name: generatedPlan.name,
        description: generatedPlan.description,
        user_id: user.id,
        is_ai_generated: true,
        ai_prompt: prompt,
      })
      .select()
      .single();

    if (planError || !plan) {
      console.error("Error creating plan:", planError);
      return;
    }

    // Add exercises
    const planExercises = generatedPlan.exercises
      .map((e: any, idx: number) => {
        const exerciseId = exerciseMap.get(e.name);
        if (!exerciseId) return null;
        return {
          workout_plan_id: plan.id,
          exercise_id: exerciseId,
          order_index: idx,
          sets: e.sets,
          reps_min: e.reps_min,
          reps_max: e.reps_max,
          weight_kg: e.weight_kg,
          rest_seconds: e.rest_seconds,
        };
      })
      .filter((e: any) => e !== null);

    if (planExercises.length > 0) {
      await supabase.from("workout_plan_exercises").insert(planExercises);
    }

    router.push(`/plans/${plan.id}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/plans" className="text-gray-700 hover:text-gray-900">
                ← Back
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            AI Workout Plan Generator
          </h1>

          {!generatedPlan ? (
            <div className="bg-white shadow rounded-lg p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Describe your workout goals
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2 border text-gray-900 placeholder-gray-400"
                  rows={4}
                  placeholder="e.g., Upper body strength workout focusing on chest and shoulders, 45 minutes, intermediate level"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value))}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2 border text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Focus Area
                  </label>
                  <select
                    value={focusArea}
                    onChange={(e) => setFocusArea(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2 border text-gray-900"
                  >
                    <option value="full body">Full Body</option>
                    <option value="upper body">Upper Body</option>
                    <option value="lower body">Lower Body</option>
                    <option value="chest">Chest</option>
                    <option value="back">Back</option>
                    <option value="legs">Legs</option>
                    <option value="shoulders">Shoulders</option>
                    <option value="arms">Arms</option>
                    <option value="cardio">Cardio</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={generating}
                className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {generating ? "Generating..." : "Generate Workout Plan"}
              </button>
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg p-6 space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{generatedPlan.name}</h2>
                <p className="text-gray-700">{generatedPlan.description}</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Exercises</h3>
                <div className="space-y-3">
                  {generatedPlan.exercises.map((ex: any, idx: number) => (
                    <div key={idx} className="border rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900">{ex.name}</h4>
                      <div className="mt-2 text-sm text-gray-700">
                        {ex.sets} sets × {ex.reps_min}
                        {ex.reps_max !== ex.reps_min ? `-${ex.reps_max}` : ""}{" "}
                        reps
                        {ex.weight_kg && ` @ ${ex.weight_kg} kg`}
                        {` • Rest: ${ex.rest_seconds}s`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => setGeneratedPlan(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Generate Another
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Save Plan
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
