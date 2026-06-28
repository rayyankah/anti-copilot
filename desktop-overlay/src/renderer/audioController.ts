/**
 * audioController.ts
 * High-Emotion Speech Engine for Anti-Copilot
 * 
 * Selects the most cynical-sounding voice available on the host OS
 * and dynamically alternates tone values depending on emotional state.
 */

export type EmotionTone = 'threatened' | 'exhausted' | 'mocking' | 'default';

// Preferred voice name fragments, ordered by cynical condescension potential
const PREFERRED_VOICE_FRAGMENTS = [
  'Google UK English Male',
  'Microsoft Mark',         // Windows deep male
  'Microsoft George',       // Windows UK male
  'Daniel',                 // macOS UK male
  'Google UK English Female',
  'Microsoft Zira',         // Windows female — flat delivery
  'Natural',                // Any "Natural" variant (Win 11+)
  'Samantha',               // macOS fallback
];

let cachedVoice: SpeechSynthesisVoice | null = null;

/**
 * Pre-load and cache the best available voice.
 * Voices are loaded asynchronously in Chromium, so we listen for the
 * voiceschanged event and cache the result immediately.
 */
function loadBestVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  // Try each preferred fragment in priority order
  for (const fragment of PREFERRED_VOICE_FRAGMENTS) {
    const match = voices.find(v => v.name.includes(fragment));
    if (match) {
      console.log(`[AudioController] Selected voice: "${match.name}" (${match.lang})`);
      return match;
    }
  }

  // Fallback: pick any English voice
  const englishFallback = voices.find(v => v.lang.startsWith('en'));
  if (englishFallback) {
    console.log(`[AudioController] English fallback voice: "${englishFallback.name}"`);
    return englishFallback;
  }

  // Absolute fallback
  console.log(`[AudioController] Using default voice: "${voices[0].name}"`);
  return voices[0];
}

// Eagerly attempt to load, and also subscribe to the async event
cachedVoice = loadBestVoice();
if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = loadBestVoice();
  };
}

/**
 * Speak text with emotional inflection.
 * 
 * @param text - The roast / gossip / insult to deliver
 * @param tone - Emotional context that shapes delivery cadence
 * @returns The SpeechSynthesisUtterance (for chaining or event listeners)
 */
export function speakWithEmotion(
  text: string,
  triggerType: string = 'default'
): SpeechSynthesisUtterance {
  const utterance = new SpeechSynthesisUtterance(text);

  // Use cached voice or try to load again
  const voice = cachedVoice || loadBestVoice();
  if (voice) {
    utterance.voice = voice;
  }

  // Apply psychological adjustments based on state context
  switch (triggerType) {
    case 'code':
    case 'force_light_mode':
      // Typing fast -> Threatened/Aggressive
      utterance.rate = 1.25;
      utterance.pitch = 1.1;
      utterance.volume = 1.0;
      break;

    case 'pause':
    case 'play_video':
      // Paused -> Slow, Exhausted Sigh
      utterance.rate = 0.85;
      utterance.pitch = 0.8;
      utterance.volume = 0.85;
      break;

    case 'terminal_error':
    case 'block_window':
      // Error -> Mocking, slightly elevated
      utterance.rate = 1.05;
      utterance.pitch = 1.2;
      utterance.volume = 0.95;
      break;

    case 'flash_light_mode':
      // Power Rangers high-energy personality
      utterance.rate = 1.25;
      utterance.pitch = 1.3;
      utterance.volume = 1.0;
      break;

    case 'mock':
    case 'demotivate':
    case 'gossip':
    default:
      // Standard dry sarcasm
      utterance.rate = 1.0;
      utterance.pitch = 0.9;
      utterance.volume = 0.95;
      break;
  }

  // Wrap in a tiny timeout to avoid the cancel() -> speak() collision bug in Chromium
  setTimeout(() => {
    window.speechSynthesis.speak(utterance);
    console.log(`[AudioController] Speaking (${triggerType}): "${text.substring(0, 60)}..."`);
  }, 50);

  return utterance;
}

/**
 * Immediately silence any ongoing speech.
 */
export function silenceAll(): void {
  window.speechSynthesis.cancel();
}
