'use client';

import { useEffect, useState } from 'react';
import { LeaderboardEntry } from '@/lib/types';

export default function HomePage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch('/api/leaderboard');
      const data = await res.json();
      if (data.leaderboard) {
        setLeaderboard(data.leaderboard);
      }
    } catch (err) {
      console.error('Failed to fetch leaderboard', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, []);

  return (
    <main style={{ minHeight: '100vh', padding: '4rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <h1 style={{ fontSize: '3rem', fontWeight: 800, background: 'linear-gradient(135deg, #ff2d2d, #ff6b00)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '1rem' }}>
        🏆 Global Hall of Shame
      </h1>
      <p style={{ color: '#888', fontSize: '1.2rem', maxWidth: '600px', textAlign: 'center', marginBottom: '3rem' }}>
        The live leaderboard of the worst developers using Anti-Copilot, ranked by their most embarrassing, frequently repeated errors.
      </p>

      {loading && leaderboard.length === 0 ? (
        <p>Loading the shame...</p>
      ) : leaderboard.length === 0 ? (
        <p style={{ color: '#555' }}>No victims yet. The code is surprisingly bug-free... for now.</p>
      ) : (
        <div style={{ width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {leaderboard.map((user, index) => (
            <div key={user.userId} style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
              padding: '1.5rem', background: 'var(--bg-card)', 
              borderRadius: '12px', border: '1px solid var(--border-color)',
              boxShadow: index === 0 ? '0 0 20px var(--accent-red-glow)' : 'none',
              transform: index === 0 ? 'scale(1.02)' : 'none',
              transition: 'all 0.3s ease'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: index === 0 ? '#ff2d2d' : '#888', width: '30px' }}>
                  #{index + 1}
                </div>
                <div>
                  <h2 style={{ fontSize: '1.2rem', marginBottom: '0.2rem' }}>{user.displayName}</h2>
                  <p style={{ color: '#888', fontSize: '0.9rem' }}>
                    Most common fail: <span style={{ color: '#ff6b00' }}>{user.topError}</span> ({user.topErrorCount} times)
                  </p>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ff2d2d' }}>{user.shameScore}</div>
                <div style={{ fontSize: '0.8rem', color: '#555' }}>Shame Score</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
