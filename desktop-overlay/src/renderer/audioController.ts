/**
 * audioController.ts
 * High-Emotion Speech Engine for Anti-Copilot "The Prodigy"
 */

export type EmotionTone = 'threatened' | 'exhausted' | 'mocking' | 'default' | 'sad';

// The Prodigy (Kid Persona)
const PRODIGY_VOICE_FRAGMENTS = [
  'Google UK English Female',
  'Microsoft Zira',
  'Samantha',
  'Microsoft Mark'
];

// The Mom (Parental Override)
const MOM_VOICE_FRAGMENTS = [
  'Google US English Female',
  'Microsoft Hazel',
  'Microsoft Zira',
  'Victoria'
];

let prodigyVoice: SpeechSynthesisVoice | null = null;
let momVoice: SpeechSynthesisVoice | null = null;

function loadVoices() {
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return;

  for (const fragment of PRODIGY_VOICE_FRAGMENTS) {
    const match = voices.find(v => v.name.includes(fragment));
    if (match) {
      prodigyVoice = match;
      break;
    }
  }

  for (const fragment of MOM_VOICE_FRAGMENTS) {
    const match = voices.find(v => v.name.includes(fragment) && v !== prodigyVoice);
    if (match) {
      momVoice = match;
      break;
    }
  }

  if (!prodigyVoice) prodigyVoice = voices.find(v => v.lang.startsWith('en')) || voices[0];
  if (!momVoice) momVoice = voices.find(v => v.lang.startsWith('en') && v !== prodigyVoice) || voices[0];
}

loadVoices();
if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

export function speakWithEmotion(
  text: string,
  isMom: boolean = false,
  pitchOverride?: number
): SpeechSynthesisUtterance {
  const utterance = new SpeechSynthesisUtterance(text);

  if (isMom) {
    utterance.voice = momVoice || loadVoices() || null;
    utterance.rate = 1.0;
    utterance.pitch = 0.8;
  } else {
    utterance.voice = prodigyVoice || loadVoices() || null;
    utterance.rate = 1.3; 
    utterance.pitch = pitchOverride ?? 1.6; 
  }

  setTimeout(() => {
    window.speechSynthesis.speak(utterance);
  }, 50);

  return utterance;
}

export function silenceAll(): void {
  window.speechSynthesis.cancel();
}
