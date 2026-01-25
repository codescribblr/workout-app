"use client";

import { useRouter } from "next/navigation";

export default function StartWorkoutButton({ planId }: { planId: string }) {
  const router = useRouter();

  const handleStart = () => {
    router.push(`/workouts/new?plan=${planId}`);
  };

  return (
    <button
      onClick={handleStart}
      className="px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium"
    >
      Start Workout
    </button>
  );
}
