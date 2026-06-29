'use client';
import { useEffect, useState } from 'react';

export default function AgentMemory() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // For now, hardcode user "1" or let user select
    fetch('/api/profile?userId=1')
      .then(res => res.json())
      .then(data => {
        setProfile(data.profile);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div style={{ color: 'var(--green-dim)', fontFamily: "'VT323', monospace" }}>Loading memory banks...</div>;
  }

  if (!profile) {
    return <div style={{ color: 'var(--muted)', fontFamily: "'VT323', monospace" }}>No relationship profile found. The agent hasn&apos;t formed an opinion yet.</div>;
  }

  return (
    <div style={{ fontFamily: "'Space Mono', monospace", color: 'var(--green)' }}>
      <h2 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '14px', color: 'var(--red)', textShadow: 'var(--glow-red)' }}>
        RELATIONSHIP PROFILE
      </h2>
      <div style={{ marginTop: '20px', display: 'grid', gap: '16px', gridTemplateColumns: '1fr 1fr' }}>
        <div style={{ border: '1px solid var(--green-dim)', padding: '16px', background: 'rgba(57, 255, 136, 0.05)' }}>
          <div style={{ fontSize: '10px', color: 'var(--muted)' }}>ESCALATION LEVEL</div>
          <div style={{ fontSize: '24px', fontFamily: "'VT323', monospace" }}>Lv. {profile.escalationLevel}</div>
        </div>
        <div style={{ border: '1px solid var(--green-dim)', padding: '16px', background: 'rgba(57, 255, 136, 0.05)' }}>
          <div style={{ fontSize: '10px', color: 'var(--muted)' }}>FAVORITE ATTACK</div>
          <div style={{ fontSize: '20px', fontFamily: "'VT323', monospace" }}>{profile.favoriteAttack}</div>
        </div>
        <div style={{ border: '1px solid var(--green-dim)', padding: '16px', background: 'rgba(57, 255, 136, 0.05)' }}>
          <div style={{ fontSize: '10px', color: 'var(--muted)' }}>TRIUMPHS WITNESSED</div>
          <div style={{ fontSize: '24px', fontFamily: "'VT323', monospace" }}>{profile.triumphsWitnessed}</div>
        </div>
        <div style={{ border: '1px solid var(--red-dim)', padding: '16px', background: 'rgba(255, 51, 85, 0.05)' }}>
          <div style={{ fontSize: '10px', color: 'var(--muted)' }}>KNOWN FEARS</div>
          <div style={{ fontSize: '14px', marginTop: '8px' }}>
            {profile.fears.length > 0 ? profile.fears.map((f: string, i: number) => <div key={i}>- {f}</div>) : 'None identified'}
          </div>
        </div>
      </div>
    </div>
  );
}
