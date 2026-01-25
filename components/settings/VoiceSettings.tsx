"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface Profile {
  id: string;
  preferences?: any;
}

export default function VoiceSettings({ profile }: { profile: Profile | null }) {
  const [ttsProvider, setTtsProvider] = useState("openai");
  const [voiceId, setVoiceId] = useState("alloy");
  const [speechRate, setSpeechRate] = useState(1.0);
  const [volume, setVolume] = useState(0.8);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (profile?.preferences?.audio) {
      setTtsProvider(profile.preferences.audio.tts_provider || "openai");
      setVoiceId(profile.preferences.audio.voice_id || "alloy");
      setSpeechRate(profile.preferences.audio.speech_rate || 1.0);
      setVolume(profile.preferences.audio.volume || 0.8);
    }
  }, [profile]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);

    const preferences = {
      ...profile?.preferences,
      audio: {
        tts_provider: ttsProvider,
        voice_id: voiceId,
        speech_rate: speechRate,
        volume: volume,
      },
    };

    const { error } = await supabase
      .from("user_profiles")
      .update({ preferences })
      .eq("id", profile?.id);

    if (error) {
      console.error("Error saving voice settings:", error);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  };

  const voices = [
    { id: "alloy", name: "Alloy" },
    { id: "echo", name: "Echo" },
    { id: "fable", name: "Fable" },
    { id: "onyx", name: "Onyx" },
    { id: "nova", name: "Nova" },
    { id: "shimmer", name: "Shimmer" },
  ];

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4">Voice Settings</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            TTS Provider
          </label>
          <select
            value={ttsProvider}
            onChange={(e) => setTtsProvider(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
          >
            <option value="openai">OpenAI TTS</option>
            <option value="browser">Browser TTS (Free)</option>
          </select>
        </div>
        {ttsProvider === "openai" && (
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Voice
            </label>
            <select
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
            >
              {voices.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Speech Rate: {speechRate.toFixed(1)}x
          </label>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={speechRate}
            onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
            className="mt-1 w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Volume: {Math.round(volume * 100)}%
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="mt-1 w-full"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : saved ? "Saved!" : "Save Voice Settings"}
        </button>
      </div>
    </div>
  );
}
