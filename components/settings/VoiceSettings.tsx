"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import Toggle from "@/components/ui/Toggle";
import { useUser } from "@/contexts/UserContext";
import { COACH_PERSONALITIES, type CoachPersonality } from "@/lib/audio/speechManager";

interface Profile {
  id: string;
  preferences?: any;
}

export default function VoiceSettings({ profile: initialProfile }: { profile: Profile | null }) {
  const { profile, refreshProfile } = useUser();
  const currentProfile = profile || initialProfile;
  
  const [ttsProvider, setTtsProvider] = useState("openai");
  const [voiceId, setVoiceId] = useState("alloy");
  const [speechRate, setSpeechRate] = useState(1.0);
  const [volume, setVolume] = useState(0.8);
  const [audioCuesEnabled, setAudioCuesEnabled] = useState(true);
  const [coachPersonality, setCoachPersonality] = useState<CoachPersonality>("encouraging");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (currentProfile?.preferences?.audio) {
      setTtsProvider(currentProfile.preferences.audio.tts_provider || "browser");
      setVoiceId(currentProfile.preferences.audio.voice_id || "alloy");
      setSpeechRate(currentProfile.preferences.audio.speech_rate || 1.0);
      setVolume(currentProfile.preferences.audio.volume || 0.8);
      setAudioCuesEnabled(
        currentProfile.preferences.audio.audio_cues_enabled !== false // Default to true if not set
      );
      setCoachPersonality(
        currentProfile.preferences.audio.coach_personality || "encouraging"
      );
    }
  }, [currentProfile]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);

    if (!currentProfile?.id) {
      setSaving(false);
      return;
    }

    const preferences = {
      ...currentProfile.preferences,
      audio: {
        tts_provider: ttsProvider,
        voice_id: voiceId,
        speech_rate: speechRate,
        volume: volume,
        audio_cues_enabled: audioCuesEnabled,
        coach_personality: coachPersonality,
      },
    };

    const { error } = await supabase
      .from("user_profiles")
      .update({ preferences })
      .eq("id", currentProfile.id);

    if (error) {
      console.error("Error saving voice settings:", error);
      setSaving(false);
      return;
    }

    // Refresh profile from context
    await refreshProfile();

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
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
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Voice Settings</h2>
      <div className="space-y-6">
        <div>
          <Toggle
            enabled={audioCuesEnabled}
            onChange={setAudioCuesEnabled}
            label="Audio Cues"
            description="Enable voice announcements during workouts. When disabled, no audio will be played."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            TTS Provider
          </label>
          <select
            value={ttsProvider}
            onChange={(e) => setTtsProvider(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="openai">OpenAI TTS</option>
            <option value="browser">Browser TTS (Free)</option>
          </select>
        </div>
        {ttsProvider === "openai" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Voice
            </label>
            <select
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Default coach personality
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 mb-1">
            When you start a workout with Coach, this tone is used for voice and AI messages. You can change it during the workout.
          </p>
          <select
            value={coachPersonality}
            onChange={(e) => setCoachPersonality(e.target.value as CoachPersonality)}
            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {COACH_PERSONALITIES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
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
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
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
        <Button onClick={handleSave} disabled={saving} isLoading={saving}>
          {saved ? "Saved!" : "Save Voice Settings"}
        </Button>
      </div>
    </div>
  );
}
