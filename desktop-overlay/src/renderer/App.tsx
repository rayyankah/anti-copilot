import React, { useEffect, useState } from 'react';

interface TriggerPayload {
  type: string;
  action: string;
  content?: string;
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

        // Auto-hide after 5 seconds for most actions
        if (trigger.action !== 'block_window') {
          setTimeout(() => setVisible(false), 5000);
        }
      });
    }
  }, []);

  if (!visible || !currentAction) {
    return null;
  }

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
