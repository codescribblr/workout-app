"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import {
  useHeadphoneButtonDetection,
  DetectedButton,
  MediaSessionAction,
} from "@/hooks/useHeadphoneButtonDetection";
import {
  speakAnnouncement,
  stopCurrentAnnouncement,
} from "@/lib/audio/speechManager";
import { useUser } from "@/contexts/UserContext";

interface ButtonMapping {
  type: "single_press";
  mediaAction: MediaSessionAction;
}

interface HeadphoneSetupProps {
  onComplete: () => void;
  onCancel: () => void;
}

type SetupStep = "name" | "button_detection";

export default function HeadphoneSetup({
  onComplete,
  onCancel,
}: HeadphoneSetupProps) {
  const { profile } = useUser();
  const [step, setStep] = useState<SetupStep>("name");
  const [name, setName] = useState("");
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioTimeRemaining, setAudioTimeRemaining] = useState(0);
  const audioIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [detectedButton, setDetectedButton] = useState<DetectedButton | null>(null);
  const [recentDetection, setRecentDetection] = useState<DetectedButton | null>(null);
  const [waitingForPress, setWaitingForPress] = useState(false);
  const speakingRef = useRef(false);
  const detectedRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const supabase = createClient();

  const { isSupported } = useHeadphoneButtonDetection({
    onButtonDetected: async (button) => {
      if (step === "button_detection" && !detectedRef.current) {
        // Only accept single press of play/pause button
        if (button.type !== "single_press" || (button.mediaAction !== "play" && button.mediaAction !== "pause")) {
          return;
        }

        // Mark as detected to prevent duplicates
        detectedRef.current = true;
        
        // Stop detection audio immediately since button was detected
        stopDetectionAudio();
        
        // Stop current speech and play success message (via manager for correct voice / single channel)
        stopCurrentAnnouncement();
        speakingRef.current = false;

        const audio = profile?.preferences?.audio;
        const audioPreferences = {
          tts_provider: audio?.tts_provider ?? "browser",
          voice_id: audio?.voice_id ?? "alloy",
          speech_rate: audio?.speech_rate ?? 1.0,
          volume: audio?.volume ?? 0.8,
        };

        await speakAnnouncement(
          "Button detected! Saving your headphones.",
          audioPreferences
        );
        
        // Store the detected button
        const detected: DetectedButton = {
          type: "single_press",
          mediaAction: button.mediaAction,
          timestamp: button.timestamp,
        };
        
        setDetectedButton(detected);
        
        // Show visual feedback
        setRecentDetection(detected);
        setWaitingForPress(false);
        
        // Automatically save after a short delay
        setTimeout(() => {
          handleSave(detected);
        }, 1500);
      }
    },
    enabled: step === "button_detection",
  });

  // Function to stop the detection audio
  const stopDetectionAudio = () => {
    if (audioElement) {
      audioElement.pause();
      if ((audioElement as any)._oscillator) {
        try {
          (audioElement as any)._oscillator.stop();
          (audioElement as any)._audioContext.close();
        } catch (e) {}
      }
      audioElement.src = "";
      setAudioElement(null);
    }
    if (audioIntervalRef.current) {
      clearInterval(audioIntervalRef.current);
      audioIntervalRef.current = null;
    }
    setIsAudioPlaying(false);
    setAudioTimeRemaining(0);
    if ("mediaSession" in navigator) {
      try {
        navigator.mediaSession.playbackState = "none";
        navigator.mediaSession.metadata = null;
      } catch (error) {}
    }
  };

  // Function to start the detection audio
  const startDetectionAudio = () => {
    // Stop any existing audio
    stopDetectionAudio();

    // Create a tone using Web Audio API for 15 seconds
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Very quiet background tone
    oscillator.frequency.value = 440;
    oscillator.type = "sine";
    gainNode.gain.value = 0.05;
    
    oscillator.start();
    
    // Also create an HTML audio element for media session
    const audio = new Audio();
    // Use a data URL for a simple tone
    audio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
    audio.volume = 0.01;
    audio.loop = true;
    audio.play().catch(() => {});
    setAudioElement(audio);
    
    // Set up media session
    if ("mediaSession" in navigator) {
      try {
        navigator.mediaSession.playbackState = "playing";
        if ("MediaMetadata" in window) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: "Headphone Button Detection",
            artist: "Workout App",
            album: "Press your headphone button now",
          });
        }
      } catch (error) {
        // Ignore
      }
    }
    
    setIsAudioPlaying(true);
    setAudioTimeRemaining(15);
    
    // Countdown timer
    audioIntervalRef.current = setInterval(() => {
      setAudioTimeRemaining((prev) => {
        if (prev <= 1) {
          // Stop audio when time runs out
          stopDetectionAudio();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    // Store oscillator for cleanup
    (audio as any)._oscillator = oscillator;
    (audio as any)._audioContext = audioContext;
  };

  // Cleanup audio on unmount or step change
  useEffect(() => {
    return () => {
      stopDetectionAudio();
    };
  }, [step]);

  // Speak prompt when audio starts playing for button detection
  useEffect(() => {
    if (
      step === "button_detection" &&
      isAudioPlaying &&
      !speakingRef.current &&
      !detectedRef.current
    ) {
      const audio = profile?.preferences?.audio;
      const audioPreferences = {
        tts_provider: audio?.tts_provider ?? "browser",
        voice_id: audio?.voice_id ?? "alloy",
        speech_rate: audio?.speech_rate ?? 1.0,
        volume: audio?.volume ?? 0.8,
      };

      const prompt = "Press your action button (play/pause) on your headphones now while the audio is playing.";

      speakingRef.current = true;
      speakAnnouncement(prompt, audioPreferences)
        .then(() => {
          speakingRef.current = false;
        })
        .catch(() => {
          speakingRef.current = false;
        });
    }

    // Cleanup: stop speech when leaving button detection step or component unmounts
    return () => {
      if (step !== "button_detection") {
        stopCurrentAnnouncement();
        speakingRef.current = false;
      }
    };
  }, [step, isAudioPlaying, profile?.preferences?.audio]);

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      stopCurrentAnnouncement();
      speakingRef.current = false;
    };
  }, []);

  const handleNext = () => {
    if (step === "name") {
      if (!name.trim()) {
        alert("Please enter a name for your headphones");
        return;
      }
      setStep("button_detection");
      detectedRef.current = false;
      setDetectedButton(null);
      setRecentDetection(null);
    }
  };

  const handleSave = async (detected?: DetectedButton) => {
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("You must be logged in to save headphones");
      setSaving(false);
      return;
    }

    // Use detected button or fallback to play action
    const buttonToSave = detected || detectedButton;
    if (!buttonToSave) {
      alert("No button was detected. Please try again.");
      setSaving(false);
      return;
    }

    // Check if this should be the default headphone
    const { data: existingHeadphones } = await supabase
      .from("user_headphones")
      .select("id")
      .eq("user_id", user.id)
      .limit(1);

    const isDefault = existingHeadphones?.length === 0;

    // Automatically map to button_1
    const buttonMappings = {
      button_1: {
        type: "single_press" as const,
        mediaAction: buttonToSave.mediaAction,
      },
      button_2: null,
      button_3: null,
    };

    const { error } = await supabase.from("user_headphones").insert({
      user_id: user.id,
      name: name.trim(),
      is_default: isDefault,
      action_button_behavior: "complete_set",
      button_mappings: buttonMappings,
    });

    if (error) {
      console.error("Error saving headphones:", error);
      alert("Failed to save headphones. Please try again.");
      setSaving(false);
    } else {
      onComplete();
    }
  };

  if (!isSupported) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Headphone Setup
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Your browser does not support headphone button detection. Please use a
          modern browser like Chrome, Edge, or Safari.
        </p>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        Setup New Headphones
      </h2>

      {step === "name" && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Give your headphones a name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., AirPods Pro, Workout Headphones"
              className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={onCancel} variant="secondary">
              Cancel
            </Button>
            <Button onClick={handleNext}>Next</Button>
          </div>
        </div>
      )}

      {step === "button_detection" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            We&apos;ll detect your headphone&apos;s action button (play/pause). Press the button on your headphones when prompted.
          </p>

          {recentDetection && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-green-600 dark:text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <p className="text-green-800 dark:text-green-200 font-medium">
                  Button detected! Saving your headphones...
                </p>
              </div>
            </div>
          )}

          {!detectedButton && !recentDetection && (
            <>
              {/* Audio Status */}
              <div className={`rounded-lg p-4 ${isAudioPlaying ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'}`}>
                {isAudioPlaying ? (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-green-800 dark:text-green-200 font-medium flex items-center gap-2">
                        <span className="inline-block w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                        Audio playing - Press button NOW!
                      </p>
                      <span className="text-green-700 dark:text-green-300 font-mono text-lg">
                        {audioTimeRemaining}s
                      </span>
                    </div>
                    <p className="text-green-600 dark:text-green-300 text-sm">
                      Press your action button (play/pause) on your headphones now. You should see a green checkmark when detected.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-yellow-800 dark:text-yellow-100 font-medium mb-2">
                      Audio stopped - Press &quot;Start Audio&quot; to begin detection
                    </p>
                    <p className="text-yellow-600 dark:text-yellow-300 text-sm">
                      Audio must be playing for button detection to work. Click &quot;Start Audio&quot; and then press your headphone button.
                    </p>
                  </>
                )}
              </div>

              <div className="flex gap-2">
                {!isAudioPlaying ? (
                  <Button onClick={startDetectionAudio} variant="primary">
                    Start Audio
                  </Button>
                ) : (
                  <Button onClick={stopDetectionAudio} variant="secondary">
                    Stop Audio
                  </Button>
                )}
                <Button
                  onClick={() => {
                    stopDetectionAudio();
                    setStep("name");
                  }}
                  variant="secondary"
                >
                  Back
                </Button>
              </div>
            </>
          )}

          {saving && (
            <div className="text-center py-4">
              <p className="text-gray-600 dark:text-gray-400">Saving your headphones...</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
