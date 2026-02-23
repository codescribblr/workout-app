"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BackLink } from "@/components/navigation/BackLink";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";

interface WorkoutSession {
  id: string;
  started_at: string;
  completed_at: string | null;
  workout_plans: {
    name: string;
  } | null;
}

export default function HistoryPage() {
  const router = useRouter();
  const supabase = createClient();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("workout_sessions")
        .select(
          `
          *,
          workout_plans (
            name
          )
        `
        )
        .eq("user_id", user.id)
        .order("started_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error loading sessions:", error);
      } else {
        setSessions(data || []);
      }
    } catch (error) {
      console.error("Error loading sessions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (sessionId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDeleteId(sessionId);
  };

  const handleConfirmDelete = async (sessionId: string) => {
    setDeletingId(sessionId);
    setConfirmDeleteId(null);

    try {
      const response = await fetch(`/api/history/${sessionId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete workout session");
      }

      // Remove from list without reloading page
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (error: any) {
      console.error("Error deleting session:", error);
      alert(`Failed to delete workout session: ${error.message || "Unknown error"}. Please try again.`);
      // Reload sessions to get accurate state
      await loadSessions();
    } finally {
      setDeletingId(null);
    }
  };

  const handleCancelDelete = () => {
    setConfirmDeleteId(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl mb-4 text-gray-700 dark:text-gray-300">Loading workout history...</p>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 dark:border-indigo-400 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <nav className="bg-white dark:bg-gray-800 shadow">
        <div className="mx-auto px-4 sm:px-6 max-w-7xl">
          <div className="flex justify-between h-14 sm:h-16 items-center">
            <div className="flex items-center">
              <BackLink href="/dashboard" />
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto px-4 py-5 sm:py-6 sm:px-6 max-w-7xl">
        <div className="sm:px-0">
          <div className="mb-5 sm:mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              Workout History
            </h1>
          </div>
          {sessions && sessions.length > 0 ? (
            <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {sessions.map((session) => (
                  <li key={session.id} className="relative">
                    <Link
                      href={`/history/${session.id}`}
                      className="block hover:bg-gray-50 dark:hover:bg-gray-700 px-4 py-4 sm:px-6"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center flex-1 min-w-0">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 truncate">
                              {session.workout_plans?.name || "Custom Workout"}
                            </p>
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              {format(
                                new Date(session.started_at),
                                "MMM d, yyyy 'at' h:mm a"
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="ml-4 flex items-center space-x-3 flex-shrink-0">
                          {session.completed_at ? (
                            <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">
                              Completed
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded">
                              In Progress
                            </span>
                          )}
                          <button
                            onClick={(e) => handleDeleteClick(session.id, e)}
                            disabled={deletingId === session.id}
                            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed p-1"
                            title="Delete workout"
                          >
                            {deletingId === session.id ? (
                              <svg
                                className="animate-spin h-5 w-5"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                ></circle>
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                ></path>
                              </svg>
                            ) : (
                              <svg
                                className="h-5 w-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-700 dark:text-gray-300">No workout history yet.</p>
            </div>
          )}
        </div>
      </main>

      {/* Delete Confirmation Dialog */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4 shadow-xl">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Delete Workout?
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              Are you sure you want to delete this workout session? This action
              cannot be undone and will also delete all recorded sets for this
              workout.
            </p>
            <div className="flex justify-end space-x-4">
              <Button
                onClick={handleCancelDelete}
                variant="outline"
                disabled={deletingId === confirmDeleteId}
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleConfirmDelete(confirmDeleteId)}
                variant="danger"
                disabled={deletingId === confirmDeleteId}
                isLoading={deletingId === confirmDeleteId}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
