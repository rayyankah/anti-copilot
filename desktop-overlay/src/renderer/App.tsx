import React, { useEffect, useState } from 'react';

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

  useEffect(() => {
    if (window.antiCopilot) {
      window.antiCopilot.onTrigger((trigger) => {
        setCurrentAction(trigger);
        setVisible(true);

        // TTS for text content
        if (trigger.content && (trigger.action === 'mock' || trigger.action === 'demotivate' || trigger.action === 'send_meme')) {
          const utterance = new SpeechSynthesisUtterance(trigger.content);
          utterance.rate = 0.9;
          utterance.pitch = 0.8;
          window.speechSynthesis.speak(utterance);
        }

        // Auto-hide after some time
        const duration = trigger.action === 'play_video' ? 15000 : trigger.action === 'block_window' ? 8000 : 5000;
        setTimeout(() => setVisible(false), duration);
      });
    }
  }, []);

  if (!visible || !currentAction) {
    return null;
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

  // Default (mock, demotivate, create_window)
  return (
    <div className="overlay-container">
      <div className={`overlay-card action-${currentAction.action}`}>
        <p className="overlay-text">
          {currentAction.content || '💀 Anti-Copilot is watching...'}
        </p>
      </div>
    </div>
  );
}
