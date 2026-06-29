import { BehavioralState, TelemetryFrame } from '../../shared/types';

/**
 * BehaviorEngine — Rolling 10-second behavioral analysis engine.
 * 
 * Maintains a sliding window of raw telemetry frames and continuously
 * classifies the developer's psychological state using 5 inflection detectors.
 * Runs locally in Electron main process at <1ms per tick.
 */
export class BehaviorEngine {
  private buffer: TelemetryFrame[] = [];
  private readonly WINDOW_MS = 10_000; // 10-second rolling window
  private lastInflectionTime = 0;
  private readonly MIN_INFLECTION_GAP_MS = 5_000; // Don't fire more than once per 5s
  private previousState: BehavioralState = BehavioralState.Normal;

  /**
   * Ingest a raw telemetry frame from the VS Code sensor.
   */
  ingest(frame: TelemetryFrame): void {
    this.buffer.push(frame);
    this.pruneBuffer();
  }

  /**
   * Get a snapshot of the current behavioral metrics.
   */
  getSnapshot(): BehaviorSnapshot {
    this.pruneBuffer();
    const now = Date.now();
    const frames = this.buffer;

    if (frames.length === 0) {
      return {
        avgKST: Infinity,
        errorCount: 0,
        errorDelta: 0,
        stagnationSeconds: 0,
        wpm: 0,
        txtTotal: 0,
        frameCount: 0,
      };
    }

    // Average keystroke interval
    const kstValues = frames.filter(f => f.kst > 0).map(f => f.kst);
    const avgKST = kstValues.length > 0
      ? kstValues.reduce((a, b) => a + b, 0) / kstValues.length
      : Infinity;

    // Current error count (latest frame)
    const latestErr = frames[frames.length - 1].err.count;

    // Error delta: compare first vs last frame in window
    const firstErr = frames[0].err.count;
    const errorDelta = latestErr - firstErr;

    // Stagnation: time since last keystroke
    const lastKeystroke = frames[frames.length - 1].timestamp;
    const stagnationSeconds = (now - lastKeystroke) / 1000;

    // WPM approximation: chars typed in window / 5 / window-seconds * 60
    const charsTyped = frames
      .filter(f => f.txt > 0)
      .reduce((sum, f) => sum + f.txt, 0);
    const windowSeconds = (now - frames[0].timestamp) / 1000;
    const wpm = windowSeconds > 0.5
      ? Math.round((charsTyped / 5) / (windowSeconds / 60))
      : 0;

    // Total text delta
    const txtTotal = frames.reduce((sum, f) => sum + f.txt, 0);

    return {
      avgKST,
      errorCount: latestErr,
      errorDelta,
      stagnationSeconds,
      wpm,
      txtTotal,
      frameCount: frames.length,
    };
  }

  /**
   * Classify the current behavioral state based on the rolling buffer.
   */
  classifyState(): BehavioralState {
    const snapshot = this.getSnapshot();

    if (this.detectFrustration(snapshot)) return BehavioralState.Frustrated;
    if (this.detectCopyPasteStagnation(snapshot)) return BehavioralState.Clueless;
    if (this.detectBlindRager(snapshot)) return BehavioralState.Manic;
    if (this.detectStagnation(snapshot)) return BehavioralState.Stagnant;
    if (this.detectArrogantFlow(snapshot)) return BehavioralState.Arrogant;
    return BehavioralState.Normal;
  }

  /**
   * Check if a behavioral inflection point has occurred.
   * An inflection = the state just changed from Normal to something else,
   * or changed between non-Normal states.
   */
  hasInflection(): boolean {
    const now = Date.now();
    if (now - this.lastInflectionTime < this.MIN_INFLECTION_GAP_MS) return false;

    const currentState = this.classifyState();
    const changed = currentState !== this.previousState && currentState !== BehavioralState.Normal;

    if (changed) {
      this.lastInflectionTime = now;
      this.previousState = currentState;
      return true;
    }

    this.previousState = currentState;
    return false;
  }

  // ─── Inflection Detectors ───

  /**
   * Frustration Spike:
   * User was typing rhythmically (KST < 200ms), error count jumps > 0,
   * then typing stops (current stagnation > 3s).
   */
  private detectFrustration(s: BehaviorSnapshot): boolean {
    if (s.frameCount < 3) return false;

    // Were they typing fast recently?
    const recentFrames = this.buffer.slice(-10);
    const hadFastTyping = recentFrames.some(f => f.kst > 0 && f.kst < 200);

    // Do errors exist?
    const hasErrors = s.errorCount > 0;

    // Did they stop typing?
    const stopped = s.stagnationSeconds > 3;

    return hadFastTyping && hasErrors && stopped;
  }

  /**
   * Copy-Paste Stagnation:
   * Large text jump (>100 chars in one frame) followed by erratic
   * typing cadence (KST fluctuating wildly between 100ms–1500ms).
   */
  private detectCopyPasteStagnation(s: BehaviorSnapshot): boolean {
    if (s.frameCount < 5) return false;

    // Was there a large paste?
    const hadLargePaste = this.buffer.some(f => f.txt > 100);
    if (!hadLargePaste) return false;

    // After the paste, is the KST erratic?
    const pasteIdx = this.buffer.findIndex(f => f.txt > 100);
    const afterPaste = this.buffer.slice(pasteIdx + 1);
    if (afterPaste.length < 3) return false;

    const kstValues = afterPaste.filter(f => f.kst > 0).map(f => f.kst);
    if (kstValues.length < 3) return false;

    const min = Math.min(...kstValues);
    const max = Math.max(...kstValues);
    const isErratic = min < 200 && max > 1000;

    // Errors growing?
    const errorGrowing = s.errorDelta > 0;

    return isErratic || errorGrowing;
  }

  /**
   * Blind Rager:
   * Typing velocity very fast (KST < 100ms avg) while error count is climbing.
   */
  private detectBlindRager(s: BehaviorSnapshot): boolean {
    return s.avgKST < 120 && s.errorDelta > 0 && s.errorCount > 0 && s.frameCount > 5;
  }

  /**
   * Stagnation:
   * Zero typing for > 6 seconds while errors are present.
   */
  private detectStagnation(s: BehaviorSnapshot): boolean {
    return s.stagnationSeconds > 6 && s.errorCount > 0;
  }

  /**
   * Arrogant Flow:
   * Sustained fast typing (KST < 150ms avg) with zero errors for the
   * entire window. User thinks they're hot stuff.
   */
  private detectArrogantFlow(s: BehaviorSnapshot): boolean {
    return s.avgKST < 150 && s.avgKST > 0 && s.errorCount === 0 && s.frameCount > 10;
  }

  // ─── Internal ───

  private pruneBuffer(): void {
    const cutoff = Date.now() - this.WINDOW_MS;
    this.buffer = this.buffer.filter(f => f.timestamp > cutoff);
  }
}

// ── Exported snapshot interface ──
export interface BehaviorSnapshot {
  avgKST: number;
  errorCount: number;
  errorDelta: number;
  stagnationSeconds: number;
  wpm: number;
  txtTotal: number;
  frameCount: number;
}
