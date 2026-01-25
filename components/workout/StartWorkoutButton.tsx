"use client";

import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";

export default function StartWorkoutButton({ planId }: { planId: string }) {
  const router = useRouter();

  const handleStart = () => {
    router.push(`/workouts/new?plan=${planId}`);
  };

  return (
    <Button onClick={handleStart} variant="primary" size="lg">
      Start Workout
    </Button>
  );
}
