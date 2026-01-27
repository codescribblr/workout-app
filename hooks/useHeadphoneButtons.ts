"use client";

import { useEffect, useCallback, useRef } from "react";

export type MediaSessionAction =
  | "play"
  | "pause"
  | "nexttrack"
  | "previoustrack";

export type ButtonPressType =
  | "single_press"
  | "double_press"
  | "long_press";

export interface ButtonMapping {
  type: ButtonPressType;
  mediaAction: MediaSessionAction;
}

export interface ButtonMappings {
  button_1: ButtonMapping | null;
  button_2: ButtonMapping | null;
  button_3: ButtonMapping | null;
}

export function useHeadphoneButtons(
  mappings: ButtonMappings | null | undefined,
  onButtonPress: (buttonNumber: 1 | 2 | 3) => void
) {
  const lastPressTimeRef = useRef<Map<MediaSessionAction, number>>(new Map());
  const pressCountRef = useRef<Map<MediaSessionAction, number>>(new Map());
  const longPressTimerRef = useRef<Map<MediaSessionAction, NodeJS.Timeout>>(
    new Map()
  );

  const findButtonForPress = useCallback(
    (mediaAction: MediaSessionAction, buttonType: ButtonPressType): 1 | 2 | 3 | null => {
      if (!mappings) return null;

      const isPlayPause =
        (mediaAction === "play" || mediaAction === "pause");

      // Check each button mapping
      for (const [buttonKey, mapping] of Object.entries(mappings)) {
        if (!mapping || mapping.type !== buttonType) {
          continue;
        }

        const mappingIsPlayPause =
          mapping.mediaAction === "play" || mapping.mediaAction === "pause";

        const matchesMediaAction =
          mapping.mediaAction === mediaAction ||
          (mappingIsPlayPause && isPlayPause);

        if (matchesMediaAction) {
          if (buttonKey === "button_1") return 1;
          if (buttonKey === "button_2") return 2;
          if (buttonKey === "button_3") return 3;
        }
      }
      return null;
    },
    [mappings]
  );

  const createHandler = useCallback(
    (mediaAction: MediaSessionAction) => {
      return () => {
        if (!mappings) return;

        const now = Date.now();
        const lastPressTime = lastPressTimeRef.current.get(mediaAction) || 0;
        const timeSinceLastPress = now - lastPressTime;

        // Handle double press detection (within 500ms)
        if (timeSinceLastPress < 500) {
          pressCountRef.current.set(
            mediaAction,
            (pressCountRef.current.get(mediaAction) || 0) + 1
          );
        } else {
          pressCountRef.current.set(mediaAction, 1);
        }

        const pressCount = pressCountRef.current.get(mediaAction) || 1;

        // Clear any existing long press timer
        const existingTimer = longPressTimerRef.current.get(mediaAction);
        if (existingTimer) {
          clearTimeout(existingTimer);
          longPressTimerRef.current.delete(mediaAction);
        }

        // Check for long press mapping
        const longPressButton = findButtonForPress(mediaAction, "long_press");
        if (longPressButton) {
          const timer = setTimeout(() => {
            onButtonPress(longPressButton);
            longPressTimerRef.current.delete(mediaAction);
          }, 800);
          longPressTimerRef.current.set(mediaAction, timer);
          return;
        }

        // Handle double press
        if (pressCount === 2) {
          setTimeout(() => {
            const doublePressButton = findButtonForPress(mediaAction, "double_press");
            if (doublePressButton) {
              onButtonPress(doublePressButton);
            }
            pressCountRef.current.set(mediaAction, 0);
          }, 100);
          return;
        }

        // Handle single press - wait a bit to see if it becomes a double press
        if (pressCount === 1) {
          setTimeout(() => {
            const currentCount = pressCountRef.current.get(mediaAction) || 0;
            if (currentCount === 1) {
              const singlePressButton = findButtonForPress(mediaAction, "single_press");
              if (singlePressButton) {
                onButtonPress(singlePressButton);
              }
              pressCountRef.current.set(mediaAction, 0);
            }
          }, 300);
        }
      };
    },
    [mappings, findButtonForPress, onButtonPress]
  );

  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) {
      return;
    }

    if (!mappings) {
      return;
    }

    const handlePlay = createHandler("play");
    const handlePause = createHandler("pause");
    const handleNextTrack = createHandler("nexttrack");
    const handlePreviousTrack = createHandler("previoustrack");

    try {
      navigator.mediaSession.setActionHandler("play", handlePlay);
      navigator.mediaSession.setActionHandler("pause", handlePause);
      navigator.mediaSession.setActionHandler("nexttrack", handleNextTrack);
      navigator.mediaSession.setActionHandler("previoustrack", handlePreviousTrack);
    } catch (error) {
      console.error("Error setting up media session:", error);
    }

    return () => {
      // Cleanup
      try {
        navigator.mediaSession.setActionHandler("play", null);
        navigator.mediaSession.setActionHandler("pause", null);
        navigator.mediaSession.setActionHandler("nexttrack", null);
        navigator.mediaSession.setActionHandler("previoustrack", null);
      } catch (error) {
        // Ignore cleanup errors
      }

      // Clear all timers
      longPressTimerRef.current.forEach((timer) => clearTimeout(timer));
      longPressTimerRef.current.clear();
      lastPressTimeRef.current.clear();
      pressCountRef.current.clear();
    };
  }, [mappings, createHandler]);
}
