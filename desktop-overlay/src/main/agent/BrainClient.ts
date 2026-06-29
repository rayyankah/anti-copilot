import http from 'http';
import { AgentPayload, AgentDecision } from '../../shared/types';

/**
 * BrainClient — HTTP client for the AWS Bedrock brain API.
 * Posts behavioral profiles and receives structured agent decisions.
 */
export class BrainClient {
  private readonly brainUrl: string;
  private readonly timeoutMs = 15_000;

  constructor(brainPort: number = 3000) {
    this.brainUrl = `http://127.0.0.1:${brainPort}`;
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

      const req = http.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname,
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

  private get(path: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.brainUrl);
      const req = http.get(url, (res) => {
        res.resume();
        resolve(res.statusCode || 0);
      });
      req.on('error', reject);
      req.setTimeout(3000, () => {
        req.destroy();
        reject(new Error('Health check timed out'));
      });
    });
  }
}
