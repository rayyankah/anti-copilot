import React, { useEffect, useState, useRef } from 'react';
import './styles/global.css';

interface DebugLog {
  timestamp: string;
  source: string;
  message: string;
}

export default function DebugApp() {
  const [booting, setBooting] = useState(true);
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Show PAIN boot screen for 3 seconds
    const bootTimer = setTimeout(() => {
      setBooting(false);
    }, 3000);

    return () => clearTimeout(bootTimer);
  }, []);

  useEffect(() => {
    if (window.antiCopilot && window.antiCopilot.onDebug) {
      window.antiCopilot.onDebug((logPayload: any) => {
        const newLog: DebugLog = {
          timestamp: new Date().toLocaleTimeString(),
          source: logPayload.source || 'unknown',
          message: logPayload.message || JSON.stringify(logPayload)
        };
        
        setLogs((prev) => [...prev, newLog]);
      });
    }
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom of logs
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  if (booting) {
    return (
      <div className="boot-screen">
        <pre className="ascii-art">
{`
██████╗  █████╗ ██╗███╗   ██╗
██╔══██╗██╔══██╗██║████╗  ██║
██████╔╝███████║██║██╔██╗ ██║
██╔═══╝ ██╔══██║██║██║╚██╗██║
██║     ██║  ██║██║██║ ╚████║
╚═╝     ╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝
`}
        </pre>
        <h2>THE PRODIGY IS WATCHING...</h2>
        <div className="loading-bar">
          <div className="loading-fill"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="debug-container">
      <div className="debug-header">
        <h1>[ANTI-COPILOT] System Telemetry</h1>
        <div className="pulse-dot"></div>
      </div>
      <div className="debug-terminal">
        {logs.map((log, i) => (
          <div key={i} className="log-entry">
            <span className="log-time">[{log.timestamp}]</span>
            <span className={`log-source source-${log.source}`}> [{log.source.toUpperCase()}] </span>
            <span className="log-message">{log.message}</span>
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}
