// Simple audio utility to handle beeps and base64 playback

let audioContext: AudioContext | null = null;

const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
};

// Generic envelope helper
const playTone = (freq: number, type: OscillatorType, startTime: number, duration: number, vol = 0.1) => {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.value = freq;
    
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(vol, startTime + 0.01); // Fast attack
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    
    osc.stop(startTime + duration);
};

export const playBeep = (freq = 800, type: OscillatorType = 'sine', duration = 0.1) => {
  try {
    const ctx = getAudioContext();
    playTone(freq, type, ctx.currentTime, duration, 0.1);
  } catch (e) {
    console.error("Audio play failed", e);
  }
};

export const playStartBeep = () => {
  // TRENDY 2025 SOUND: "Digital Chime" (Positive A-Major Chord)
  // Replaces the old harsh beep with a harmonious, energetic start signal
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    // Play a quick chord (Root, 3rd, 5th)
    // A5 (880Hz)
    playTone(880, 'triangle', now, 0.6, 0.2); 
    // C#6 (1108Hz)
    playTone(1108.73, 'triangle', now, 0.6, 0.15);
    // E6 (1318Hz)
    playTone(1318.51, 'triangle', now, 0.6, 0.15);
    
    // Add a subtle high-pitch sparkle for "glassy" effect
    playTone(1760, 'sine', now, 0.2, 0.05);

  } catch (e) {
    console.error("Modern beep failed", e);
    playBeep(880, 'square', 0.2);
  }
};

export const playRestBeep = () => {
  // "Glass Bell" - Bright, ringing, but distinct from the Start chord
  // Uses a higher pitch interval (E6 + G#6) to cut through
  try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;
      
      // E6 (1318Hz) - High Triangle
      playTone(1318.51, 'triangle', now, 0.5, 0.15);
      
      // G#6 (1661Hz) - Major 3rd above, creates a bright happy "Ding"
      playTone(1661.22, 'triangle', now, 0.5, 0.12);
      
      // Subtle sine overtone for clarity
      playTone(2637, 'sine', now, 0.3, 0.05);

  } catch (e) {
      playBeep(1318, 'sine', 0.3);
  }
};

export const playAudioFromBase64 = (base64String: string) => {
  try {
    const ctx = getAudioContext();
    const base64Content = base64String.includes(',') ? base64String.split(',')[1] : base64String;
    const binaryString = window.atob(base64Content);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    ctx.decodeAudioData(bytes.buffer, (buffer) => {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    }, (err) => console.error("Error decoding audio", err));
  } catch (e) {
    console.error("Error playing base64 audio", e);
  }
};

export const speakText = (text: string) => {
  if (!('speechSynthesis' in window)) {
    console.warn("Text-to-speech not supported");
    return;
  }
  
  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ru-RU'; 
  utterance.rate = 1.0;     // Normal speed sounds more natural than 1.1
  utterance.pitch = 1.0;

  // Get available voices
  const voices = window.speechSynthesis.getVoices();
  
  // Filter for Russian voices
  const ruVoices = voices.filter(v => v.lang.includes('ru') || v.lang.includes('RU'));
  
  // Heuristic to pick the best "Human-like" voice available on the system
  // 1. Google voices (usually high quality neural on Android/Chrome)
  // 2. Premium/Enhanced voices (often available on iOS/macOS)
  // 3. Microsoft voices (high quality on Windows)
  // 4. Fallback to any Russian voice
  const preferredVoice = ruVoices.find(v => v.name.includes('Google')) || 
                         ruVoices.find(v => v.name.includes('Premium')) ||
                         ruVoices.find(v => v.name.includes('Enhanced')) ||
                         ruVoices.find(v => v.name.includes('Microsoft')) || 
                         ruVoices.find(v => v.name.includes('Milena')) ||
                         ruVoices[0];

  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }

  window.speechSynthesis.speak(utterance);
};