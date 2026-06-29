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
  avatarEmotion?: string;
  persona?: string;
  payload?: {
    wpm?: number;
    videoId?: string;
  };
}

interface RobotState {
  behavioralState: string;
  personality: {
    mood: number;
    curiosity: number;
    boredom: number;
    confidence: number;
    attachment: number;
    energy: number;
  };
  avatarEmotion: string;
  isIdle: boolean;
}

declare global {
  interface Window {
    antiCopilot: {
      onTrigger: (callback: (trigger: TriggerPayload) => void) => void;
      onCursorUpdate: (callback: (event: any, data: {x: number, y: number}) => void) => void;
      setClickThrough: (enabled: boolean) => void;
      onRobotStateUpdate: (callback: (state: RobotState) => void) => void;
      onAgentAction: (callback: (action: any) => void) => void;
    };
  }
}

// Gossip persona names
const GOSSIP_CAST = [
  { name: 'Dev_Alpha', color: 'alpha' },
  { name: 'Dev_Beta', color: 'beta' },
  { name: 'Senior_Hater', color: 'senior' },
];

// ─── Robot Face ASCII Art by emotion ───
const ROBOT_FACES: Record<string, string> = {
  neutral:    '[  ◉ ‿ ◉  ]',
  smug:       '[  ◉ ⌣ ◉  ]',
  disgusted:  '[  ◉ ᗝ ◉  ]',
  gleeful:    '[  ◉ ▽ ◉  ]',
  bored:      '[  ◉ _ ◉  ]',
  angry:      '[  ◉ ╭╮ ◉ ]',
  threatened: '[  ◉ △ ◉  ]',
  curious:    '[  ◉ ○ ◉  ]',
};

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [uiState, setUiState] = useState<string>('idle');
  const [currentAction, setCurrentAction] = useState<any>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [isExiting, setIsExiting] = useState(false);
  const [robotState, setRobotState] = useState<RobotState>({
    behavioralState: 'normal',
    personality: { mood: 0.3, curiosity: 0.5, boredom: 0, confidence: 0.7, attachment: 0.2, energy: 0.8 },
    avatarEmotion: 'neutral',
    isIdle: true,
  });
  const [robotBlink, setRobotBlink] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const staggerTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const chatboxRef = useRef<HTMLDivElement>(null);

  // ─── Cursor tracking ───
  useEffect(() => {
    if (window.antiCopilot?.onCursorUpdate) {
      window.antiCopilot.onCursorUpdate((_event: any, { x, y }: { x: number, y: number }) => {
        if (chatboxRef.current) {
          chatboxRef.current.style.transform = `translate3d(${x + 15}px, ${y + 15}px, 0)`;
        }
      });
    }
  }, []);

  // ─── Robot blink timer ───
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setRobotBlink(true);
      setTimeout(() => setRobotBlink(false), 150);
    }, 3000 + Math.random() * 4000);
    return () => clearInterval(blinkInterval);
  }, []);

  // ─── Robot state listener ───
  useEffect(() => {
    if (window.antiCopilot?.onRobotStateUpdate) {
      window.antiCopilot.onRobotStateUpdate((state: RobotState) => {
        setRobotState(state);
      });
    }
  }, []);

  const clearAllTimers = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    staggerTimersRef.current.forEach(clearTimeout);
    staggerTimersRef.current = [];
  }, []);

  const scheduleHide = useCallback((durationMs: number) => {
    hideTimerRef.current = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => {
        setUiState('idle');
        setMessages([]);
        setVideoUrl('');
        setIsExiting(false);
        silenceAll();
      }, 400);
    }, durationMs);
  }, []);

  // ─── Main trigger listener ───
  useEffect(() => {
    if (!window.antiCopilot) return;

    window.antiCopilot.onTrigger((trigger: TriggerPayload) => {
      const { action, content, payload } = trigger;

      if (action === 'idle' || action === 'do_nothing' || action === 'stay_silent') return;

      clearAllTimers();
      silenceAll();
      setIsExiting(false);
      setMessages([]);
      setVideoUrl('');
      setCurrentAction(trigger);
      setUiState(action);

      const speakAndRender = (fullText: string, sender: string, tone?: EmotionTone, append: boolean = false) => {
        const utterance = speakWithEmotion(fullText, action);
        
        setMessages(prev => {
          const newMsg = { text: '', sender, tone };
          return append ? [...prev, newMsg] : [newMsg];
        });

        let currentTargetIndex = 0;
        let displayedIndex = 0;

        const typingInterval = setInterval(() => {
          if (displayedIndex < currentTargetIndex) {
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
            while (end < fullText.length && /\S/.test(fullText[end])) end++;
            while (end < fullText.length && /[\s.,!?]/.test(fullText[end])) end++;
            currentTargetIndex = end;
          }
        };

        utterance.onend = () => {
          currentTargetIndex = fullText.length;
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
            }, index * 2000);
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
          speakAndRender(content || 'This is you right now.', 'Anti-Copilot', 'mocking');
          scheduleHide(8000);
          break;
        }

        case 'force_light_mode':
        case 'flash_light_mode': {
          speakAndRender(content || 'Enjoy the sunlight.', 'The Prodigy', 'mocking');
          scheduleHide(6000);
          break;
        }

        case 'speak_roast': {
          speakAndRender(content || '', 'The Prodigy', 'mocking', false);
          scheduleHide(8000);
          break;
        }

        case 'trigger_tantrum': {
          speakAndRender(content || "I'M BORED! THIS CODE IS TRASH!", 'The Prodigy', 'mocking', false);
          scheduleHide(3000);
          break;
        }

        case 'flash_theme_strobe': {
          speakAndRender(content || "WEEE WOOO STOP CODING!", 'The Prodigy', 'mocking', false);
          scheduleHide(4000);
          break;
        }

        case 'trigger_peekaboo': {
          speakAndRender(content || "Let me see!", 'The Prodigy', 'mocking', false);
          scheduleHide(4000);
          break;
        }

        case 'play_brainrot': {
          setVideoUrl('https://www.youtube.com/embed/n_Dv4JMiwK8?autoplay=1&controls=0&mute=1');
          speakAndRender(content || "Here's Subway Surfers.", 'The Prodigy', 'mocking', false);
          scheduleHide(15000);
          break;
        }

        case 'parental_override': {
          speakAndRender(content || "Timmy! Get off that computer!", 'Mom', 'exhausted', false);
          setTimeout(() => {
            speakWithEmotion("Hold on Mom!", false);
          }, 4500);
          scheduleHide(10000);
          break;
        }

        case 'critique_code_semantics': {
          speakAndRender(content || '', 'Code Review', 'mocking', false);
          scheduleHide(10000);
          break;
        }

        case 'block_code_view': {
          speakAndRender(content || "Access Denied.", 'The Prodigy', 'mocking', false);
          // @ts-ignore
          const duration = trigger.durationSeconds ? trigger.durationSeconds * 1000 : 8000;
          window.antiCopilot.setClickThrough(false);
          setTimeout(() => window.antiCopilot.setClickThrough(true), duration);
          scheduleHide(duration);
          break;
        }

        default: {
          setUiState('idle');
          break;
        }
      }
    });

    return () => {
      clearAllTimers();
      silenceAll();
    };
  }, [clearAllTimers, scheduleHide]);

  // ─── Robot status text ───
  const getRobotStatusText = () => {
    const { behavioralState, personality } = robotState;
    if (behavioralState === 'frustrated') return 'DETECTING: FRUSTRATION';
    if (behavioralState === 'manic') return 'WARNING: MANIC TYPING';
    if (behavioralState === 'stagnant') return 'STATUS: AFK DETECTED';
    if (behavioralState === 'clueless') return 'ALERT: CTRL+V ABUSE';
    if (behavioralState === 'arrogant') return 'THREAT LEVEL: ELEVATED';
    if (personality.boredom > 0.7) return 'STATUS: BORED...';
    return 'C:\\MONITORING..._';
  };

  const robotFace = ROBOT_FACES[robotState.avatarEmotion] || ROBOT_FACES.neutral;
  const canvasClassName = `fullscreen-canvas state-${uiState}${isExiting ? ' exiting' : ''}`;

  return (
    <div className={canvasClassName}>

      {/* ═══ ALWAYS-VISIBLE RETRO ROBOT WIDGET ═══ */}
      <div className={`retro-robot-widget robot-state-${robotState.behavioralState}`}>
        <div className="robot-titlebar">
          <span className="robot-titlebar-text">ANTI-COPILOT.EXE</span>
          <span className="robot-titlebar-buttons">
            <span className="tb-btn">_</span>
            <span className="tb-btn">□</span>
            <span className="tb-btn">×</span>
          </span>
        </div>
        <div className="robot-body">
          <div className={`robot-avatar ${robotBlink ? 'blink' : ''}`}>
            <pre className="robot-face">{robotFace}</pre>
            <div className="robot-scanline" />
          </div>
          <div className="robot-status-bar">
            <span className="robot-status-text">{getRobotStatusText()}</span>
            <span className="robot-status-indicator" data-state={robotState.behavioralState} />
          </div>
        </div>
      </div>

      {/* ═══ FLOATING UI (action overlays attached to cursor) ═══ */}
      {uiState !== 'block_window' && (
        <div ref={chatboxRef} className="floating-ui-container">
          
          {/* ─── Idle: no floating element ─── */}

          {/* ─── Chat Bubbles ─── */}
          {['mock', 'demotivate', 'gossip', 'force_light_mode', 'flash_light_mode'].includes(uiState) && (
            <div className="chatbox-container">
              <div className="chatbox-header">
                <span className="chatbox-icon">🤖</span>
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

          {/* ─── Meme Card ─── */}
          {uiState === 'send_meme' && (
            <div className="chatbox-container">
              <div className="chatbox-header">
                <span className="chatbox-icon">🤖</span>
                <span className="chatbox-title">SHAME.BMP</span>
              </div>
              <div className="meme-card">
                <img src="https://i.imgflip.com/1g8my4.jpg" alt="Meme" className="meme-image" />
                {messages[0] && <p className="meme-caption">{messages[0].text}</p>}
              </div>
            </div>
          )}

          {/* ─── Video Interruption ─── */}
          {uiState === 'play_video' && (
            <div className="video-player-overlay">
              <div className="video-chrome">
                <div className="video-header">
                  <span className="chatbox-icon">🤖</span>
                  <span className="chatbox-title">MANDATORY.AVI</span>
                </div>
                <iframe src={videoUrl} title="Distraction" allow="autoplay; encrypted-media" className="video-iframe" />
              </div>
            </div>
          )}

          {/* ─── Roast / Tantrum / Strobe / Block chat bubbles ─── */}
          {['speak_roast', 'trigger_tantrum', 'flash_theme_strobe', 'block_code_view'].includes(uiState) && (
            <div className="chatbox-container">
              <div className="chatbox-header prodigy-header">
                <span className="chatbox-icon">🤖</span>
                <span className="chatbox-title">{'C:\\PRODIGY.EXE'}</span>
              </div>
              <div className="chat-bubble sender-prodigy">
                {messages[0] && <p className="bubble-text">{messages[0].text}</p>}
              </div>
            </div>
          )}

          {/* ─── Brainrot Video ─── */}
          {uiState === 'play_brainrot' && (
            <div className="video-player-overlay">
              <div className="video-chrome prodigy-header">
                <span className="chatbox-title">BRAINROT.AVI - Media Player</span>
              </div>
              <iframe
                src="https://www.youtube.com/embed/n_Dv4JMiwK8?autoplay=1&controls=0&mute=1"
                title="Subway Surfers" allow="autoplay; encrypted-media" className="video-iframe"
              />
              {messages[0] && (
                <div className="subtitle-overlay" style={{ marginTop: '10px', backgroundColor: 'rgba(0,0,0,0.8)', padding: '10px', borderRadius: '8px', color: '#fff', fontSize: '1.2em' }}>
                  {messages[0].text}
                </div>
              )}
            </div>
          )}

          {/* ─── Critique Dashboard ─── */}
          {uiState === 'critique_code_semantics' && (
            <div className="critique-dashboard">
              <div className="critique-header">
                <span className="critique-icon">🤖</span> SCAN.EXE — CODE VIOLATION
              </div>
              <div className="critique-bad-code">
                {/* @ts-ignore */}
                <pre><code>{currentAction?.highlight_target || 'function makeBadChoices() {}'}</code></pre>
              </div>
              <div className="critique-roast-text">
                {messages[0]?.text || 'This code is garbage.'}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Peekaboo ─── */}
      {uiState === 'trigger_peekaboo' && (
        <div className="peekaboo-container">
          <div className="peekaboo-face">
            <span className="peekaboo-emoji">🤖</span>
            <div className="peekaboo-text">{'C:\\>QUERY: ARE WE DONE YET?_'}</div>
          </div>
          {messages[0] && (
            <div className="subtitle-overlay" style={{ position: 'absolute', bottom: '20%', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(0,0,0,0.8)', padding: '15px 30px', borderRadius: '12px', color: '#fff', fontSize: '2em', fontWeight: 'bold' }}>
              {messages[0].text}
            </div>
          )}
        </div>
      )}

      {/* ─── Parental Override ─── */}
      {uiState === 'parental_override' && (
        <div className="parental-override">
          <div className="facetime-ui">
            <div className="ft-caller">Mom</div>
            <div className="ft-type">FaceTime Audio...</div>
            <div className="ft-buttons">
              <div className="ft-btn decline"><span>&#128222;</span><p>Decline</p></div>
              <div className="ft-btn accept"><span>&#128222;</span><p>Accept</p></div>
            </div>
          </div>
          {messages[0] && (
            <div className="subtitle-overlay" style={{ position: 'absolute', bottom: '10%', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(0,0,0,0.8)', padding: '15px 30px', borderRadius: '12px', color: '#fff', fontSize: '1.5em' }}>
              {messages[0].text}
            </div>
          )}
        </div>
      )}

      {/* ─── Full Blocking Screen ─── */}
      {uiState === 'block_window' && (
        <div className="brutal-blocker">
          <div className="blocker-content">
            <div className="blocker-icon-ring">
              <span className="blocker-icon">🤖</span>
            </div>
            <h1 className="blocker-title">*** FATAL ERROR ***</h1>
            <div className="blocker-divider" />
            <p className="blocker-message">
              A fatal exception 0E has occurred in your code at 0028:C0034B03.
              <br />The current application will be terminated.
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
