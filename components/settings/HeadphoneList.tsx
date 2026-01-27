"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import HeadphoneSetup from "./HeadphoneSetup";

interface Headphone {
  id: string;
  name: string;
  is_default: boolean;
  button_mappings: {
    button_1: { type: string; mediaAction: string } | null;
    button_2: { type: string; mediaAction: string } | null;
    button_3: { type: string; mediaAction: string } | null;
  };
}

interface HeadphoneListProps {
  userId: string;
  audioCuesEnabled?: boolean;
}

export default function HeadphoneList({ userId, audioCuesEnabled = true }: HeadphoneListProps) {
  const [headphones, setHeadphones] = useState<Headphone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    loadHeadphones();
  }, [userId]);

  const loadHeadphones = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("user_headphones")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading headphones:", error);
    } else {
      setHeadphones(data || []);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this headphone configuration?")) {
      return;
    }

    setDeletingId(id);
    const { error } = await supabase
      .from("user_headphones")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting headphones:", error);
      alert("Failed to delete headphones. Please try again.");
    } else {
      await loadHeadphones();
    }
    setDeletingId(null);
  };

  const handleSetDefault = async (id: string) => {
    // Set all headphones to not default first
    const { error: updateError } = await supabase
      .from("user_headphones")
      .update({ is_default: false })
      .eq("user_id", userId);

    if (updateError) {
      console.error("Error updating defaults:", updateError);
      return;
    }

    // Set the selected one as default
    const { error } = await supabase
      .from("user_headphones")
      .update({ is_default: true })
      .eq("id", id);

    if (error) {
      console.error("Error setting default:", error);
      alert("Failed to set default headphones. Please try again.");
    } else {
      await loadHeadphones();
    }
  };

  const getButtonMappingLabel = (
    mapping: { type: string; mediaAction: string } | null
  ) => {
    if (!mapping) return "Not mapped";
    if (mapping.type === "single_press") return "Single Press";
    if (mapping.type === "double_press") return "Double Press";
    if (mapping.type === "long_press") return "Long Press";
    if (mapping.type === "volume_up") return "Volume Up";
    if (mapping.type === "volume_down") return "Volume Down";
    return mapping.type;
  };

  if (showSetup) {
    return (
      <HeadphoneSetup
        onComplete={() => {
          setShowSetup(false);
          loadHeadphones();
        }}
        onCancel={() => setShowSetup(false)}
      />
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Headphones
        </h2>
        <Button onClick={() => setShowSetup(true)} disabled={!audioCuesEnabled}>
          Add Headphones
        </Button>
      </div>
      
      {!audioCuesEnabled && (
        <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            Headphone controls are disabled because audio cues are turned off. Enable audio cues in Voice Settings to use headphones.
          </p>
        </div>
      )}

      {loading ? (
        <p className="text-gray-600 dark:text-gray-400">Loading...</p>
      ) : headphones.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            No headphones configured yet.
          </p>
          <Button onClick={() => setShowSetup(true)} disabled={!audioCuesEnabled}>
            Add Your First Headphones
          </Button>
        </div>
      ) : (
        <div className={`space-y-4 ${!audioCuesEnabled ? "opacity-50 pointer-events-none" : ""}`}>
          {headphones.map((headphone) => (
            <div
              key={headphone.id}
              className="border border-gray-300 dark:border-gray-600 rounded-lg p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      {headphone.name}
                    </h3>
                    {headphone.is_default && (
                      <span className="text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 px-2 py-1 rounded">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                    <div>
                      <span className="font-medium">Button 1:</span>{" "}
                      {getButtonMappingLabel(headphone.button_mappings.button_1)}
                    </div>
                    <div>
                      <span className="font-medium">Button 2:</span>{" "}
                      {getButtonMappingLabel(headphone.button_mappings.button_2)}
                    </div>
                    <div>
                      <span className="font-medium">Button 3:</span>{" "}
                      {getButtonMappingLabel(headphone.button_mappings.button_3)}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  {!headphone.is_default && (
                    <Button
                      onClick={() => handleSetDefault(headphone.id)}
                      variant="secondary"
                      size="sm"
                      disabled={!audioCuesEnabled}
                    >
                      Set Default
                    </Button>
                  )}
                  <Button
                    onClick={() => handleDelete(headphone.id)}
                    variant="danger"
                    size="sm"
                    disabled={deletingId === headphone.id || !audioCuesEnabled}
                    isLoading={deletingId === headphone.id}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
