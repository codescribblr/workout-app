"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";

interface PostWorkoutFeedbackProps {
  sessionId: string;
  planName: string;
  exerciseIds: string[]; // List of exercise IDs from the workout
  onComplete: () => void;
  onSkip: () => void;
}

interface Exercise {
  id: string;
  name: string;
}

export default function PostWorkoutFeedback({
  sessionId,
  planName,
  exerciseIds,
  onComplete,
  onSkip,
}: PostWorkoutFeedbackProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loadingExercises, setLoadingExercises] = useState(true);

  // Form state
  const [overallSentiment, setOverallSentiment] = useState<number | null>(null);
  const [effortLevel, setEffortLevel] = useState<string | null>(null);
  const [problematicExerciseIds, setProblematicExerciseIds] = useState<string[]>([]);
  const [hasInjuryConcern, setHasInjuryConcern] = useState(false);
  const [affectedMuscleGroups, setAffectedMuscleGroups] = useState<string[]>([]);
  const [injuryDescription, setInjuryDescription] = useState("");
  const [rawFeedback, setRawFeedback] = useState("");
  const [sentimentBreakdown, setSentimentBreakdown] = useState({
    energy: 5,
    satisfaction: 5,
    motivation: 5,
  });

  // Common muscle groups for injury selection
  const muscleGroups = [
    "neck",
    "shoulder",
    "upper_back",
    "lower_back",
    "chest",
    "bicep",
    "tricep",
    "forearm",
    "wrist",
    "core",
    "hip",
    "quadricep",
    "hamstring",
    "calf",
    "ankle",
    "knee",
  ];

  // Load exercises
  useEffect(() => {
    const loadExercises = async () => {
      if (exerciseIds.length === 0) {
        setLoadingExercises(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("exercises")
          .select("id, name")
          .in("id", exerciseIds);

        if (error) {
          console.error("Error loading exercises:", error);
        } else {
          setExercises(data || []);
        }
      } catch (error) {
        console.error("Error loading exercises:", error);
      } finally {
        setLoadingExercises(false);
      }
    };

    loadExercises();
  }, [exerciseIds, supabase]);

  const handleMuscleGroupToggle = (muscle: string) => {
    setAffectedMuscleGroups((prev) =>
      prev.includes(muscle)
        ? prev.filter((m) => m !== muscle)
        : [...prev, muscle]
    );
  };

  const handleSubmit = async () => {
    if (!overallSentiment || !effortLevel) {
      alert("Please answer all required questions.");
      return;
    }

    setLoading(true);

    try {
      // Get user ID
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("User not authenticated");
      }

      // Prepare parsed data structure
      const parsedData = {
        overall_sentiment: overallSentiment,
        effort_level: effortLevel,
        problematic_exercise_ids: problematicExerciseIds,
        has_injury_concern: hasInjuryConcern,
        affected_muscle_groups: affectedMuscleGroups,
        injury_description: hasInjuryConcern ? injuryDescription : null,
        sentiment_breakdown: sentimentBreakdown,
        exercise_feedback: problematicExerciseIds.map((exerciseId) => ({
          exercise_id: exerciseId,
          exercise_name:
            exercises.find((e) => e.id === exerciseId)?.name || "Unknown",
        })),
        submitted_at: new Date().toISOString(),
      };

      // Insert feedback into database
      const { error } = await supabase.from("workout_feedback").insert({
        workout_session_id: sessionId,
        user_id: user.id,
        raw_feedback: rawFeedback.trim() || null,
        parsed_data: parsedData,
        overall_sentiment: overallSentiment,
        effort_level: effortLevel,
        problematic_exercise_ids:
          problematicExerciseIds.length > 0 ? problematicExerciseIds : null,
        has_injury_concern: hasInjuryConcern,
        affected_muscle_groups:
          affectedMuscleGroups.length > 0 ? affectedMuscleGroups : null,
        injury_description: hasInjuryConcern ? injuryDescription.trim() : null,
      });

      if (error) {
        throw error;
      }

      onComplete();
    } catch (error: any) {
      console.error("Error submitting feedback:", error);
      alert(
        `Failed to submit feedback: ${error.message || "Unknown error"}. Please try again.`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        onSkip();
        return;
      }

      // Record that feedback was skipped
      await supabase.from("workout_feedback").insert({
        workout_session_id: sessionId,
        user_id: user.id,
        parsed_data: { skipped: true, skipped_at: new Date().toISOString() },
      });
    } catch (error) {
      console.error("Error recording skip:", error);
    }

    onSkip();
  };

  if (loadingExercises) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center">
          <p className="text-xl mb-4 text-gray-900 dark:text-white">
            Loading feedback form...
          </p>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2">How did your workout go?</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Your feedback helps us improve your next workout
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
            {planName}
          </p>
        </div>

        <div className="space-y-8">
          {/* Overall Sentiment */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
            <label className="block text-lg font-semibold mb-4">
              Overall, how did you feel after this workout? *
            </label>
            <div className="flex items-center justify-between gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                <button
                  key={value}
                  onClick={() => setOverallSentiment(value)}
                  className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${
                    overallSentiment === value
                      ? "bg-indigo-600 text-white"
                      : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-indigo-100 dark:hover:bg-indigo-900"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-500">
              <span>Terrible</span>
              <span>Excellent</span>
            </div>
          </div>

          {/* Effort Level */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
            <label className="block text-lg font-semibold mb-4">
              How was the difficulty level? *
            </label>
            <div className="space-y-3">
              {[
                { value: "too_easy", label: "Too Easy", icon: "😴" },
                { value: "just_right", label: "Just Right", icon: "👍" },
                { value: "too_hard", label: "Too Hard", icon: "😓" },
                { value: "varied", label: "Varied (some easy, some hard)", icon: "📊" },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setEffortLevel(option.value)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                    effortLevel === option.value
                      ? "bg-indigo-600 text-white"
                      : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-indigo-100 dark:hover:bg-indigo-900"
                  }`}
                >
                  <span className="text-xl mr-3">{option.icon}</span>
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Problematic Exercises */}
          {exercises.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
              <label className="block text-lg font-semibold mb-4">
                Were there any exercises that caused problems or felt off?
              </label>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Select all that apply
              </p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {exercises.map((exercise) => (
                  <label
                    key={exercise.id}
                    className="flex items-center p-3 bg-white dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={problematicExerciseIds.includes(exercise.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setProblematicExerciseIds([
                            ...problematicExerciseIds,
                            exercise.id,
                          ]);
                        } else {
                          setProblematicExerciseIds(
                            problematicExerciseIds.filter(
                              (id) => id !== exercise.id
                            )
                          );
                        }
                      }}
                      className="mr-3 w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                    <span className="text-gray-700 dark:text-gray-300">
                      {exercise.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Injury Concerns */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
            <label className="flex items-center mb-4">
              <input
                type="checkbox"
                checked={hasInjuryConcern}
                onChange={(e) => setHasInjuryConcern(e.target.checked)}
                className="mr-3 w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
              />
              <span className="text-lg font-semibold">
                Did you experience any pain or injury concerns during this workout?
              </span>
            </label>

            {hasInjuryConcern && (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Which muscle groups were affected?
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {muscleGroups.map((muscle) => (
                      <button
                        key={muscle}
                        onClick={() => handleMuscleGroupToggle(muscle)}
                        className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                          affectedMuscleGroups.includes(muscle)
                            ? "bg-red-600 text-white"
                            : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-red-100 dark:hover:bg-red-900"
                        }`}
                      >
                        {muscle.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Describe the issue (optional)
                  </label>
                  <textarea
                    value={injuryDescription}
                    onChange={(e) => setInjuryDescription(e.target.value)}
                    placeholder="e.g., Sharp pain in right shoulder during bench press..."
                    className="w-full px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg border border-gray-300 dark:border-gray-600 focus:border-red-500 focus:ring-red-500"
                    rows={3}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Additional Feedback */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
            <label className="block text-lg font-semibold mb-4">
              Anything else you&apos;d like to share? (optional)
            </label>
            <textarea
              value={rawFeedback}
              onChange={(e) => setRawFeedback(e.target.value)}
              placeholder="Tell us about your workout experience, what worked well, what didn't, or any suggestions..."
              className="w-full px-4 py-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg border border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:ring-indigo-500"
              rows={4}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              onClick={handleSubmit}
              variant="primary"
              size="lg"
              className="flex-1"
              disabled={loading || !overallSentiment || !effortLevel}
              isLoading={loading}
            >
              Submit Feedback
            </Button>
            <Button
              onClick={handleSkip}
              variant="outline"
              size="lg"
              className="flex-1"
              disabled={loading}
            >
              Skip
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
