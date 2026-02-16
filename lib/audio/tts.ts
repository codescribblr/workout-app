// Global speech manager to ensure only one voice speaks at a time
let activeAudio: HTMLAudioElement | null = null;
let activeUtterance: SpeechSynthesisUtterance | null = null;

// Sequence number so late completions (e.g. delayed "manual input" after user already saved)
// never play over a newer announcement (e.g. rest period)
let speakSequence = 0;

function stopAllSpeech() {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }
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
  stopAllSpeech();
  const mySeq = ++speakSequence;

  const provider = preferences?.tts_provider || "browser";
  const voiceId = preferences?.voice_id || "alloy";
  const rate = preferences?.speech_rate || 1.0;
  const volume = preferences?.volume || 0.8;

  const stillCurrent = () => mySeq === speakSequence;

  if (provider === "browser") {
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
        if (stillCurrent()) window.speechSynthesis.speak(utterance);
        else resolve();
      });
    }
    return;
  }

  try {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice: voiceId }),
    });

    if (!stillCurrent()) return;

    if (response.ok) {
      const blob = await response.blob();
      if (!stillCurrent()) return;
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
        if (stillCurrent()) {
          audio.play().catch((error) => {
            activeAudio = null;
            URL.revokeObjectURL(audioUrl);
            reject(error);
          });
        } else {
          activeAudio = null;
          URL.revokeObjectURL(audioUrl);
          resolve();
        }
      });
    }
  } catch (error) {
    console.error("TTS error:", error);
    if (!stillCurrent()) return;
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
        if (stillCurrent()) window.speechSynthesis.speak(utterance);
        else resolve();
      });
    }
  }
}

// Export function to manually stop speech if needed
export function stopSpeech() {
  stopAllSpeech();
}
