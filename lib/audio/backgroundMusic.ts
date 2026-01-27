// Background music manager for workouts
// Keeps Media Session API active for headphone button detection
//
// To add your own music file:
// 1. Place an audio file (MP3, OGG, etc.) in the /public folder as "workout-music.mp3"
// 2. The app will automatically use it instead of the generated ambient tone
// 3. If the file is not found, it falls back to a quiet ambient tone
// 4. Recommended: Use royalty-free music or music you have rights to use
//    - Sources: Free Music Archive, Incompetech, Bensound, or create your own
//    - Format: MP3 is most compatible, but OGG/WAV also work
//    - Length: Any length - it will loop automatically

let backgroundAudio: HTMLAudioElement | null = null;
let audioContext: AudioContext | null = null;
let oscillator: OscillatorNode | null = null;
let gainNode: GainNode | null = null;
let isPlaying = false;

/**
 * Generate a simple ambient tone using Web Audio API
 * This creates a very quiet background loop that keeps Media Session active
 */
function createAmbientTone(): {
  audio: HTMLAudioElement;
  audioContext: AudioContext;
  oscillator: OscillatorNode;
  gainNode: GainNode;
} {
  // Create audio context
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  // Create oscillator for ambient tone
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  // Very quiet ambient tone (almost inaudible)
  osc.frequency.value = 60; // Low frequency, less noticeable
  osc.type = "sine";
  gain.gain.value = 0.005; // Very quiet - just enough to keep session active
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  // Create HTML audio element for Media Session API
  const audio = new Audio();
  // Use a data URL for a very short silent audio that loops
  audio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
  audio.loop = true;
  audio.volume = 0.005; // Very quiet
  
  return { audio, audioContext: ctx, oscillator: osc, gainNode: gain };
}

/**
 * Start background music/audio to keep Media Session active
 * @param useFile - If true, try to load from /public/workout-music.mp3, otherwise use generated tone
 */
export function startBackgroundMusic(useFile = false): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isPlaying) {
      resolve();
      return;
    }

    if (useFile) {
      // Try to load actual music file from public folder
      const audio = new Audio("/workout-music.mp3");
      audio.loop = true;
      audio.volume = 0.15; // Lower volume for actual music
      
      audio.addEventListener("loadeddata", () => {
        audio.play()
          .then(() => {
            backgroundAudio = audio;
            isPlaying = true;
            
            // Set up Media Session
            if ("mediaSession" in navigator) {
              try {
                navigator.mediaSession.playbackState = "playing";
                navigator.mediaSession.metadata = new MediaMetadata({
                  title: "Workout Session",
                  artist: "Background Music",
                  album: "Active Workout",
                });
              } catch (error) {
                console.error("Error setting up media session:", error);
              }
            }
            
            resolve();
          })
          .catch((error) => {
            console.warn("Could not play music file, falling back to ambient tone:", error);
            // Fallback to ambient tone
            startBackgroundMusic(false).then(resolve).catch(reject);
          });
      });
      
      audio.addEventListener("error", () => {
        console.warn("Music file not found, falling back to ambient tone");
        startBackgroundMusic(false).then(resolve).catch(reject);
      });
    } else {
      // Use generated ambient tone
      try {
        const { audio, audioContext: ctx, oscillator: osc, gainNode: gain } = createAmbientTone();
        
        // Start oscillator
        osc.start();
        
        // Start HTML audio element
        audio.play().catch((error) => {
          console.error("Error playing background audio:", error);
          reject(error);
          return;
        });
        
        backgroundAudio = audio;
        audioContext = ctx;
        oscillator = osc;
        gainNode = gain;
        isPlaying = true;
        
        // Set up Media Session
        if ("mediaSession" in navigator) {
          try {
            navigator.mediaSession.playbackState = "playing";
            navigator.mediaSession.metadata = new MediaMetadata({
              title: "Workout Session",
              artist: "Active",
              album: "Background Audio",
            });
          } catch (error) {
            console.error("Error setting up media session:", error);
          }
        }
        
        resolve();
      } catch (error) {
        console.error("Error creating ambient tone:", error);
        reject(error);
      }
    }
  });
}

/**
 * Stop background music
 */
export function stopBackgroundMusic(): void {
  if (!isPlaying) return;
  
  // Stop HTML audio
  if (backgroundAudio) {
    backgroundAudio.pause();
    backgroundAudio.currentTime = 0;
    backgroundAudio.src = "";
    backgroundAudio = null;
  }
  
  // Stop oscillator
  if (oscillator) {
    try {
      oscillator.stop();
    } catch (error) {
      // Ignore errors if already stopped
    }
    oscillator = null;
  }
  
  // Close audio context
  if (audioContext) {
    audioContext.close().catch(() => {
      // Ignore errors
    });
    audioContext = null;
  }
  
  gainNode = null;
  isPlaying = false;
  
  // Clear Media Session
  if ("mediaSession" in navigator) {
    try {
      navigator.mediaSession.playbackState = "none";
      navigator.mediaSession.metadata = null;
    } catch (error) {
      // Ignore errors
    }
  }
}

/**
 * Pause background music (for workout pause)
 */
export function pauseBackgroundMusic(): void {
  if (backgroundAudio && isPlaying) {
    backgroundAudio.pause();
    if ("mediaSession" in navigator) {
      try {
        navigator.mediaSession.playbackState = "paused";
      } catch (error) {
        // Ignore errors
      }
    }
  }
}

/**
 * Resume background music (for workout resume)
 */
export function resumeBackgroundMusic(): void {
  if (backgroundAudio && isPlaying) {
    backgroundAudio.play().catch((error) => {
      console.error("Error resuming background music:", error);
    });
    if ("mediaSession" in navigator) {
      try {
        navigator.mediaSession.playbackState = "playing";
      } catch (error) {
        // Ignore errors
      }
    }
  }
}

/**
 * Check if background music is playing
 */
export function isBackgroundMusicPlaying(): boolean {
  return isPlaying;
}
