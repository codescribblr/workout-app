import { createClient } from "@/lib/supabase/client";

export async function speakText(
  text: string,
  preferences?: {
    tts_provider?: string;
    voice_id?: string;
    speech_rate?: number;
    volume?: number;
  }
) {
  const provider = preferences?.tts_provider || "openai";
  const voiceId = preferences?.voice_id || "alloy";
  const rate = preferences?.speech_rate || 1.0;
  const volume = preferences?.volume || 0.8;

  if (provider === "browser") {
    // Use browser TTS
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = rate;
      utterance.volume = volume;
      window.speechSynthesis.speak(utterance);
      return new Promise<void>((resolve) => {
        utterance.onend = () => resolve();
      });
    }
  } else {
    // Use OpenAI TTS
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: voiceId }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audio.volume = volume;
        audio.playbackRate = rate;
        await new Promise<void>((resolve, reject) => {
          audio.onended = () => resolve();
          audio.onerror = reject;
          audio.play();
        });
        URL.revokeObjectURL(audioUrl);
      }
    } catch (error) {
      console.error("TTS error:", error);
      // Fallback to browser TTS
      if ("speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = rate;
        utterance.volume = volume;
        window.speechSynthesis.speak(utterance);
        return new Promise<void>((resolve) => {
          utterance.onend = () => resolve();
        });
      }
    }
  }
}
