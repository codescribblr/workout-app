"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";

interface DeletePlanButtonProps {
  planId: string;
  planName: string;
}

export default function DeletePlanButton({ planId, planName }: DeletePlanButtonProps) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);

    try {
      const response = await fetch(`/api/plans/${planId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || "Failed to delete workout plan");
        setDeleting(false);
        return;
      }

      // Successfully deleted, redirect to plans page
      router.push("/plans");
      router.refresh();
    } catch (error) {
      console.error("Error deleting plan:", error);
      alert("An error occurred while deleting the plan");
      setDeleting(false);
    }
  };

  if (showConfirm) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Are you sure you want to delete &quot;{planName}&quot;? This action cannot be undone.
        </p>
        <div className="flex gap-2">
          <Button
            onClick={handleDelete}
            variant="danger"
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Yes, Delete"}
          </Button>
          <Button
            onClick={() => setShowConfirm(false)}
            variant="outline"
            disabled={deleting}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button
      onClick={() => setShowConfirm(true)}
      variant="danger"
    >
      Delete Plan
    </Button>
  );
}
