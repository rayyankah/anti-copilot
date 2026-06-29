import http from 'http';
import https from 'https';
import { AgentPayload, AgentDecision } from '../../shared/types';

/**
 * BrainClient — HTTP client for the AWS Bedrock brain API.
 * Posts behavioral profiles and receives structured agent decisions.
 *
 * Targets the hosted Vercel brain by default (override with the
 * ANTI_COPILOT_BRAIN_URL env var), and falls back to a local dev server.
 */
const DEFAULT_BRAIN_URL = 'https://vercel-brain-zeta.vercel.app';

export class BrainClient {
  private readonly brainUrl: string;
  private readonly timeoutMs = 15_000;

  constructor(brainPort: number = 3000) {
    const override = process.env.ANTI_COPILOT_BRAIN_URL?.trim();
    if (override) {
      this.brainUrl = override;
    } else if (process.env.ANTI_COPILOT_LOCAL_BRAIN === '1') {
      this.brainUrl = `http://127.0.0.1:${brainPort}`;
    } else {
      this.brainUrl = DEFAULT_BRAIN_URL;
    }
  }

  private transport(url: URL): typeof http | typeof https {
    return url.protocol === 'https:' ? https : http;
  }

  /**
   * Send a behavioral payload to the brain and receive a structured decision.
   */
  async evaluate(payload: AgentPayload): Promise<AgentDecision> {
    try {
      const result = await this.post('/api/agent', payload);
      return result as AgentDecision;
    } catch (err) {
      console.error('[BrainClient] Evaluation failed:', err);
      // Fallback: stay silent
      return {
        action: 'stay_silent',
        content: '',
        avatarEmotion: 'neutral',
        confidence: 0,
        reasoning: 'Brain unreachable — falling back to silence.',
      };
    }
  }

  /**
   * Load this developer's persisted relationship profile from the brain
   * (backed by DynamoDB). Returns null if none exists or on failure.
   */
  async loadProfile(userId: string): Promise<{
    escalationLevel?: number;
    favoriteAttack?: string;
    fears?: string[];
    triumphsWitnessed?: number;
  } | null> {
    try {
      const result = await this.get(`/api/profile?userId=${encodeURIComponent(userId)}`, true);
      const parsed = result as { profile?: unknown };
      return (parsed?.profile as never) ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Check if the brain server is healthy.
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.get('/');
      return true;
    } catch {
      return false;
    }
  }

  private post(path: string, body: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const url = new URL(path, this.brainUrl);

      const req = this.transport(url).request(
        {
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: url.pathname + url.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data),
          },
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            try {
              resolve(JSON.parse(body));
            } catch {
              reject(new Error(`Invalid JSON response: ${body.substring(0, 200)}`));
            }
          });
        }
      );

      req.on('error', reject);
      req.setTimeout(this.timeoutMs, () => {
        req.destroy();
        reject(new Error('Brain request timed out'));
      });

      req.write(data);
      req.end();
    });
  }

  private get(path: string, parseBody = false): Promise<number | unknown> {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.brainUrl);
      const req = this.transport(url).get(url, (res) => {
        if (!parseBody) {
          res.resume();
          resolve(res.statusCode || 0);
          return;
        }
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            reject(new Error('Invalid JSON in GET response'));
          }
        });
      });
      req.on('error', reject);
      req.setTimeout(3000, () => {
        req.destroy();
        reject(new Error('GET request timed out'));
      });
    });
  }
}
