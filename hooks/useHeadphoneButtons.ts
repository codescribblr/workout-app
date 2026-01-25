"use client";

import { useEffect, useCallback } from "react";

type ButtonAction =
  | "pause_resume"
  | "next_set"
  | "voice_input"
  | "skip_exercise"
  | "repeat_announcement";

interface ButtonMappings {
  single_press?: ButtonAction;
  double_press?: ButtonAction;
  long_press?: ButtonAction;
}

export function useHeadphoneButtons(
  mappings: ButtonMappings,
  onAction: (action: ButtonAction) => void
) {
  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) {
      return;
    }

    const handlePlay = () => {
      if (mappings.single_press === "pause_resume") {
        onAction("pause_resume");
      }
    };

    const handlePause = () => {
      if (mappings.single_press === "pause_resume") {
        onAction("pause_resume");
      }
    };

    const handleNextTrack = () => {
      if (mappings.double_press) {
        onAction(mappings.double_press);
      }
    };

    const handlePreviousTrack = () => {
      // Could map to previous set or other action
    };

    try {
      navigator.mediaSession.setActionHandler("play", handlePlay);
      navigator.mediaSession.setActionHandler("pause", handlePause);
      navigator.mediaSession.setActionHandler("nexttrack", handleNextTrack);
      navigator.mediaSession.setActionHandler(
        "previoustrack",
        handlePreviousTrack
      );
    } catch (error) {
      console.error("Error setting up media session:", error);
    }

    return () => {
      // Cleanup if needed
    };
  }, [mappings, onAction]);
}
