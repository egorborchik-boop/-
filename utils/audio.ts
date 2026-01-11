// Simple audio utility to handle beeps and base64 playback

let audioContext: AudioContext | null = null;

const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
};

// EXPLICIT UNLOCK FOR IOS
export const initAudio = () => {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
  // Play a silent buffer to wake up the audio engine on iOS
  const buffer = ctx.createBuffer(1, 1, 22050);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(0);
};

// Generic envelope helper
const playTone = (freq: number, type: OscillatorType, startTime: number, duration: number, vol = 0.5) => {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.value = freq;
    
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    gain.gain.setValueAtTime(0, startTime);
    
    // VOLUME SUPER-BOOST
    // We are multiplying the intended volume by 10.0 to act as a hard limiter/maximizer
    // This ensures maximum loudness on mobile devices, even if it introduces slight saturation.
    const boostedVol = vol * 10.0; 

    gain.gain.linearRampToValueAtTime(boostedVol, startTime + 0.01); // Fast attack
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    
    osc.stop(startTime + duration);
};

export const playBeep = (freq = 800, type: OscillatorType = 'sine', duration = 0.1) => {
  try {
    const ctx = getAudioContext();
    // Ensure running
    if (ctx.state === 'suspended') ctx.resume();

    // Increased default volume base
    playTone(freq, type, ctx.currentTime, duration, 0.5);
  } catch (e) {
    console.error("Audio play failed", e);
  }
};

export const playStartBeep = () => {
  // TRENDY 2025 SOUND: "Digital Chime" (Positive A-Major Chord)
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    
    const now = ctx.currentTime;
    
    // Play a quick chord (Root, 3rd, 5th)
    // Volumes passed here will be multiplied by 10 in playTone
    playTone(880, 'triangle', now, 0.6, 0.7); 
    playTone(1108.73, 'triangle', now, 0.6, 0.6);
    playTone(1318.51, 'triangle', now, 0.6, 0.6);
    
    // Sparkle
    playTone(1760, 'sine', now, 0.2, 0.3);

  } catch (e) {
    console.error("Modern beep failed", e);
    playBeep(880, 'square', 0.5);
  }
};

export const playRestBeep = () => {
  // "Glass Bell" - Bright, ringing
  try {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;
      
      // Volumes passed here will be multiplied by 10 in playTone
      playTone(1318.51, 'triangle', now, 0.5, 0.8);
      playTone(1661.22, 'triangle', now, 0.5, 0.6);
      playTone(2637, 'sine', now, 0.3, 0.4);

  } catch (e) {
      playBeep(1318, 'sine', 0.5);
  }
};

export const playAudioFromBase64 = (base64String: string) => {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    const base64Content = base64String.includes(',') ? base64String.split(',')[1] : base64String;
    const binaryString = window.atob(base64Content);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    ctx.decodeAudioData(bytes.buffer, (buffer) => {
      const source = ctx.createBufferSource();
      const gainNode = ctx.createGain();
      
      source.buffer = buffer;
      
      // REDUCED BOOST for recorded audio: 5.0 (was 30.0)
      // 30.0 was causing significant clipping/interference. 
      // 5.0 still provides a good boost over raw audio.
      gainNode.gain.value = 5.0; 
      
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
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
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0; // Max volume allowed by API

  // Get available voices
  const voices = window.speechSynthesis.getVoices();
  
  // Filter for Russian voices
  const ruVoices = voices.filter(v => v.lang.includes('ru') || v.lang.includes('RU'));
  
  // Heuristic to pick the best "Human-like" voice
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