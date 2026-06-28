import React, { useEffect, useState, useRef, useCallback } from 'react';
import { speakWithEmotion, silenceAll, type EmotionTone } from './audioController';
import './styles/global.css';

interface ChatMessage {
  text: string;
  sender: string;
  tone?: EmotionTone;
}

interface TriggerPayload {
  type: string;
  action: string;
  content?: string;
  mediaUrl?: string;
  payload?: {
    wpm?: number;
    videoId?: string;
  };
}

declare global {
  interface Window {
    antiCopilot: {
      onTrigger: (callback: (trigger: TriggerPayload) => void) => void;
      onCursorUpdate: (callback: (event: any, data: {x: number, y: number}) => void) => void;
      setClickThrough: (enabled: boolean) => void;
    };
  }
}

// Gossip persona names that rotate for variety
const GOSSIP_CAST = [
  { name: 'Dev_Alpha', color: 'alpha' },
  { name: 'Dev_Beta', color: 'beta' },
  { name: 'Senior_Hater', color: 'senior' },
];

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [uiState, setUiState] = useState<string>('idle');
  const [videoUrl, setVideoUrl] = useState('');
  const [isExiting, setIsExiting] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const staggerTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const chatboxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.antiCopilot && window.antiCopilot.onCursorUpdate) {
      window.antiCopilot.onCursorUpdate((_event: any, { x, y }: { x: number, y: number }) => {
        if (chatboxRef.current) {
          chatboxRef.current.style.transform = `translate3d(${x + 15}px, ${y + 15}px, 0)`;
        }
      });
    }
  }, []);

  // Cleanup all pending timers
  const clearAllTimers = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    staggerTimersRef.current.forEach(clearTimeout);
    staggerTimersRef.current = [];
  }, []);

  // Graceful exit transition before hiding
  const scheduleHide = useCallback((durationMs: number) => {
    hideTimerRef.current = setTimeout(() => {
      setIsExiting(true);
      // Allow exit animation to play, then reset
      setTimeout(() => {
        setUiState('idle');
        setMessages([]);
        setVideoUrl('');
        setIsExiting(false);
        silenceAll();
      }, 400);
    }, durationMs);
  }, []);

  useEffect(() => {
    console.log('[Anti-Copilot Renderer] App mounted, registering trigger listener...');

    if (!window.antiCopilot) {
      console.error('[Anti-Copilot Renderer] window.antiCopilot is NOT available! Preload may have failed.');
      return;
    }

    window.antiCopilot.onTrigger((trigger: TriggerPayload) => {
      console.log('[Anti-Copilot Renderer] Trigger received:', trigger);

      // Clear any lingering state
      clearAllTimers();
      silenceAll();
      setIsExiting(false);
      setMessages([]);
      setVideoUrl('');

      const { action, content, payload } = trigger;
      setUiState(action);

      // Helper to speak and incrementally reveal text synced with audio
      const speakAndRender = (fullText: string, sender: string, tone?: EmotionTone, append: boolean = false) => {
        const utterance = speakWithEmotion(fullText, action);
        
        setMessages(prev => {
          const newMsg = { text: '', sender, tone };
          return append ? [...prev, newMsg] : [newMsg];
        });

        let currentTargetIndex = 0;
        let displayedIndex = 0;

        // Smooth typewriter effect that chases the audio boundary
        const typingInterval = setInterval(() => {
          if (displayedIndex < currentTargetIndex) {
            // Type 1-2 characters per frame to feel fast but smooth
            displayedIndex = Math.min(displayedIndex + 2, currentTargetIndex, fullText.length);
            
            setMessages(prev => {
              if (prev.length === 0) return prev;
              const newMsgs = [...prev];
              newMsgs[newMsgs.length - 1].text = fullText.substring(0, displayedIndex);
              return newMsgs;
            });
          }
        }, 20);

        utterance.onboundary = (event) => {
          if (event.name === 'word') {
            let end = event.charIndex;
            // Advance past the current word
            while (end < fullText.length && /\\S/.test(fullText[end])) end++;
            // Advance past trailing punctuation/spaces to preempt the gap
            while (end < fullText.length && /[\\s.,!?]/.test(fullText[end])) end++;
            
            currentTargetIndex = end;
          }
        };

        utterance.onend = () => {
          currentTargetIndex = fullText.length; // Release the rest
          setTimeout(() => clearInterval(typingInterval), 1000);
          
          setMessages(prev => {
            if (prev.length === 0) return prev;
            const newMsgs = [...prev];
            newMsgs[newMsgs.length - 1].text = fullText;
            return newMsgs;
          });
        };
      };

      switch (action) {
        case 'mock':
        case 'demotivate': {
          const tone: EmotionTone = (payload?.wpm && payload.wpm > 100) ? 'threatened' : 'mocking';
          speakAndRender(content || '', 'Anti-Copilot', tone);
          scheduleHide(6000);
          break;
        }

        case 'gossip': {
          const chatSequence: ChatMessage[] = [
            { text: 'Hey look, he did it again...', sender: GOSSIP_CAST[0].name, tone: 'mocking' },
            { text: 'Unbelievable. Zero structural awareness.', sender: GOSSIP_CAST[1].name, tone: 'mocking' },
            { text: content || "I can't even watch anymore.", sender: GOSSIP_CAST[2].name, tone: 'exhausted' },
          ];

          chatSequence.forEach((msg, index) => {
            const timer = setTimeout(() => {
              speakAndRender(msg.text, msg.sender, msg.tone, true);
            }, index * 2000); // Increased stagger so voices don't overlap as much
            staggerTimersRef.current.push(timer);
          });

          scheduleHide(chatSequence.length * 2000 + 5000);
          break;
        }

        case 'play_video': {
          const videoId = payload?.videoId || 'dQw4w9WgXcQ';
          setVideoUrl(`https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0`);
          speakWithEmotion("Watch this. Maybe you'll learn something.", 'pause');
          scheduleHide(15000);
          break;
        }

        case 'block_window': {
          speakWithEmotion('Step away from the editor.', 'terminal_error');
          scheduleHide(8000);
          break;
        }

        case 'send_meme': {
          speakAndRender(content || 'This is you. This is literally you right now.', 'Anti-Copilot', 'mocking');
          scheduleHide(8000);
          break;
        }

        case 'force_light_mode':
        case 'flash_light_mode': {
          speakAndRender(content || 'Enjoy the sunlight.', 'Anti-Copilot', 'mocking');
          scheduleHide(6000);
          break;
        }

        default: {
          setUiState('idle');
          break;
        }
      }
    });

    console.log('[Anti-Copilot Renderer] Trigger listener registered successfully.');

    return () => {
      clearAllTimers();
      silenceAll();
    };
  }, [clearAllTimers, scheduleHide]);

  const canvasClassName = `fullscreen-canvas state-${uiState}${isExiting ? ' exiting' : ''}`;

  return (
    <div className={canvasClassName}>

      {/* Floating UI elements attached to mouse cursor */}
      {uiState !== 'block_window' && (
        <div ref={chatboxRef} className="floating-ui-container">
          
          {/* ─── State: Idle ─── */}
          {uiState === 'idle' && (
            <div className="idle-indicator">
              <span className="idle-skull">💀</span>
              <div className="idle-pulse-ring" />
            </div>
          )}

          {/* ─── State A: Chat Bubbles (mock, demotivate, gossip, force_light_mode, flash_light_mode) ─── */}
          {['mock', 'demotivate', 'gossip', 'force_light_mode', 'flash_light_mode'].includes(uiState) && (
            <div className="chatbox-container">
              <div className="chatbox-header">
                <span className="chatbox-icon">💀</span>
                <span className="chatbox-title">ANTI-COPILOT</span>
                <span className="chatbox-status">
                  <span className="status-dot" />
                  LIVE
                </span>
              </div>
              <div className="chatbox-messages">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`chat-bubble sender-${
                      msg.sender === GOSSIP_CAST[0].name ? 'alpha' :
                      msg.sender === GOSSIP_CAST[1].name ? 'beta' :
                      msg.sender === GOSSIP_CAST[2].name ? 'senior' :
                      'hater'
                    }`}
                    style={{ animationDelay: `${i * 0.1}s` }}
                  >
                    <span className="sender-tag">{msg.sender}</span>
                    <p className="bubble-text">{msg.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── State B: Meme Card ─── */}
          {uiState === 'send_meme' && (
            <div className="chatbox-container">
              <div className="chatbox-header">
                <span className="chatbox-icon">🖼️</span>
                <span className="chatbox-title">SHAME GALLERY</span>
              </div>
              <div className="meme-card">
                <img
                  src="https://i.imgflip.com/1g8my4.jpg"
                  alt="Meme"
                  className="meme-image"
                />
                {messages[0] && (
                  <p className="meme-caption">{messages[0].text}</p>
                )}
              </div>
            </div>
          )}

          {/* ─── State C: Video Interruption ─── */}
          {uiState === 'play_video' && (
            <div className="video-player-overlay">
              <div className="video-chrome">
                <div className="video-header">
                  <span className="chatbox-icon">📺</span>
                  <span className="chatbox-title">MANDATORY VIEWING</span>
                </div>
                <iframe
                  src={videoUrl}
                  title="Distraction Engine"
                  allow="autoplay; encrypted-media"
                  className="video-iframe"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── State D: Full Blocking Screen Punishment ─── */}
      {uiState === 'block_window' && (
        <div className="brutal-blocker">
          <div className="blocker-content">
            <div className="blocker-icon-ring">
              <span className="blocker-icon">🛑</span>
            </div>
            <h1 className="blocker-title">ACCESS SUSPENDED</h1>
            <div className="blocker-divider" />
            <p className="blocker-message">
              Your typing profile indicates a critical lack of foresight.
              <br />Please review your life choices.
            </p>
            <div className="blocker-timer-bar">
              <div className="blocker-timer-fill" />
            </div>
          </div>
          <div className="blocker-scanlines" />
        </div>
      )}
    </div>
  );
}
