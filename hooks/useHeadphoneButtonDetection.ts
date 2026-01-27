"use client";

import { useEffect, useCallback, useRef, useState } from "react";

export type MediaSessionAction =
  | "play"
  | "pause"
  | "nexttrack"
  | "previoustrack";

export type ButtonPressType =
  | "single_press"
  | "double_press"
  | "long_press";

export interface DetectedButton {
  type: ButtonPressType;
  mediaAction: MediaSessionAction;
  timestamp: number;
}

interface UseHeadphoneButtonDetectionOptions {
  onButtonDetected: (button: DetectedButton) => void;
  enabled?: boolean;
}

export function useHeadphoneButtonDetection({
  onButtonDetected,
  enabled = true,
}: UseHeadphoneButtonDetectionOptions) {
  const [isSupported, setIsSupported] = useState(false);
  const handlersRef = useRef<Map<MediaSessionAction, () => void>>(new Map());
  const lastPressTimeRef = useRef<Map<MediaSessionAction, number>>(new Map());
  const pressCountRef = useRef<Map<MediaSessionAction, number>>(new Map());
  const longPressTimerRef = useRef<Map<MediaSessionAction, NodeJS.Timeout>>(
    new Map()
  );

  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) {
      setIsSupported(false);
      return;
    }
    setIsSupported(true);
  }, []);

  const createHandler = useCallback(
    (mediaAction: MediaSessionAction) => {
      return () => {
        if (!enabled) return;

        const now = Date.now();
        const lastPressTime = lastPressTimeRef.current.get(mediaAction) || 0;
        const timeSinceLastPress = now - lastPressTime;

        // Handle double press detection (within 1000ms = 1 second)
        if (timeSinceLastPress < 1000) {
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

        // For play/pause buttons, detect single, double, and long press
        if (mediaAction === "play" || mediaAction === "pause") {
          // Start long press timer (750ms)
          const longPressTimer = setTimeout(() => {
            // Only detect as long press if it's still a single press (not double)
            const finalCount = pressCountRef.current.get(mediaAction) || 0;
            if (finalCount === 1) {
              onButtonDetected({
                type: "long_press",
                mediaAction,
                timestamp: now,
              });
              pressCountRef.current.set(mediaAction, 0);
            }
            longPressTimerRef.current.delete(mediaAction);
          }, 750);
          longPressTimerRef.current.set(mediaAction, longPressTimer);
          
          // Handle double press (within 1 second)
          if (pressCount === 2) {
            // Clear long press timer since this is a double press
            clearTimeout(longPressTimer);
            longPressTimerRef.current.delete(mediaAction);
            setTimeout(() => {
              onButtonDetected({
                type: "double_press",
                mediaAction,
                timestamp: now,
              });
              pressCountRef.current.set(mediaAction, 0);
            }, 50);
          } else if (pressCount === 1) {
            // Single press - wait to see if it becomes a double press
            setTimeout(() => {
              const currentCount = pressCountRef.current.get(mediaAction) || 0;
              const currentTimer = longPressTimerRef.current.get(mediaAction);
              // Only detect as single press if:
              // 1. Still only 1 press (didn't become double)
              // 2. Long press timer is still active (wasn't a long press)
              if (currentCount === 1 && currentTimer) {
                clearTimeout(currentTimer);
                longPressTimerRef.current.delete(mediaAction);
                onButtonDetected({
                  type: "single_press",
                  mediaAction,
                  timestamp: now,
                });
                pressCountRef.current.set(mediaAction, 0);
              }
            }, 200); // Wait 200ms to see if it becomes a double press
          }
        } else {
          // For other buttons (nexttrack, previoustrack), just detect as single press
          onButtonDetected({
            type: "single_press",
            mediaAction,
            timestamp: now,
          });
        }

        lastPressTimeRef.current.set(mediaAction, now);
      };
    },
    [enabled, onButtonDetected]
  );

  useEffect(() => {
    if (!isSupported || !enabled) {
      return;
    }

    // Clear all existing handlers first
    try {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("nexttrack", null);
      navigator.mediaSession.setActionHandler("previoustrack", null);
      navigator.mediaSession.setActionHandler("seekforward", null);
      navigator.mediaSession.setActionHandler("seekbackward", null);
    } catch (error) {
      // Ignore errors when clearing handlers
    }

    // Set up handlers for detection
    const playHandler = createHandler("play");
    const pauseHandler = createHandler("pause");
    const nextTrackHandler = createHandler("nexttrack");
    const prevTrackHandler = createHandler("previoustrack");

    handlersRef.current.set("play", playHandler);
    handlersRef.current.set("pause", pauseHandler);
    handlersRef.current.set("nexttrack", nextTrackHandler);
    handlersRef.current.set("previoustrack", prevTrackHandler);

    try {
      navigator.mediaSession.setActionHandler("play", playHandler);
      navigator.mediaSession.setActionHandler("pause", pauseHandler);
      navigator.mediaSession.setActionHandler("nexttrack", nextTrackHandler);
      navigator.mediaSession.setActionHandler("previoustrack", prevTrackHandler);
    } catch (error) {
      console.error("Error setting up media session handlers:", error);
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
      handlersRef.current.clear();
      lastPressTimeRef.current.clear();
      pressCountRef.current.clear();
    };
  }, [isSupported, enabled, createHandler]);

  return {
    isSupported,
  };
}
