'use client';

import { useEffect, useState } from 'react';
import { LeaderboardEntry } from '@/lib/types';

const SHAME_BAR_MAX = 1000;

function ShameBar({ score }: { score: number }) {
  const pct = Math.min(100, (score / SHAME_BAR_MAX) * 100);
  return (
    <div style={{
      width: '100%',
      height: '6px',
      background: 'rgba(255, 51, 85, 0.1)',
      border: '1px solid rgba(255, 51, 85, 0.25)',
      marginTop: '8px',
      overflow: 'hidden',
    }}>
      <div style={{
        width: `${pct}%`,
        height: '100%',
        background: 'var(--red)',
        boxShadow: 'var(--glow-red)',
        transition: 'width 0.4s ease',
      }} />
    </div>
  );
}

const RANK_LABELS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'];

export default function HallOfShame({ cursor }: { cursor: string }) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch('/api/leaderboard');
      const data = await res.json();
      if (data.leaderboard) setLeaderboard(data.leaderboard);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    const poll = setInterval(fetchLeaderboard, 5000);
    return () => clearInterval(poll);
  }, []);

  return (
    <>
      {/* ── ASCII header ── */}
      <div style={{ marginBottom: '40px' }}>
        <pre style={{
          fontFamily: "'VT323', monospace",
          fontSize: '13px',
          color: 'var(--green)',
          opacity: 0.35,
          lineHeight: '1.15',
          letterSpacing: '1px',
          textShadow: 'var(--glow-green)',
          marginBottom: '20px',
          overflow: 'hidden',
        }}>{`╔══════════════════════════════════════════════════════╗
║  ██╗  ██╗ █████╗ ██╗     ██╗          ██████╗ ███████╗ ║
║  ██║  ██║██╔══██╗██║     ██║         ██╔═══██╗██╔════╝ ║
║  ███████║███████║██║     ██║         ██║   ██║█████╗   ║
║  ██╔══██║██╔══██║██║     ██║         ██║   ██║██╔══╝   ║
║  ██║  ██║██║  ██║███████╗███████╗    ╚██████╔╝██║      ║
║  ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚══════╝    ╚═════╝ ╚═╝      ║
║                  SHAME                                  ║
╚══════════════════════════════════════════════════════╝`}</pre>

        <div style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: '11px',
          color: 'var(--red)',
          textShadow: 'var(--glow-red)',
          letterSpacing: '2px',
          marginBottom: '6px',
        }}>
          GLOBAL HALL OF SHAME
        </div>
        <div style={{
          fontFamily: "'VT323', monospace",
          fontSize: '16px',
          color: 'var(--green-dim)',
          letterSpacing: '1px',
        }}>
          {'>> DEVELOPERS RANKED BY FAILURE INDEX. LIVE. UPDATED EVERY 5s.'}
        </div>
      </div>

      {/* ── System status panel ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: '12px',
        marginBottom: '36px',
      }}>
        {[
          { label: 'AGENT STATUS',   value: 'WATCHING',        color: 'var(--green)', glow: 'var(--glow-green)' },
          { label: 'VICTIMS RANKED', value: String(leaderboard.length || '--'), color: 'var(--blue)',  glow: 'var(--glow-blue)' },
          { label: 'SHAME PROTOCOL', value: 'ACTIVE',          color: 'var(--red)',   glow: 'var(--glow-red)' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'var(--panel-dark)',
            border: `1px solid rgba(57, 255, 136, 0.12)`,
            padding: '12px 16px',
          }}>
            <div style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '7px',
              color: 'var(--muted)',
              letterSpacing: '1px',
              marginBottom: '8px',
            }}>
              {s.label}
            </div>
            <div style={{
              fontFamily: "'VT323', monospace",
              fontSize: '22px',
              color: s.color,
              textShadow: s.glow,
              letterSpacing: '2px',
            }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* ── Leaderboard ── */}
      <div style={{
        border: '1px solid var(--red-dim)',
        boxShadow: 'var(--glow-red)',
      }}>
        {/* Table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '44px 1fr 1fr 100px',
          gap: '0',
          padding: '8px 16px',
          background: 'var(--red-ghost)',
          borderBottom: '1px solid var(--red-dim)',
        }}>
          {['RNK', 'DEVELOPER', 'MOST REPEATED FAILURE', 'SHAME'].map(h => (
            <div key={h} style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '7px',
              color: 'var(--red)',
              letterSpacing: '1px',
              textShadow: 'var(--glow-red)',
            }}>
              {h}
            </div>
          ))}
        </div>

        {loading && leaderboard.length === 0 ? (
          <div style={{
            padding: '48px 16px',
            textAlign: 'center',
            fontFamily: "'VT323', monospace",
            fontSize: '20px',
            color: 'var(--green-dim)',
            letterSpacing: '2px',
          }}>
            {'>> SCANNING FOR SHAME... '}
            <span style={{ color: 'var(--green)', textShadow: 'var(--glow-green)' }}>{cursor}</span>
          </div>
        ) : leaderboard.length === 0 ? (
          <div style={{
            padding: '48px 16px',
            textAlign: 'center',
            fontFamily: "'VT323', monospace",
            fontSize: '20px',
            color: 'var(--muted)',
            letterSpacing: '2px',
          }}>
            {'>> NO VICTIMS YET. THE CODE IS SUSPICIOUSLY BUG-FREE.'}
          </div>
        ) : (
          leaderboard.map((user, i) => (
            <div key={user.userId} style={{
              display: 'grid',
              gridTemplateColumns: '44px 1fr 1fr 100px',
              gap: '0',
              padding: '14px 16px',
              borderBottom: i < leaderboard.length - 1 ? '1px solid rgba(255, 51, 85, 0.08)' : 'none',
              background: i === 0 ? 'rgba(255, 51, 85, 0.05)' : 'transparent',
              alignItems: 'start',
              transition: 'background 0.2s',
            }}>
              {/* Rank */}
              <div style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: '10px',
                color: i === 0 ? 'var(--red)' : 'var(--muted)',
                textShadow: i === 0 ? 'var(--glow-red)' : 'none',
                paddingTop: '2px',
              }}>
                #{RANK_LABELS[i] ?? String(i + 1).padStart(2, '0')}
              </div>

              {/* Developer name */}
              <div>
                <div style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: '14px',
                  color: i === 0 ? 'var(--green)' : 'rgba(57, 255, 136, 0.8)',
                  textShadow: i === 0 ? 'var(--glow-green)' : 'none',
                  letterSpacing: '0.5px',
                  marginBottom: '4px',
                }}>
                  {user.displayName}
                </div>
                {i === 0 && (
                  <div style={{
                    fontFamily: "'VT323', monospace",
                    fontSize: '12px',
                    color: 'var(--red)',
                    letterSpacing: '1px',
                    textShadow: 'var(--glow-red)',
                  }}>
                    {'[WORST DEVELOPER ONLINE]'}
                  </div>
                )}
              </div>

              {/* Error */}
              <div>
                <div style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: '11px',
                  color: 'var(--red)',
                  textShadow: 'var(--glow-red)',
                  wordBreak: 'break-word',
                  lineHeight: '1.5',
                }}>
                  {user.topError}
                </div>
                <div style={{
                  fontFamily: "'VT323', monospace",
                  fontSize: '14px',
                  color: 'var(--muted)',
                  marginTop: '2px',
                }}>
                  {user.topErrorCount}× repeated
                </div>
                <ShameBar score={user.shameScore} />
              </div>

              {/* Score */}
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: '14px',
                  color: i === 0 ? 'var(--red)' : 'rgba(255, 51, 85, 0.7)',
                  textShadow: i === 0 ? 'var(--glow-red)' : 'none',
                }}>
                  {user.shameScore}
                </div>
                <div style={{
                  fontFamily: "'VT323', monospace",
                  fontSize: '12px',
                  color: 'var(--muted)',
                  marginTop: '3px',
                }}>
                  pts
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
