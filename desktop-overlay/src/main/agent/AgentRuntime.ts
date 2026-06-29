import {
  BehavioralState,
  TelemetryFrame,
  AgentDecision,
  RobotState,
  AgentPayload,
} from '../../shared/types';
import { BehaviorEngine } from './BehaviorEngine';
import { PersonalityEngine } from './PersonalityEngine';
import { MemorySystem } from './MemorySystem';
import { BrainClient } from './BrainClient';
import { OverlayBridge } from './OverlayBridge';

/**
 * AgentRuntime — The core autonomous agent loop.
 * 
 * Runs inside Electron's main process. Continuously cycles through:
 *   OBSERVE → UNDERSTAND → PLAN → ACT → VERIFY → LEARN
 * 
 * The agent is not just reactive — it has personality, memory, and
 * makes decisions autonomously even during idle periods.
 */
export class AgentRuntime {
  private behaviorEngine: BehaviorEngine;
  private personalityEngine: PersonalityEngine;
  private memorySystem: MemorySystem;
  private brainClient: BrainClient;
  public overlayBridge: OverlayBridge;

  private isRunning = false;
  private loopInterval: NodeJS.Timeout | null = null;
  private readonly TICK_MS = 500;           // Agent loop frequency
  private readonly MIN_BRAIN_INTERVAL = 15_000; // Max 1 LLM call per 15s
  private lastBrainCallTime = 0;
  private lastRobotStateUpdate = 0;

  // Code context cache (updated via WS messages from sensor)
  private cachedCodeContext = {
    filePath: '',
    language: '',
    cursorLine: 0,
    surroundingCode: '',
  };
  private cachedDiagnostics: { errors: Array<{ message: string; line: number }> } = { errors: [] };

  // User identity (set during init)
  private userId = '';
  private username = '';

  // Logger callback
  private logFn: (source: string, level: string, message: string) => void;

  constructor(brainPort: number = 3000, logFn?: (source: string, level: string, message: string) => void) {
    this.behaviorEngine = new BehaviorEngine();
    this.personalityEngine = new PersonalityEngine();
    this.memorySystem = new MemorySystem();
    this.brainClient = new BrainClient(brainPort);
    this.overlayBridge = new OverlayBridge();
    this.logFn = logFn || ((source, level, msg) => console.log(`[${source}] ${msg}`));
  }

  setIdentity(userId: string, username: string): void {
    this.userId = userId;
    this.username = username;
  }

  /**
   * Start the autonomous agent loop.
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.logFn('agent', 'info', 'Agent runtime started — OBSERVE→UNDERSTAND→PLAN→ACT→VERIFY→LEARN');

    this.loopInterval = setInterval(() => this.tick(), this.TICK_MS);
  }

  /**
   * Stop the agent loop.
   */
  stop(): void {
    this.isRunning = false;
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
    }
    this.logFn('agent', 'info', 'Agent runtime stopped');
  }

  /**
   * Ingest a raw telemetry frame from the VS Code sensor.
   */
  ingestTelemetry(frame: TelemetryFrame): void {
    this.behaviorEngine.ingest(frame);
  }

  /**
   * Update the cached code context (called when sensor sends context data).
   */
  updateCodeContext(ctx: { filePath: string; language: string; cursorLine: number; surroundingCode: string }): void {
    this.cachedCodeContext = ctx;
  }

  /**
   * Update cached diagnostics.
   */
  updateDiagnostics(diags: { errors: Array<{ message: string; line: number }> }): void {
    this.cachedDiagnostics = diags;
  }

  // ═══════════════════════════════════════════
  // THE AGENTIC LOOP — runs every 500ms
  // ═══════════════════════════════════════════
  private async tick(): Promise<void> {
    try {
      // ──── OBSERVE ────
      const snapshot = this.behaviorEngine.getSnapshot();

      // ──── UNDERSTAND ────
      const behavioralState = this.behaviorEngine.classifyState();
      this.personalityEngine.tick(behavioralState);
      const personality = this.personalityEngine.getState();

      // Update memory with current state
      const errorMessages = this.cachedDiagnostics.errors.map(e => e.message);
      this.memorySystem.updateState(behavioralState, personality, errorMessages);

      // ──── Update robot visual state (every 2s) ────
      const now = Date.now();
      if (now - this.lastRobotStateUpdate > 2000) {
        this.lastRobotStateUpdate = now;
        const robotState: RobotState = {
          behavioralState,
          personality,
          avatarEmotion: this.personalityEngine.getDominantEmotion(),
          isIdle: behavioralState === BehavioralState.Normal,
        };
        this.overlayBridge.updateRobotState(robotState);
      }

      // ──── Should we ACT? ────
      const hasInflection = this.behaviorEngine.hasInflection();
      const wantsSpontaneous = this.personalityEngine.wantsSpontaneousAction();
      const canCallBrain = (now - this.lastBrainCallTime) > this.MIN_BRAIN_INTERVAL;

      if (!canCallBrain) return; // Rate-limit brain calls

      if (!hasInflection && !wantsSpontaneous) return; // Nothing to do

      // ──── PLAN (call the brain) ────
      this.lastBrainCallTime = now;
      const memory = this.memorySystem.getContextForBrain();

      const payload: AgentPayload = {
        userId: this.userId,
        username: this.username,
        behavioralState,
        personalityState: personality,
        telemetrySnapshot: {
          avgKST: snapshot.avgKST,
          errorDelta: snapshot.errorDelta,
          stagnationSeconds: snapshot.stagnationSeconds,
          wpm: snapshot.wpm,
        },
        codeContext: this.cachedCodeContext,
        diagnostics: this.cachedDiagnostics,
        memory,
      };

      this.logFn('agent', 'info',
        `Inflection detected: state=${behavioralState}, ` +
        `spontaneous=${wantsSpontaneous}, WPM=${snapshot.wpm}, ` +
        `errors=${snapshot.errorCount}`
      );

      const decision = await this.brainClient.evaluate(payload);

      // ──── ACT ────
      if (decision.action === 'stay_silent') {
        this.memorySystem.recordDecision(decision);
        return;
      }

      this.logFn('agent', 'info', `Acting: ${decision.action} — "${decision.content?.substring(0, 60)}"`);

      // Record in memory
      this.memorySystem.recordDecision(decision);
      this.personalityEngine.recordInteraction();

      // Dispatch to overlay
      this.overlayBridge.dispatchAction(decision);

      // Handle blocking actions
      if (decision.action === 'block_code_view') {
        this.overlayBridge.blockMouseFor(8000);
      }

      // ──── VERIFY (after 10 seconds) ────
      const priorState = behavioralState;
      setTimeout(() => {
        const postState = this.behaviorEngine.classifyState();
        const outcome = this.assessOutcome(priorState, postState, decision);

        // ──── LEARN ────
        this.memorySystem.recordOutcome({
          decision,
          priorState,
          postState,
          personalitySnapshot: this.personalityEngine.getState(),
          outcome,
          timestamp: Date.now(),
        });

        this.logFn('agent', 'info',
          `Outcome: ${outcome} (${priorState} → ${postState})`
        );
      }, 10_000);

    } catch (err) {
      this.logFn('agent', 'error', `Tick error: ${err}`);
    }
  }

  /**
   * Assess whether an action was effective based on state change.
   */
  private assessOutcome(
    priorState: BehavioralState,
    postState: BehavioralState,
    _decision: AgentDecision
  ): 'effective' | 'ignored' | 'backfired' {
    // If user was frustrated/stagnant and is now normal → effective
    if (
      (priorState === BehavioralState.Frustrated || priorState === BehavioralState.Stagnant) &&
      postState === BehavioralState.Normal
    ) {
      return 'effective';
    }

    // If state got worse → backfired
    if (priorState === BehavioralState.Frustrated && postState === BehavioralState.Manic) {
      return 'backfired';
    }
    if (priorState === BehavioralState.Normal && postState !== BehavioralState.Normal) {
      return 'backfired';
    }

    // Otherwise → ignored (no observable change)
    return 'ignored';
  }
}
