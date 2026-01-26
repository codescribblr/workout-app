// Global speech manager to ensure only one voice speaks at a time
let activeAudio: HTMLAudioElement | null = null;
let activeUtterance: SpeechSynthesisUtterance | null = null;

function stopAllSpeech() {
  // Stop any active Audio playback
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }

  // Stop any active SpeechSynthesis
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  activeUtterance = null;
}

export async function speakText(
  text: string,
  preferences?: {
    tts_provider?: string;
    voice_id?: string;
    speech_rate?: number;
    volume?: number;
  }
) {
  // Stop any currently active speech before starting new speech
  stopAllSpeech();

  const provider = preferences?.tts_provider || "browser";
  const voiceId = preferences?.voice_id || "alloy";
  const rate = preferences?.speech_rate || 1.0;
  const volume = preferences?.volume || 0.8;

  if (provider === "browser") {
    // Use browser TTS
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = rate;
      utterance.volume = volume;
      activeUtterance = utterance;
      
      return new Promise<void>((resolve) => {
        utterance.onend = () => {
          activeUtterance = null;
          resolve();
        };
        utterance.onerror = () => {
          activeUtterance = null;
          resolve();
        };
        window.speechSynthesis.speak(utterance);
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
        activeAudio = audio;
        
        await new Promise<void>((resolve, reject) => {
          audio.onended = () => {
            activeAudio = null;
            URL.revokeObjectURL(audioUrl);
            resolve();
          };
          audio.onerror = (error) => {
            activeAudio = null;
            URL.revokeObjectURL(audioUrl);
            reject(error);
          };
          audio.play().catch((error) => {
            activeAudio = null;
            URL.revokeObjectURL(audioUrl);
            reject(error);
          });
        });
      }
    } catch (error) {
      console.error("TTS error:", error);
      // Fallback to browser TTS
      if ("speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = rate;
        utterance.volume = volume;
        activeUtterance = utterance;
        
        return new Promise<void>((resolve) => {
          utterance.onend = () => {
            activeUtterance = null;
            resolve();
          };
          utterance.onerror = () => {
            activeUtterance = null;
            resolve();
          };
          window.speechSynthesis.speak(utterance);
        });
      }
    }
  }
}

// Export function to manually stop speech if needed
export function stopSpeech() {
  stopAllSpeech();
}
