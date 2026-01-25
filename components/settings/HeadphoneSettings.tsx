"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface Profile {
  id: string;
  preferences?: any;
}

export default function HeadphoneSettings({
  profile,
}: {
  profile: Profile | null;
}) {
  const [model, setModel] = useState("generic");
  const [hasSingleButton, setHasSingleButton] = useState(true);
  const [hasDoubleButton, setHasDoubleButton] = useState(false);
  const [hasTripleButton, setHasTripleButton] = useState(false);
  const [singlePress, setSinglePress] = useState("pause_resume");
  const [doublePress, setDoublePress] = useState("next_set");
  const [longPress, setLongPress] = useState("voice_input");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (profile?.preferences?.headphones) {
      const h = profile.preferences.headphones;
      setModel(h.model || "generic");
      setHasSingleButton(h.has_single_button ?? true);
      setHasDoubleButton(h.has_double_button ?? false);
      setHasTripleButton(h.has_triple_button ?? false);
      if (h.button_mappings) {
        setSinglePress(h.button_mappings.single_press || "pause_resume");
        setDoublePress(h.button_mappings.double_press || "next_set");
        setLongPress(h.button_mappings.long_press || "voice_input");
      }
    }
  }, [profile]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);

    const preferences = {
      ...profile?.preferences,
      headphones: {
        model,
        has_single_button: hasSingleButton,
        has_double_button: hasDoubleButton,
        has_triple_button: hasTripleButton,
        button_mappings: {
          single_press: singlePress,
          double_press: doublePress,
          long_press: longPress,
        },
      },
    };

    const { error } = await supabase
      .from("user_profiles")
      .update({ preferences })
      .eq("id", profile?.id);

    if (error) {
      console.error("Error saving headphone settings:", error);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  };

  const buttonActions = [
    { value: "pause_resume", label: "Pause/Resume" },
    { value: "next_set", label: "Next Set" },
    { value: "voice_input", label: "Voice Input" },
    { value: "skip_exercise", label: "Skip Exercise" },
    { value: "repeat_announcement", label: "Repeat Announcement" },
  ];

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Headphone Settings</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Headphone Model
          </label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border text-gray-900"
          >
            <option value="generic">Generic</option>
            <option value="airpods">AirPods</option>
            <option value="airpods-pro">AirPods Pro</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Available Buttons
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={hasSingleButton}
              onChange={(e) => setHasSingleButton(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="ml-2 text-sm text-gray-700">Single Button</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={hasDoubleButton}
              onChange={(e) => setHasDoubleButton(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="ml-2 text-sm text-gray-700">
              Double Button (Volume)
            </span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={hasTripleButton}
              onChange={(e) => setHasTripleButton(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="ml-2 text-sm text-gray-700">
              Triple Button (Play/Next/Previous)
            </span>
          </label>
        </div>
        {hasSingleButton && (
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Single Press Action
            </label>
            <select
              value={singlePress}
              onChange={(e) => setSinglePress(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border text-gray-900"
            >
              {buttonActions.map((action) => (
                <option key={action.value} value={action.value}>
                  {action.label}
                </option>
              ))}
            </select>
          </div>
        )}
        {hasDoubleButton && (
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Double Press Action
            </label>
            <select
              value={doublePress}
              onChange={(e) => setDoublePress(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border text-gray-900"
            >
              {buttonActions.map((action) => (
                <option key={action.value} value={action.value}>
                  {action.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Long Press Action
          </label>
          <select
            value={longPress}
            onChange={(e) => setLongPress(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border text-gray-900"
          >
            {buttonActions.map((action) => (
              <option key={action.value} value={action.value}>
                {action.label}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : saved ? "Saved!" : "Save Headphone Settings"}
        </button>
      </div>
    </div>
  );
}
