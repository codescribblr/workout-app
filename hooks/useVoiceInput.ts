"use client";

import { useState, useCallback, useRef } from "react";

export function useVoiceInput(
  onResult: (text: string) => void,
  shouldKeepListening?: () => boolean
) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const lastTranscriptRef = useRef<string>("");
  const hasProcessedResultRef = useRef(false);
  const startTimeRef = useRef<number>(0);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startListening = useCallback(() => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      setError("Speech recognition not supported");
      return;
    }

    // Stop any existing recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore errors when stopping
      }
    }

    const SpeechRecognition =
      (window as any).webkitSpeechRecognition ||
      (window as any).SpeechRecognition;

    const recognition = new SpeechRecognition();
    recognition.continuous = true; // Use continuous mode for better mobile support
    recognition.interimResults = true; // Get interim results
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;
    
    // On mobile, recognition may auto-stop after a pause
    // We'll handle this in onend by processing the last transcript

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
      lastTranscriptRef.current = "";
      hasProcessedResultRef.current = false;
      startTimeRef.current = Date.now();
      // Clear any pending restart
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
      }
    };

    recognition.onresult = (event: any) => {
      // Get the transcript (both final and interim)
      let transcript = "";
      let hasFinalResult = false;
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        transcript += text;
        if (result.isFinal) {
          hasFinalResult = true;
        }
      }
      
      // Store the transcript (even if interim) for processing on end
      if (transcript.trim()) {
        lastTranscriptRef.current = transcript.trim();
      }
      
      // Don't process final results immediately - wait for onend to ensure user has finished speaking
      // This prevents cutting off mid-sentence when recognition marks a pause as "final"
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setError(event.error);
      setIsListening(false);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore errors
        }
      }
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      const listeningDuration = Date.now() - startTimeRef.current;
      
      // If we haven't processed a result yet but have a transcript, process it now
      // Wait at least 1.5 seconds to ensure user has finished speaking
      // This prevents cutting off mid-sentence
      if (!hasProcessedResultRef.current && lastTranscriptRef.current.trim()) {
        // If we have a transcript and it's been more than 1.5 seconds, process it
        // Otherwise, it might be too early and we should restart
        if (listeningDuration > 1500) {
          hasProcessedResultRef.current = true;
          const transcript = lastTranscriptRef.current;
          recognitionRef.current = null;
          setIsListening(false);
          // Process the result
          onResult(transcript);
          return;
        }
      }
      
      // If recognition ended too early (< 15 seconds) and we should keep listening, restart it
      // This handles mobile devices where recognition stops prematurely
      // Increased from 10 to 15 seconds to give users more time
      if (
        listeningDuration < 15000 &&
        !hasProcessedResultRef.current &&
        (!shouldKeepListening || shouldKeepListening())
      ) {
        recognitionRef.current = null;
        // Restart after a brief delay to avoid immediate restart loops
        restartTimeoutRef.current = setTimeout(() => {
          if (!hasProcessedResultRef.current && (!shouldKeepListening || shouldKeepListening())) {
            startListening();
          }
        }, 100);
      } else {
        setIsListening(false);
        recognitionRef.current = null;
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [onResult, shouldKeepListening]);

  const stopListening = useCallback(() => {
    // Clear any pending restart
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore errors when stopping
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
    hasProcessedResultRef.current = true; // Prevent restart after manual stop
  }, []);

  return { startListening, stopListening, isListening, error };
}
