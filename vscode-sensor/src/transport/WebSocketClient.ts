import WebSocket from 'ws';

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private readonly RECONNECT_INTERVAL_MS = 3000;
  private messageHandler: ((msg: Record<string, unknown>) => void) | null = null;

  constructor(private url: string) {
    this.connect();
  }

  private connect(): void {
    try {
      this.ws = new WebSocket(this.url);

      this.ws.on('open', () => {
        console.log('[Anti-Copilot] Connected to overlay');
      });

      this.ws.on('message', (data) => {
        if (!this.messageHandler) return;
        try {
          const msg = JSON.parse(data.toString());
          this.messageHandler(msg);
        } catch {
          // Ignore malformed messages
        }
      });

      this.ws.on('close', () => {
        console.log('[Anti-Copilot] Disconnected from overlay, reconnecting...');
        this.scheduleReconnect();
      });

      this.ws.on('error', (err) => {
        console.error('[Anti-Copilot] WebSocket error:', err.message);
      });
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.RECONNECT_INTERVAL_MS);
  }

  /**
   * Register a handler for incoming messages from the Electron overlay.
   * This is how the agent sends VS Code-side attacks (theme, font, cursor).
   */
  onMessage(handler: (msg: Record<string, unknown>) => void): void {
    this.messageHandler = handler;
  }

  send(data: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }
}

