'use client';
import { useEffect, useState } from 'react';

export default function Configuration() {
  const [config, setConfig] = useState({
    baseChaos: 0.5,
    defaultMood: 0.5,
    muteAttacks: false,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/config?userId=1')
      .then(res => res.json())
      .then(data => {
        if (data.config) setConfig(data.config);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: '1', config }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ fontFamily: "'Space Mono', monospace", color: 'var(--green)', maxWidth: '600px' }}>
      <h2 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '14px', color: 'var(--blue)', textShadow: 'var(--glow-blue)', marginBottom: '24px' }}>
        AGENT CONFIGURATION
      </h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '8px', color: 'var(--muted)', fontSize: '12px' }}>
            BASE CHAOS LEVEL ({config.baseChaos})
          </label>
          <input 
            type="range" 
            min="0" max="1" step="0.1" 
            value={config.baseChaos}
            onChange={(e) => setConfig({...config, baseChaos: parseFloat(e.target.value)})}
            style={{ width: '100%', accentColor: 'var(--green)' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '8px', color: 'var(--muted)', fontSize: '12px' }}>
            DEFAULT MOOD (0 = Angry, 1 = Happy) ({config.defaultMood})
          </label>
          <input 
            type="range" 
            min="0" max="1" step="0.1" 
            value={config.defaultMood}
            onChange={(e) => setConfig({...config, defaultMood: parseFloat(e.target.value)})}
            style={{ width: '100%', accentColor: 'var(--green)' }}
          />
        </div>

        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--muted)', fontSize: '14px' }}>
            <input 
              type="checkbox" 
              checked={config.muteAttacks}
              onChange={(e) => setConfig({...config, muteAttacks: e.target.checked})}
              style={{ accentColor: 'var(--red)', width: '16px', height: '16px' }}
            />
            Mute IDE physical attacks (Safe Mode)
          </label>
        </div>

        <button 
          onClick={handleSave}
          disabled={saving}
          style={{
            marginTop: '16px',
            background: 'var(--green-ghost)',
            border: '1px solid var(--green)',
            color: 'var(--green)',
            padding: '12px 24px',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '10px',
            cursor: 'pointer',
            boxShadow: 'var(--glow-green)'
          }}
        >
          {saving ? 'SAVING...' : saved ? 'SAVED!' : 'UPDATE CONFIG'}
        </button>
      </div>
    </div>
  );
}
