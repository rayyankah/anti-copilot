import React, { useEffect, useState, useRef } from 'react';

interface TriggerPayload {
  type: string;
  action: string;
  content?: string;
  mediaUrl?: string;
}

declare global {
  interface Window {
    antiCopilot: {
      onTrigger: (callback: (trigger: TriggerPayload) => void) => void;
      setClickThrough: (enabled: boolean) => void;
    };
  }
}

export default function App() {
  const [currentAction, setCurrentAction] = useState<TriggerPayload | null>(null);
  const [visible, setVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    console.log('[Anti-Copilot Renderer] App mounted, registering trigger listener...');

    if (window.antiCopilot) {
      window.antiCopilot.onTrigger((trigger) => {
        console.log('[Anti-Copilot Renderer] Trigger received:', trigger);

        // Clear any existing hide timer
        if (hideTimerRef.current) {
          clearTimeout(hideTimerRef.current);
        }

        setCurrentAction(trigger);
        setVisible(true);

        // TTS for text content (exclude visual-only actions)
        if (trigger.content && !['block_window', 'force_light_mode', 'play_video'].includes(trigger.action)) {
          try {
            window.speechSynthesis.cancel(); // Cancel any ongoing speech
            const utterance = new SpeechSynthesisUtterance(trigger.content);
            utterance.rate = 0.9;
            utterance.pitch = 0.8;
            window.speechSynthesis.speak(utterance);
            console.log('[Anti-Copilot Renderer] TTS speaking:', trigger.content);
          } catch (e) {
            console.error('[Anti-Copilot Renderer] TTS error:', e);
          }
        }

        // Auto-hide after duration
        const duration = trigger.action === 'play_video' ? 15000 : trigger.action === 'block_window' ? 8000 : 6000;
        hideTimerRef.current = setTimeout(() => setVisible(false), duration);
      });
      console.log('[Anti-Copilot Renderer] Trigger listener registered successfully.');
    } else {
      console.error('[Anti-Copilot Renderer] window.antiCopilot is NOT available! Preload may have failed.');
    }
  }, []);

  if (!visible || !currentAction) {
    return (
      <div className="overlay-container idle-state">
        <div className="idle-indicator">💀</div>
      </div>
    );
  }

  // Handle specific action rendering
  if (currentAction.action === 'block_window') {
    return (
      <div className="overlay-container action-block_window">
        <div className="block-screen-content">
          <h1>🛑 ACCESS DENIED</h1>
          <p>{currentAction.content}</p>
        </div>
      </div>
    );
  }

  if (currentAction.action === 'play_video') {
    return (
      <div className="overlay-container">
        <div className="overlay-card video-card">
          <p className="overlay-text">{currentAction.content}</p>
          <iframe 
            width="320" 
            height="180" 
            src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&controls=0" 
            title="YouTube video player" 
            frameBorder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowFullScreen
          ></iframe>
        </div>
      </div>
    );
  }

  if (currentAction.action === 'gossip') {
    return (
      <div className="overlay-container gossip-container">
        <div className="gossip-bubble user1">Did you see that copy paste?</div>
        <div className="gossip-bubble user2">Yeah, 0 original thoughts.</div>
        <div className="gossip-bubble user3">{currentAction.content}</div>
      </div>
    );
  }

  if (currentAction.action === 'send_meme') {
    return (
      <div className="overlay-container">
        <div className="overlay-card meme-card">
          <img src="https://i.imgflip.com/1g8my4.jpg" alt="Meme" className="meme-image" />
          <p className="overlay-text meme-text">{currentAction.content}</p>
        </div>
      </div>
    );
  }

  // Default (mock, demotivate, force_light_mode, etc.)
  return (
    <div className="overlay-container">
      <div className={`overlay-card action-${currentAction.action}`}>
        <div className="overlay-header">
          <span className="overlay-icon">💀</span>
          <span className="overlay-title">Anti-Copilot</span>
        </div>
        <p className="overlay-text">
          {currentAction.content || '💀 Anti-Copilot is watching...'}
        </p>
      </div>
    </div>
  );
}
