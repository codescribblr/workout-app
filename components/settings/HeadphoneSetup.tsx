"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import {
  useHeadphoneButtonDetection,
  DetectedButton,
  MediaSessionAction,
  ButtonPressType,
} from "@/hooks/useHeadphoneButtonDetection";
import { speakText, stopSpeech } from "@/lib/audio/tts";
import { useUser } from "@/contexts/UserContext";

interface ButtonMapping {
  type: ButtonPressType;
  mediaAction: MediaSessionAction;
}

interface HeadphoneSetupProps {
  onComplete: () => void;
  onCancel: () => void;
}

type SetupStep =
  | "name"
  | "button_selection"
  | "button_detection"
  | "button_mapping"
  | "testing";

export default function HeadphoneSetup({
  onComplete,
  onCancel,
}: HeadphoneSetupProps) {
  const { profile } = useUser();
  const [step, setStep] = useState<SetupStep>("name");
  const [name, setName] = useState("");
  const [availableButtons, setAvailableButtons] = useState<{
    single: boolean;
    nextTrack: boolean;
    prevTrack: boolean;
  }>({
    single: false,
    nextTrack: false,
    prevTrack: false,
  });
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioTimeRemaining, setAudioTimeRemaining] = useState(0);
  const audioIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [currentButtonIndex, setCurrentButtonIndex] = useState(0);
  const [detectedButtons, setDetectedButtons] = useState<DetectedButton[]>([]);
  const [recentDetection, setRecentDetection] = useState<DetectedButton | null>(null);
  const [waitingForPress, setWaitingForPress] = useState(false);
  const speakingRef = useRef(false);
  const detectedForCurrentButtonRef = useRef<Set<string>>(new Set());
  // Track which physical buttons (mediaAction) have been detected for which button types
  // Format: "mediaAction:buttonType" -> true
  const detectedMediaActionsRef = useRef<Map<string, string>>(new Map());
  const [buttonMappings, setButtonMappings] = useState<{
    button_1: ButtonMapping | null;
    button_2: ButtonMapping | null;
    button_3: ButtonMapping | null;
  }>({
    button_1: null,
    button_2: null,
    button_3: null,
  });
  const [testingButton, setTestingButton] = useState<"button_1" | "button_2" | "button_3" | null>(null);
  const [testResults, setTestResults] = useState<{
    button_1: boolean | null;
    button_2: boolean | null;
    button_3: boolean | null;
  }>({
    button_1: null,
    button_2: null,
    button_3: null,
  });
  const [saving, setSaving] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const supabase = createClient();

  // Build list of buttons to detect based on user's selection
  const buttonsToDetect: Array<{ id: string; label: string; expectedType?: ButtonPressType }> = [];
  
  if (availableButtons.single) {
    // For single button, detect single, double, and long press
    buttonsToDetect.push(
      { id: "single", label: "single action button (single press)", expectedType: "single_press" },
      { id: "double", label: "single action button (double press)", expectedType: "double_press" },
      { id: "long", label: "single action button (long press)", expectedType: "long_press" }
    );
  }
  if (availableButtons.nextTrack) {
    buttonsToDetect.push({ id: "nextTrack", label: "next track button", expectedType: "single_press" });
  }
  if (availableButtons.prevTrack) {
    buttonsToDetect.push({ id: "prevTrack", label: "previous track button", expectedType: "single_press" });
  }
  
  // Build manual mapping options based on selected buttons
  const manualMappingOptions: Array<{
    label: string;
    type: ButtonPressType;
    mediaAction: MediaSessionAction;
  }> = [];
  
  // If single action button is selected, show single/double/long press options
  if (availableButtons.single) {
    manualMappingOptions.push(
      { label: "Single press (Play/Pause)", type: "single_press", mediaAction: "play" },
      { label: "Double press (Play/Pause)", type: "double_press", mediaAction: "play" },
      { label: "Long press (Play/Pause)", type: "long_press", mediaAction: "play" }
    );
  }
  
  // If next track button is selected, show that option
  if (availableButtons.nextTrack) {
    manualMappingOptions.push(
      { label: "Next track", type: "single_press", mediaAction: "nexttrack" }
    );
  }
  
  // If previous track button is selected, show that option
  if (availableButtons.prevTrack) {
    manualMappingOptions.push(
      { label: "Previous track", type: "single_press", mediaAction: "previoustrack" }
    );
  }

  const { isSupported } = useHeadphoneButtonDetection({
    onButtonDetected: async (button) => {
      if (step === "button_detection") {
        // Get what we're currently expecting to detect
        const expectedType = getCurrentExpectedType();
        if (!expectedType) return;
        
        const currentButtonId = buttonsToDetect[currentButtonIndex]?.id;
        if (!currentButtonId) return;
        
        // Check if this physical button (mediaAction) was already detected
        const existingMapping = detectedMediaActionsRef.current.get(button.mediaAction);
        
        // Allow same mediaAction if:
        // 1. It's for the same logical button (single button detecting single/double/long press)
        // 2. It's a different press type (single_press vs double_press vs long_press)
        const isSingleButtonVariation = availableButtons.single && 
          (currentButtonId === "single" || currentButtonId === "double" || currentButtonId === "long") &&
          (existingMapping === "single" || existingMapping === "double" || existingMapping === "long");
        
        // If this mediaAction was already used for a different logical button, reject it
        // Exception: allow if it's a different press type of the same logical button (single/double/long)
        if (existingMapping && existingMapping !== currentButtonId && !isSingleButtonVariation) {
          // This physical button was already detected for a different logical button
          return;
        }
        
        // Create a unique key for this button detection
        const buttonKey = `${button.type}-${button.mediaAction}`;
        
        // Prevent duplicate detections for the current button
        if (detectedForCurrentButtonRef.current.has(buttonKey)) {
          return;
        }
        
        // Mark this button as detected
        detectedForCurrentButtonRef.current.add(buttonKey);
        detectedMediaActionsRef.current.set(button.mediaAction, buttonsToDetect[currentButtonIndex]?.id || "");
        
        // Create the detected button with the expected type (not necessarily what was detected)
        // This ensures that if they press play button for "double press", we record it as double_press
        const detectedButton: DetectedButton = {
          type: expectedType, // Use the expected type, not the detected type
          mediaAction: button.mediaAction, // But keep the actual mediaAction that was pressed
          timestamp: button.timestamp,
        };
        
        // Stop detection audio immediately since button was detected
        stopDetectionAudio();
        
        // Stop current speech and play success message
        stopSpeech();
        speakingRef.current = false;
        
        const audioPreferences = profile?.preferences?.audio || {
          tts_provider: "browser",
          voice_id: "alloy",
          speech_rate: 1.0,
          volume: 0.8,
        };
        
        const currentButtonLabel = getCurrentButtonLabel();
        await speakText(
          `${currentButtonLabel} detected!`,
          audioPreferences
        );
        
        setDetectedButtons((prev) => {
          // Check if this exact combination is already detected
          const exists = prev.some(
            (b) =>
              b.type === detectedButton.type && b.mediaAction === detectedButton.mediaAction
          );
          if (!exists) {
            return [...prev, detectedButton];
          }
          return prev;
        });
        // Show visual feedback
        setRecentDetection(detectedButton);
        setWaitingForPress(false);
        setTimeout(() => {
          setRecentDetection(null);
        }, 3000);
      } else if (step === "testing" && testingButton) {
        const mapping = buttonMappings[testingButton];
        if (
          mapping &&
          mapping.type === button.type &&
          mapping.mediaAction === button.mediaAction
        ) {
          setTestResults((prev) => ({
            ...prev,
            [testingButton]: true,
          }));
          setTimeout(() => {
            setTestingButton(null);
          }, 1500);
        }
      }
    },
    enabled: step === "button_detection" || step === "testing",
  });

  const getCurrentButtonLabel = () => {
    if (currentButtonIndex >= buttonsToDetect.length) return "";
    return buttonsToDetect[currentButtonIndex].label;
  };

  const getCurrentExpectedType = (): ButtonPressType | undefined => {
    if (currentButtonIndex >= buttonsToDetect.length) return undefined;
    return buttonsToDetect[currentButtonIndex].expectedType;
  };

  const getDetectedButtonLabel = (button: DetectedButton) => {
    if (button.type === "single_press") {
      if (button.mediaAction === "play" || button.mediaAction === "pause") {
        return "Single Press (Play/Pause)";
      }
      if (button.mediaAction === "nexttrack") return "Next Track";
      if (button.mediaAction === "previoustrack") return "Previous Track";
      return "Single Press";
    }
    if (button.type === "double_press") return "Double Press (Play/Pause)";
    if (button.type === "long_press") return "Long Press (Play/Pause)";
    return `${button.type} (${button.mediaAction})`;
  };

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
      currentButtonIndex < buttonsToDetect.length &&
      isAudioPlaying &&
      !speakingRef.current
    ) {
      const audioPreferences = profile?.preferences?.audio || {
        tts_provider: "browser",
        voice_id: "alloy",
        speech_rate: 1.0,
        volume: 0.8,
      };

      const buttonLabel = getCurrentButtonLabel();
      const prompt = `Press your ${buttonLabel} on your headphones now while the audio is playing.`;

      speakingRef.current = true;
      speakText(prompt, audioPreferences)
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
        stopSpeech();
        speakingRef.current = false;
      }
    };
  }, [step, currentButtonIndex, buttonsToDetect.length, isAudioPlaying, profile?.preferences?.audio]);

  // Reset detection tracking when moving to next button
  useEffect(() => {
    detectedForCurrentButtonRef.current.clear();
  }, [currentButtonIndex]);

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      stopSpeech();
      speakingRef.current = false;
    };
  }, []);

  const handleNext = () => {
    if (step === "name") {
      if (!name.trim()) {
        alert("Please enter a name for your headphones");
        return;
      }
      setStep("button_selection");
    } else if (step === "button_selection") {
      const hasAnyButton =
        availableButtons.single ||
        availableButtons.nextTrack ||
        availableButtons.prevTrack;
      if (!hasAnyButton) {
        alert("Please select at least one button type");
        return;
      }
      setStep("button_detection");
      setCurrentButtonIndex(0);
      setDetectedButtons([]);
      detectedForCurrentButtonRef.current.clear();
      detectedMediaActionsRef.current.clear();
    } else if (step === "button_detection") {
      if (detectedButtons.length === 0) {
        alert("No buttons were detected. You can still proceed with manual mapping, but detection may not work during workouts.");
      }
      setStep("button_mapping");
    } else if (step === "button_mapping") {
      const hasAnyMapping =
        buttonMappings.button_1 ||
        buttonMappings.button_2 ||
        buttonMappings.button_3;
      if (!hasAnyMapping) {
        alert("Please map at least one button");
        return;
      }
      setStep("testing");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("You must be logged in to save headphones");
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

    const { error } = await supabase.from("user_headphones").insert({
      user_id: user.id,
      name: name.trim(),
      is_default: isDefault,
      button_mappings: buttonMappings,
    });

    if (error) {
      console.error("Error saving headphones:", error);
      alert("Failed to save headphones. Please try again.");
    } else {
      onComplete();
    }
    setSaving(false);
  };

  const handleMapButton = (
    detectedButton: DetectedButton,
    targetButton: "button_1" | "button_2" | "button_3"
  ) => {
    setButtonMappings((prev) => ({
      ...prev,
      [targetButton]: {
        type: detectedButton.type,
        mediaAction: detectedButton.mediaAction,
      },
    }));
  };

  const handleTestButton = (buttonKey: "button_1" | "button_2" | "button_3") => {
    if (!buttonMappings[buttonKey]) return;
    setTestingButton(buttonKey);
    setTestResults((prev) => ({
      ...prev,
      [buttonKey]: null,
    }));
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

      {step === "button_selection" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            What buttons do your headphones have? Select all that apply.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Note: Volume buttons are not supported by browsers. Only media control buttons can be detected.
          </p>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={availableButtons.single}
                onChange={(e) =>
                  setAvailableButtons((prev) => ({
                    ...prev,
                    single: e.target.checked,
                  }))
                }
                className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 bg-white dark:bg-gray-700"
              />
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Single action button (play/pause)
              </span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={availableButtons.nextTrack}
                onChange={(e) =>
                  setAvailableButtons((prev) => ({
                    ...prev,
                    nextTrack: e.target.checked,
                  }))
                }
                className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 bg-white dark:bg-gray-700"
              />
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Next track button
              </span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={availableButtons.prevTrack}
                onChange={(e) =>
                  setAvailableButtons((prev) => ({
                    ...prev,
                    prevTrack: e.target.checked,
                  }))
                }
                className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 bg-white dark:bg-gray-700"
              />
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Previous track button
              </span>
            </label>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setStep("name")} variant="secondary">
              Back
            </Button>
            <Button onClick={handleNext}>Next</Button>
          </div>
        </div>
      )}

      {step === "button_detection" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {currentButtonIndex < buttonsToDetect.length ? (
              <>
                Press <strong className="text-gray-900 dark:text-white">
                  {getCurrentButtonLabel()}
                </strong> on your headphones while audio is playing. We'll detect whatever button you press and how you press it (single, double, or long press).
              </>
            ) : detectedButtons.length > 0 ? (
              "Great! We've detected your button presses. Click Next to map them to Button 1, 2, or 3."
            ) : (
              "No buttons were detected. You can try again or continue with manual mapping."
            )}
          </p>

          {currentButtonIndex < buttonsToDetect.length && (
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
                      Press any button on your headphones now. We'll detect which button you pressed and how (single, double, or long press). You should see a green checkmark when detected.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-yellow-800 dark:text-yellow-100 font-medium mb-2">
                      Audio stopped - Press "Start Audio" to begin detection
                    </p>
                    <p className="text-yellow-700 dark:text-yellow-100 text-sm">
                      Headphone buttons can only be detected while audio is playing. Click the button below to start a 15-second audio track.
                    </p>
                  </>
                )}
              </div>

              {/* Start/Restart Audio Button */}
              <div className="flex gap-2">
                <Button
                  onClick={startDetectionAudio}
                  variant={isAudioPlaying ? "secondary" : "primary"}
                >
                  {isAudioPlaying ? "Restart Audio (15s)" : "Start Audio (15s)"}
                </Button>
              </div>
            </>
          )}

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
                  Button detected! {getDetectedButtonLabel(recentDetection)} (
                  {recentDetection.mediaAction})
                </p>
              </div>
            </div>
          )}

          {detectedButtons.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Detected buttons ({detectedButtons.length}):
              </p>
              <ul className="space-y-1">
                {detectedButtons.map((button, idx) => (
                  <li
                    key={idx}
                    className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4 text-green-600 dark:text-green-400"
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
                    {getDetectedButtonLabel(button)} ({button.mediaAction})
                  </li>
                ))}
              </ul>
            </div>
          )}

          {currentButtonIndex < buttonsToDetect.length && (
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  stopSpeech();
                  speakingRef.current = false;
                  detectedForCurrentButtonRef.current.clear();
                  setCurrentButtonIndex((prev) => prev + 1);
                  setWaitingForPress(false);
                }}
                variant="secondary"
              >
                Skip this button
              </Button>
              <Button
                onClick={() => {
                  stopSpeech();
                  speakingRef.current = false;
                  setWaitingForPress(true);
                  // Wait a moment to see if detection happens
                  setTimeout(() => {
                    setWaitingForPress(false);
                    // Always advance - if nothing was detected, they can skip or try again
                    detectedForCurrentButtonRef.current.clear();
                    setCurrentButtonIndex((prev) => prev + 1);
                  }, 2000);
                }}
                disabled={waitingForPress}
              >
                {waitingForPress ? "Waiting for detection..." : "I pressed it"}
              </Button>
            </div>
          )}

          {currentButtonIndex >= buttonsToDetect.length && (
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setCurrentButtonIndex(0);
                  setDetectedButtons([]);
                  setRecentDetection(null);
                  setWaitingForPress(false);
                  detectedForCurrentButtonRef.current.clear();
                  detectedMediaActionsRef.current.clear();
                }}
                variant="secondary"
              >
                Redetect
              </Button>
              <Button onClick={handleNext}>Next</Button>
            </div>
          )}
        </div>
      )}

      {step === "button_mapping" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Map your detected button presses to Button 1, 2, or 3. You can map any detected button to any Button 1-3. 
            {availableButtons.single && (
              <> If you only have one physical button, you can map different press types (single, double, long) or different buttons to Button 1, 2, and 3.</>
            )}
          </p>

          {detectedButtons.length === 0 && (
            <p className="text-sm text-yellow-600 dark:text-yellow-400 mb-4">
              No buttons were detected. You can still proceed and choose a manual
              mapping below, but detection during workouts may not work.
            </p>
          )}

          <div className="space-y-4">
            {(["button_1", "button_2", "button_3"] as const).map((buttonKey) => (
              <div
                key={buttonKey}
                className="border border-gray-300 dark:border-gray-600 rounded-lg p-4"
              >
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {buttonKey === "button_1"
                    ? "Button 1"
                    : buttonKey === "button_2"
                    ? "Button 2"
                    : "Button 3"}
                </label>
                <select
                  value={
                    buttonMappings[buttonKey]
                      ? `${buttonMappings[buttonKey]!.type}-${buttonMappings[buttonKey]!.mediaAction}`
                      : ""
                  }
                  onChange={(e) => {
                    if (e.target.value === "") {
                      setButtonMappings((prev) => ({
                        ...prev,
                        [buttonKey]: null,
                      }));
                    } else {
                      const [type, mediaAction] = e.target.value.split("-");
                      const detectedButton = detectedButtons.find(
                        (b) =>
                          b.type === type && b.mediaAction === mediaAction
                      );
                      if (detectedButton) {
                        handleMapButton(detectedButton, buttonKey);
                        return;
                      }

                      setButtonMappings((prev) => ({
                        ...prev,
                        [buttonKey]: {
                          type: type as ButtonPressType,
                          mediaAction: mediaAction as MediaSessionAction,
                        },
                      }));
                    }
                  }}
                  className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Not mapped</option>
                  {detectedButtons.length > 0 && (
                    <optgroup label="Detected buttons">
                      {detectedButtons.map((button, idx) => (
                        <option
                          key={`detected-${idx}`}
                          value={`${button.type}-${button.mediaAction}`}
                        >
                          {getDetectedButtonLabel(button)} ({button.mediaAction})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Manual options (best guess)">
                    {manualMappingOptions.map((option) => (
                      <option
                        key={`manual-${option.type}-${option.mediaAction}-${option.label}`}
                        value={`${option.type}-${option.mediaAction}`}
                      >
                        {option.label}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button onClick={() => setStep("button_detection")} variant="secondary">
              Back
            </Button>
            <Button onClick={handleNext}>Next</Button>
          </div>
        </div>
      )}

      {step === "testing" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Test each mapped button to make sure we can detect it correctly.
            Press the button when prompted.
          </p>

          <div className="space-y-4">
            {(["button_1", "button_2", "button_3"] as const).map((buttonKey) => {
              const mapping = buttonMappings[buttonKey];
              if (!mapping) return null;

              const isTesting = testingButton === buttonKey;
              const testResult = testResults[buttonKey];

              return (
                <div
                  key={buttonKey}
                  className="border border-gray-300 dark:border-gray-600 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {buttonKey === "button_1"
                          ? "Button 1"
                          : buttonKey === "button_2"
                          ? "Button 2"
                          : "Button 3"}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {getDetectedButtonLabel({
                          type: mapping.type,
                          mediaAction: mapping.mediaAction,
                          timestamp: 0,
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {testResult === true && (
                        <span className="text-green-600 dark:text-green-400 text-sm">
                          ✓ Detected
                        </span>
                      )}
                      {testResult === false && (
                        <span className="text-red-600 dark:text-red-400 text-sm">
                          ✗ Not detected
                        </span>
                      )}
                      {isTesting && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded px-3 py-1">
                          <p className="text-blue-800 dark:text-blue-200 text-sm">
                            Listening...
                          </p>
                        </div>
                      )}
                      {!isTesting && (
                        <Button
                          onClick={() => handleTestButton(buttonKey)}
                          variant="secondary"
                          size="sm"
                        >
                          Test
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-2">
            <Button onClick={() => setStep("button_mapping")} variant="secondary">
              Back
            </Button>
            <Button onClick={handleSave} disabled={saving} isLoading={saving}>
              {saving ? "Saving..." : "Save Headphones"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
