'use client';

import { useEffect, useState } from 'react';
import HallOfShame from './components/HallOfShame';
import AgentMemory from './components/AgentMemory';
import Configuration from './components/Configuration';

type Tab = 'shame' | 'memory' | 'config';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>('shame');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const blink = setInterval(() => setTick(t => t + 1), 800);
    return () => clearInterval(blink);
  }, []);

  const cursor = tick % 2 === 0 ? '█' : ' ';

  return (
    <main style={{
      minHeight: '100vh',
      padding: '0',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Space Mono', 'Courier New', monospace",
    }}>

      {/* ── Header bar ── */}
      <div style={{
        borderBottom: '1px solid var(--green-dim)',
        padding: '10px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--green-ghost)',
      }}>
        <span style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: '9px',
          color: 'var(--green)',
          letterSpacing: '1px',
          textShadow: 'var(--glow-green)',
        }}>
          ANTI-COPILOT OS v0.2.0
        </span>
        <span style={{
          fontFamily: "'VT323', monospace",
          fontSize: '14px',
          color: 'var(--green-dim)',
          letterSpacing: '2px',
        }}>
          {new Date().toLocaleTimeString()} {cursor}
        </span>
      </div>

      <div style={{ display: 'flex', flex: 1 }}>
        {/* ── Sidebar ── */}
        <div style={{
          width: '240px',
          borderRight: '1px solid rgba(57, 255, 136, 0.2)',
          padding: '40px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <TabButton active={activeTab === 'shame'} onClick={() => setActiveTab('shame')} label="HALL OF SHAME" />
          <TabButton active={activeTab === 'memory'} onClick={() => setActiveTab('memory')} label="AGENT MEMORY" />
          <TabButton active={activeTab === 'config'} onClick={() => setActiveTab('config')} label="CONFIGURATION" />
        </div>

        {/* ── Main content ── */}
        <div style={{
          flex: 1,
          padding: '40px 32px',
          maxWidth: '900px',
        }}>
          {activeTab === 'shame' && <HallOfShame cursor={cursor} />}
          {activeTab === 'memory' && <AgentMemory />}
          {activeTab === 'config' && <Configuration />}

          {/* ── Footer ── */}
          <div style={{
            marginTop: '32px',
            fontFamily: "'VT323', monospace",
            fontSize: '14px',
            color: 'var(--muted)',
            letterSpacing: '1px',
            borderTop: '1px solid rgba(57, 255, 136, 0.08)',
            paddingTop: '16px',
            display: 'flex',
            justifyContent: 'space-between',
          }}>
            <span>{'>> ANTI-COPILOT IS WATCHING. IT ALWAYS IS.'}</span>
            <span style={{ color: 'var(--green-dim)' }}>LIVE {cursor}</span>
          </div>
        </div>
      </div>
    </main>
  );
}

function TabButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent',
        border: 'none',
        borderLeft: active ? '4px solid var(--green)' : '4px solid transparent',
        color: active ? 'var(--green)' : 'var(--muted)',
        padding: '12px 24px',
        textAlign: 'left',
        fontFamily: "'Press Start 2P', monospace",
        fontSize: '10px',
        cursor: 'pointer',
        textShadow: active ? 'var(--glow-green)' : 'none',
        transition: 'all 0.2s ease',
      }}
    >
      {label}
    </button>
  );
}
