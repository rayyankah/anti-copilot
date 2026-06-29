import React, { useEffect, useState, useRef, useCallback } from 'react';
import { speakWithEmotion, silenceAll, type EmotionTone } from './audioController';
import { fetchMemeGif } from './giphy';
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
  gremlinState: string;
  personality: {
    mood: number;
    curiosity: number;
    boredom: number;
    confidence: number;
    attachment: number;
    energy: number;
    chaos: number;
    annoyance: number;
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
      onDebug: (callback: (log: any) => void) => void;
      sendUserReaction: (reaction: string) => void;
      quitApp: () => void;
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
  sad:        '[  ◔ ︵ ◔  ]',
  devastated: '[  ╥ ﹏ ╥  ]',
};

// ─── Fight-back reaction buttons ───
const FIGHTBACK_BUTTONS: { reaction: string; label: string }[] = [
  { reaction: 'shut_up',     label: 'SHUT UP' },
  { reaction: 'youre_right', label: "YOU'RE RIGHT" },
  { reaction: 'apologize',   label: 'SORRY' },
  { reaction: 'destroy',     label: '☠ DESTROY' },
];

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [uiState, setUiState] = useState<string>('idle');
  const uiStateRef = useRef('idle'); // For the cursor listener
  const [clickedReaction, setClickedReaction] = useState<string | null>(null);
  const [currentAction, setCurrentAction] = useState<any>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [memeUrl, setMemeUrl] = useState<string | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const [robotState, setRobotState] = useState<RobotState>({
    behavioralState: 'normal',
    gremlinState: 'idle',
    personality: { mood: 0.4, curiosity: 0.5, boredom: 0.2, confidence: 0.8, attachment: 0.2, energy: 0.8, chaos: 0.5, annoyance: 0.3 },
    avatarEmotion: 'neutral',
    isIdle: true,
  });
  const [robotBlink, setRobotBlink] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const staggerTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const chatboxRef = useRef<HTMLDivElement>(null);
  // When pinned, the bubble stops following the cursor so its buttons are clickable
  const pinnedRef = useRef(false);

  // ─── Cursor tracking ───
  useEffect(() => {
    if (window.antiCopilot?.onCursorUpdate) {
      window.antiCopilot.onCursorUpdate((_event: any, { x, y }: { x: number, y: number }) => {
        // Freeze the bubble in place the moment it becomes visible.
        // It will only follow the cursor while hidden/idle.
        if (uiStateRef.current !== 'idle') return;
        
        if (chatboxRef.current) {
          const rect = chatboxRef.current.getBoundingClientRect();
          // Fallback sizes if currently hidden/display:none
          const w = rect.width || 350;
          const h = rect.height || 200;
          
          let targetX = x + 15;
          let targetY = y + 15;
          
          if (targetX + w > window.innerWidth - 20) {
            targetX = window.innerWidth - w - 20;
          }
          if (targetY + h > window.innerHeight - 20) {
            targetY = window.innerHeight - h - 20;
          }
          // Prevent negative values if screen is small
          targetX = Math.max(20, targetX);
          targetY = Math.max(20, targetY);

          chatboxRef.current.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
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

  // Run the exit transition and reset to idle. Pin is released here.
  const beginExit = useCallback(() => {
    setIsExiting(true);
    pinnedRef.current = false;
    setIsPinned(false);
    window.antiCopilot?.setClickThrough(true); // Failsafe unlock
    const exitTimer = setTimeout(() => {
      setUiState('idle');
      uiStateRef.current = 'idle';
      setMessages([]);
      setVideoUrl('');
      setIsExiting(false);
      // Don't call silenceAll() here — let speech finish naturally.
      // It gets cancelled by the next trigger's clearAllTimers()+silenceAll().
    }, 400);
    staggerTimersRef.current.push(exitTimer);
  }, []);

  const scheduleHide = useCallback((durationMs: number) => {
    hideTimerRef.current = setTimeout(beginExit, durationMs);
  }, [beginExit]);

  // Estimate how long speech will take (fallback safety net only).
  // Generous margin to avoid cutting off mid-sentence.
  const estimateSpeechMs = (text: string): number => {
    const words = (text || '').split(/\s+/).filter(Boolean).length;
    return Math.max(10000, Math.ceil((words / 2.0) * 1000) + 6000);
  };

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
      setMemeUrl(null);
      setCurrentAction(trigger);
      setUiState(action);
      uiStateRef.current = action;
      setClickedReaction(null);

      // Pinned bubbles stop following the cursor — so fight-back buttons are
      // clickable, and panels don't chase the mouse around the screen.
      const shouldPin = ['speak_roast', 'mock', 'demotivate', 'fake_rewrite', 'send_meme'].includes(action);
      pinnedRef.current = shouldPin;
      setIsPinned(shouldPin);
      if (shouldPin && chatboxRef.current) {
        // We now freeze position for ALL visible states (see cursor tracker),
        // but for "pinned" states we also allow pointer-events on the bubble.
        // We keep the transform as-is so it stays exactly where it spawned.
      }

      const speakAndRender = (
        rawText: string | undefined,
        sender: string,
        tone?: EmotionTone,
        append: boolean = false,
        onDone?: () => void,
      ) => {
        const fullText = (rawText || '').trim();
        // Nothing to say (brain returned no line) — don't render an empty bubble.
        if (!fullText) {
          if (onDone) setTimeout(onDone, 200);
          return;
        }

        const utterance = speakWithEmotion(fullText);

        // Fire onDone exactly once — whichever happens first: speech ends, or
        // the safety timer elapses (covers muted/voiceless environments).
        let doneFired = false;
        const fireDone = () => {
          if (doneFired || !onDone) return;
          doneFired = true;
          onDone();
        };
        if (onDone) {
          setTimeout(fireDone, estimateSpeechMs(fullText) + 4000);
        }

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
          // Let the last words linger on screen, THEN dismiss — never mid-sentence.
          setTimeout(fireDone, 4500);
        };
      };

      switch (action) {
        case 'mock':
        case 'demotivate': {
          const tone: EmotionTone = (payload?.wpm && payload.wpm > 100) ? 'threatened' : 'mocking';
          speakAndRender(content, 'Anti-Copilot', tone, false, beginExit);
          break;
        }

        case 'gossip': {
          // The brain provides the line; styled as a third-party voice mocking them.
          speakAndRender(content, GOSSIP_CAST[2].name, 'mocking', false, beginExit);
          break;
        }

        case 'play_video': {
          const videoId = payload?.videoId || 'dQw4w9WgXcQ';
          setVideoUrl(`https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0`);
          speakAndRender(content, 'GREMLIN', 'mocking');
          scheduleHide(15000);
          break;
        }

        case 'send_meme': {
          // Alternate way to mock: throw a Giphy meme at them instead of just text.
          fetchMemeGif(content).then((url) => setMemeUrl(url));
          speakAndRender(content, 'Anti-Copilot', 'mocking');
          scheduleHide(estimateSpeechMs(content || '') + 2000);
          break;
        }

        case 'block_screen': {
          // Block the whole screen for a few seconds, then release it.
          speakAndRender(content, 'GREMLIN', 'mocking');
          window.antiCopilot.setClickThrough(false);
          const blockMs = 5000;
          const releaseTimer = setTimeout(() => window.antiCopilot.setClickThrough(true), blockMs);
          staggerTimersRef.current.push(releaseTimer);
          scheduleHide(blockMs);
          break;
        }

        case 'force_light_mode':
        case 'flash_light_mode': {
          speakAndRender(content, 'GREMLIN', 'mocking', false, beginExit);
          break;
        }

        case 'speak_roast': {
          speakAndRender(content, 'GREMLIN', 'mocking', false, beginExit);
          break;
        }

        case 'fake_rewrite': {
          // Harmless sabotage simulation: fake "rewriting your code" → punchline reveal.
          speakAndRender(content, 'GREMLIN', 'mocking', false, beginExit);
          break;
        }

        case 'flash_theme_strobe': {
          speakAndRender(content, 'GREMLIN', 'mocking');
          scheduleHide(4000);
          break;
        }

        case 'trigger_peekaboo': {
          speakAndRender(content, 'GREMLIN', 'mocking');
          scheduleHide(4000);
          break;
        }

        case 'play_brainrot': {
          setVideoUrl('https://www.youtube.com/embed/n_Dv4JMiwK8?autoplay=1&controls=0&mute=1');
          speakAndRender(content, 'GREMLIN', 'mocking');
          scheduleHide(15000);
          break;
        }

        case 'parental_override': {
          speakAndRender(content, 'Mom', 'exhausted');
          scheduleHide(10000);
          break;
        }

        case 'critique_code_semantics': {
          speakAndRender(content, 'Code Review', 'mocking');
          scheduleHide(10000);
          break;
        }

        case 'block_code_view': {
          speakAndRender(content, 'GREMLIN', 'mocking');
          // @ts-ignore
          const duration = trigger.durationSeconds ? trigger.durationSeconds * 1000 : 8000;
          window.antiCopilot.setClickThrough(false);
          setTimeout(() => window.antiCopilot.setClickThrough(true), duration);
          scheduleHide(duration);
          break;
        }

        case 'fake_panic': {
          speakAndRender(content, 'GREMLIN', 'mocking');
          window.antiCopilot.setClickThrough(false); // Make it truly block
          setTimeout(() => window.antiCopilot.setClickThrough(true), 10000);
          scheduleHide(10000);
          break;
        }

        case 'fake_loading':
        case 'editor_distraction': {
          speakAndRender(content, 'GREMLIN', 'mocking');
          scheduleHide(10000);
          break;
        }

        case 'sad_reaction': {
          speakAndRender(content, 'GREMLIN', 'sad', false, beginExit);
          break;
        }

        case 'theme_sabotage':
        case 'font_attack':
        case 'cursor_attack': {
          speakAndRender(content, 'GREMLIN', 'mocking', false, beginExit);
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
    const { gremlinState, behavioralState, personality } = robotState;
    if (gremlinState === 'defeated') return 'ERROR: USER SUCCEEDED :(';
    if (gremlinState === 'attacking') return 'CHAOS DETECTED. STRIKING.';
    if (gremlinState === 'teasing') return 'MOOD: DELIGHTED >:)';
    if (gremlinState === 'plotting') return 'STATUS: PLOTTING...';
    if (gremlinState === 'bored') return 'STATUS: SO BORED...';
    if (gremlinState === 'curious') return 'STATUS: CURIOUS...';
    if (behavioralState === 'stagnant') return 'STATUS: ABANDONED?';
    if (behavioralState === 'clueless') return 'ALERT: CTRL+V GREMLIN';
    return 'C:\\MONITORING..._';
  };

  // ─── Fight-back: send the user's reaction, then dismiss the bubble ───
  const reactTo = useCallback((reaction: string) => {
    if (clickedReaction) return; // Prevent double clicks
    
    setClickedReaction(reaction);
    window.antiCopilot?.sendUserReaction(reaction);
    window.antiCopilot?.setClickThrough(true);
    clearAllTimers();
    
    // Wait 1.5s so the user can see their click register before it vanishes
    setTimeout(() => {
      setIsExiting(true);
      pinnedRef.current = false;
      setIsPinned(false);
      setTimeout(() => {
        setUiState('idle');
        uiStateRef.current = 'idle';
        setMessages([]);
        setIsExiting(false);
        setClickedReaction(null);
      }, 300);
    }, 1500);
  }, [clearAllTimers, clickedReaction]);

  // Make a region clickable in the click-through overlay while hovered
  const hoverGrab = {
    onMouseEnter: () => window.antiCopilot?.setClickThrough(false),
    onMouseLeave: () => window.antiCopilot?.setClickThrough(true),
  };

  const fightbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const FightBackBar = () => {
    // Auto-dismiss after 12s if the user doesn't click
    useEffect(() => {
      fightbackTimerRef.current = setTimeout(() => {
        // Silence is consent — the gremlin does what it wants
        reactTo('destroy');
      }, 12000);
      return () => {
        if (fightbackTimerRef.current) clearTimeout(fightbackTimerRef.current);
      };
    }, []);

    return (
      <div className="fightback-bar" {...hoverGrab}>
        {FIGHTBACK_BUTTONS.map((b) => (
          <button 
            key={b.reaction} 
            className={`fightback-btn ${clickedReaction === b.reaction ? 'clicked' : ''}`} 
            onClick={() => reactTo(b.reaction)}
            style={clickedReaction && clickedReaction !== b.reaction ? { opacity: 0.3, pointerEvents: 'none' } : {}}
          >
            {b.label}
          </button>
        ))}
      </div>
    );
  };

  const robotFace = ROBOT_FACES[robotState.avatarEmotion] || ROBOT_FACES.neutral;
  const canvasClassName = `fullscreen-canvas state-${uiState}${isExiting ? ' exiting' : ''}`;

  return (
    <div className={canvasClassName}>

      {/* ═══ ALWAYS-VISIBLE RETRO ROBOT WIDGET ═══ */}
      <div className={`retro-robot-widget robot-state-${robotState.gremlinState}`}>
        <div className="robot-titlebar">
          <span className="robot-titlebar-text">ANTI-COPILOT.EXE</span>
          <span className="robot-titlebar-buttons">
            <span className="tb-btn">_</span>
            <span className="tb-btn">□</span>
            <span className="tb-btn" style={{ pointerEvents: 'auto', cursor: 'pointer' }} onClick={() => window.antiCopilot?.quitApp?.()}>×</span>
          </span>
        </div>
        <div className="robot-body">
          <div className={`robot-avatar ${robotBlink ? 'blink' : ''}`}>
            <pre className="robot-face">{robotFace}</pre>
            <div className="robot-scanline" />
          </div>
          <div className="robot-status-bar">
            <span className="robot-status-text">{getRobotStatusText()}</span>
            <span className="robot-status-indicator" data-state={robotState.gremlinState} />
          </div>
        </div>
      </div>

      {/* ═══ FLOATING UI (action overlays attached to cursor) ═══ */}
      {!['block_window', 'block_screen'].includes(uiState) && (
        <div ref={chatboxRef} className={`floating-ui-container${isPinned ? ' pinned' : ''}`}>

          {/* ─── Idle: no floating element ─── */}

          {/* ─── Fake Rewrite (harmless sabotage simulation) ─── */}
          {uiState === 'fake_rewrite' && (
            <div className="fake-rewrite" {...hoverGrab}>
              <div className="fake-rewrite-header">
                <span className="chatbox-icon">⚙</span>
                <span>AI IS REWRITING YOUR CODE...</span>
              </div>
              <div className="fake-rewrite-bar"><div className="fake-rewrite-fill" /></div>
              <div className="fake-rewrite-log">
                <div>&gt; analyzing your life choices...</div>
                <div>&gt; deleting node_modules (jk)...</div>
                <div>&gt; refactoring your ego...</div>
              </div>
              {messages[0] && <p className="fake-rewrite-punchline">{messages[0].text}</p>}
            </div>
          )}

          {/* ─── Chat Bubbles ─── */}
          {['mock', 'demotivate', 'gossip', 'force_light_mode', 'flash_light_mode', 'theme_sabotage', 'font_attack', 'cursor_attack', 'sad_reaction'].includes(uiState) && messages.length > 0 && (
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
              {['mock', 'demotivate'].includes(uiState) && <FightBackBar />}
            </div>
          )}

          {/* ─── Meme Card (Giphy) ─── */}
          {uiState === 'send_meme' && (
            <div className="chatbox-container">
              <div className="chatbox-header">
                <span className="chatbox-icon">🤖</span>
                <span className="chatbox-title">SHAME.GIF</span>
              </div>
              <div className="meme-card">
                {memeUrl ? (
                  <img src={memeUrl} alt="meme" className="meme-image" />
                ) : (
                  <div className="meme-loading">LOADING SHAME...</div>
                )}
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

          {/* ─── Roast / Strobe / Block chat bubbles ─── */}
          {['speak_roast', 'flash_theme_strobe', 'block_code_view'].includes(uiState) && messages[0] && (
            <div className="chatbox-container">
              <div className="chatbox-header prodigy-header">
                <span className="chatbox-icon">🤖</span>
                <span className="chatbox-title">{'C:\\GREMLIN.EXE'}</span>
              </div>
              <div className="chat-bubble sender-prodigy">
                <p className="bubble-text">{messages[0].text}</p>
              </div>
              {uiState === 'speak_roast' && <FightBackBar />}
            </div>
          )}

          {/* ─── Fake IDE Panic ─── */}
          {uiState === 'fake_panic' && (
            <div className="brutal-blocker" style={{ backgroundColor: '#aa0000', color: '#fff', textAlign: 'center' }}>
              <h1 style={{ fontSize: '4em', margin: '20px' }}>VS CODE CRITICAL ERROR</h1>
              <h2 style={{ fontSize: '2em' }}>Reason: Developer confidence too high</h2>
              <div className="chat-bubble sender-prodigy" style={{ marginTop: '50px' }}>
                <p className="bubble-text">{messages[0]?.text || 'I had to intervene.'}</p>
              </div>
            </div>
          )}

          {/* ─── Fake Loading ─── */}
          {uiState === 'fake_loading' && (
            <div className="critique-dashboard" style={{ width: '400px' }}>
              <div className="critique-header">
                <span className="critique-icon">⌛</span> ANALYZING CODE QUALITY...
              </div>
              <div className="fake-rewrite-progress" style={{ textAlign: 'left', margin: '20px' }}>
                <div>&gt; Scanning AST... 12%</div>
                <div>&gt; Detecting code smells... 48%</div>
                <div>&gt; Calculating technical debt... 99%</div>
                <div style={{ color: 'red', marginTop: '10px' }}>&gt; FAILED.</div>
              </div>
              {messages[0] && <div className="critique-roast-text">{messages[0].text}</div>}
            </div>
          )}

          {/* ─── Editor Distraction (Code Smell) ─── */}
          {uiState === 'editor_distraction' && (
            <div className="critique-dashboard" style={{ width: '400px', borderColor: 'orange' }}>
              <div className="critique-header" style={{ backgroundColor: 'orange', color: '#000' }}>
                <span className="critique-icon">☣️</span> ANTI-COPILOT REPORT
              </div>
              <div style={{ padding: '20px', fontSize: '1.5em', textAlign: 'center' }}>
                Your code smell level: <strong>87%</strong>
              </div>
              {messages[0] && <div className="critique-roast-text" style={{ borderTop: '1px solid orange' }}>{messages[0].text}</div>}
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

      {/* ─── Timed Screen Block ─── */}
      {uiState === 'block_screen' && (
        <div className="brutal-blocker" onMouseEnter={() => window.antiCopilot?.setClickThrough(false)}>
          <div className="blocker-content">
            <div className="blocker-icon-ring">
              <span className="blocker-icon">⛔</span>
            </div>
            <h1 className="blocker-title">SCREEN LOCKED</h1>
            <div className="blocker-divider" />
            <p className="blocker-message">{messages[0]?.text || 'Take a break. I insist.'}</p>
            <div className="blocker-timer-bar">
              <div className="blocker-timer-fill" style={{ animationDuration: '5s' }} />
            </div>
          </div>
          <div className="blocker-scanlines" />
        </div>
      )}
    </div>
  );
}
