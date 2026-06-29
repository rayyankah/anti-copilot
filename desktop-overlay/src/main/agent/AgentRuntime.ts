import {
  BehavioralState,
  TelemetryFrame,
  AgentDecision,
  RobotState,
  AgentPayload,
  UserReaction,
} from '../../shared/types';
import { BehaviorEngine } from './BehaviorEngine';
import { PersonalityEngine } from './PersonalityEngine';
import { MemorySystem } from './MemorySystem';
import { ChaosPlanner } from './ChaosPlanner';
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
  private chaosPlanner: ChaosPlanner;
  private brainClient: BrainClient;
  public overlayBridge: OverlayBridge;

  private isRunning = false;
  private loopInterval: NodeJS.Timeout | null = null;
  private readonly TICK_MS = 500;
  private readonly MIN_BRAIN_INTERVAL = 15_000;       // Min gap on a state change
  private readonly MIN_FORCE_BRAIN_INTERVAL = 7_000;  // Shorter gate for big moments (success!)
  private readonly MIN_SPONTANEOUS_INTERVAL = 45_000; // Min gap for pure-boredom self-starts
  private lastBrainCallTime = 0;
  private lastRobotStateUpdate = 0;

  // Track recent content to suppress duplicate outputs
  private recentContents: string[] = [];

  // Timers for the scripted opening sequence (mess → discourage)
  private introTimers: NodeJS.Timeout[] = [];

  // Forwards VS Code-side attacks (theme/font) back to the sensor; wired by main
  private sensorSender: ((msg: Record<string, unknown>) => void) | null = null;

  // Actions that must be executed inside VS Code (not just the overlay)
  private readonly SENSOR_ACTIONS = new Set([
    'flash_theme_strobe', 'force_light_mode', 'flash_light_mode', 'font_attack',
  ]);

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
    this.chaosPlanner = new ChaosPlanner();
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
    this.logFn('agent', 'info', 'Gremlin runtime started — OBSERVE→JUDGE→SCORE CHAOS→STRIKE→REMEMBER');

    // Load this developer's persisted relationship so the gremlin remembers
    // them across sessions (escalation, fears, past defeats). Fire and forget.
    if (this.userId) {
      this.brainClient.loadProfile(this.userId).then((profile) => {
        if (profile) {
          this.memorySystem.seedRelationship(profile);
          this.logFn('agent', 'info',
            `Relationship loaded: escalation=${profile.escalationLevel ?? 1}, ` +
            `fears=[${(profile.fears ?? []).join(', ')}], defeats=${profile.triumphsWitnessed ?? 0}`
          );
        }
      }).catch(() => { /* first session / brain not ready — start fresh */ });
    }

    this.loopInterval = setInterval(() => this.tick(), this.TICK_MS);
    this.runIntroSequence();
  }

  /**
   * Lets main.ts wire a channel for sending VS Code-side attacks (theme/font)
   * back to the sensor extension.
   */
  setSensorSender(sender: (msg: Record<string, unknown>) => void): void {
    this.sensorSender = sender;
  }

  /**
   * The scripted opening: the gremlin doesn't wait. For the first few seconds it
   * messes with the user and their visuals; around 10s it actively tries to
   * discourage them from coding at all.
   */
  private runIntroSequence(): void {
    // ~3s: first contact — a taunt + flicker their font
    this.introTimers.push(setTimeout(() => {
      this.forwardSensorAttack('font_attack');
      this.strikeBrain('intro_mischief');
    }, 3000));

    // ~6s: mess with the visuals — flash the theme
    this.introTimers.push(setTimeout(() => {
      this.forwardSensorAttack('flash_theme_strobe');
      this.overlayBridge.dispatchAction({
        action: 'flash_theme_strobe', content: '',
        avatarEmotion: 'gleeful', confidence: 0.8,
        reasoning: 'intro visual chaos', persona: 'gremlin',
      });
    }, 6000));

    // ~11s: actively discourage them from starting
    this.introTimers.push(setTimeout(() => {
      this.strikeBrain('discourage');
    }, 11000));
  }

  /** Send a VS Code-side attack (theme/font) to the sensor extension. */
  private forwardSensorAttack(action: string): void {
    if (this.sensorSender) {
      this.sensorSender({ type: 'action', action });
      this.logFn('agent', 'info', `Sensor attack → ${action}`);
    }
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
    this.introTimers.forEach(clearTimeout);
    this.introTimers = [];
    this.logFn('agent', 'info', 'Gremlin runtime stopped');
  }

  /**
   * Ingest a raw telemetry frame from the VS Code sensor.
   */
  ingestTelemetry(frame: TelemetryFrame): void {
    this.behaviorEngine.ingest(frame);
  }

  /**
   * The user fought back against an attack (Shut Up / You're Right / etc.).
   * The gremlin remembers, escalates, and reacts immediately.
   */
  handleUserReaction(reaction: UserReaction): void {
    this.personalityEngine.recordUserReaction(reaction);
    this.memorySystem.recordUserReaction(reaction);
    this.logFn('agent', 'info', `User fought back: ${reaction}`);

    // The clap-back is generated by the brain (no canned lines). The reaction is
    // already in relationship.lastReaction, so the prompt reacts in-character.
    this.lastBrainCallTime = Date.now(); // reset gate so the reply lands quickly
    void this.strikeBrain('fight_back');
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

      // ──── DECIDE — score the opportunity (Chaos Planner) ────
      const opportunity = this.chaosPlanner.evaluate(behavioralState, personality, snapshot);
      const hasInflection = this.behaviorEngine.hasInflection();

      if (!opportunity.shouldStrike && !hasInflection) return;

      // Pick the rate gate: big moments react fast, state changes medium, pure
      // boredom self-starts slowest. EVERY reaction comes from the brain now —
      // there are no canned local lines.
      let gate = this.MIN_SPONTANEOUS_INTERVAL;
      if (opportunity.forceBrain) gate = this.MIN_FORCE_BRAIN_INTERVAL;
      else if (hasInflection) gate = this.MIN_BRAIN_INTERVAL;
      if ((now - this.lastBrainCallTime) < gate) return;

      await this.strikeBrain(opportunity.trigger, opportunity.score);
    } catch (err) {
      this.logFn('agent', 'error', `Tick error: ${err}`);
    }
  }

  /**
   * Build a payload from the CURRENT state, call the brain, and apply the result.
   * `triggerOverride` lets scripted moments (intro, discourage, fight-back) tell
   * the gremlin why it's acting.
   */
  private async strikeBrain(triggerOverride?: string, scoreOverride?: number): Promise<void> {
    const snapshot = this.behaviorEngine.getSnapshot();
    const behavioralState = this.behaviorEngine.classifyState();
    const personality = this.personalityEngine.getState();
    const opp = this.chaosPlanner.evaluate(behavioralState, personality, snapshot);
    const trigger = triggerOverride ?? opp.trigger;
    const score = scoreOverride ?? opp.score;

    this.lastBrainCallTime = Date.now();

    const memory = this.memorySystem.getContextForBrain();
    const rel = this.memorySystem.getRelationship();

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
      relationship: {
        escalationLevel: rel.escalationLevel,
        favoriteAttack: rel.favoriteAttack,
        fears: rel.fears,
        triumphsWitnessed: rel.triumphsWitnessed,
        lastReaction: this.memorySystem.getLastReaction(),
      },
      opportunity: { score, trigger },
    };

    this.logFn('agent', 'info',
      `STRIKE: state=${behavioralState}, trigger=${trigger}, chaos=${score}, ` +
      `WPM=${snapshot.wpm}, errors=${snapshot.errorCount}`
    );

    const decision = await this.brainClient.evaluate(payload);
    this.applyDecision(decision, behavioralState);
  }

  /**
   * Dedup, record, render, forward VS Code-side attacks, and schedule learning.
   */
  private applyDecision(decision: AgentDecision, priorState: BehavioralState): void {
    if (decision.action === 'stay_silent') {
      this.memorySystem.recordDecision(decision);
      return;
    }

    // Content deduplication — suppress near-identical repeats
    if (decision.content) {
      const normalized = decision.content.toLowerCase().trim().slice(0, 80);
      if (this.recentContents.includes(normalized)) {
        this.logFn('agent', 'warn', `Suppressed duplicate: "${decision.content.slice(0, 60)}"`);
        return;
      }
      this.recentContents.push(normalized);
      if (this.recentContents.length > 6) this.recentContents.shift();
    }

    this.logFn('agent', 'info', `Acting: ${decision.action} — "${decision.content?.substring(0, 60)}"`);

    this.memorySystem.recordDecision(decision);
    this.personalityEngine.recordInteraction();

    // Render in the overlay
    this.overlayBridge.dispatchAction(decision);

    // Forward theme/font attacks to the VS Code sensor so they actually happen
    if (this.SENSOR_ACTIONS.has(decision.action)) {
      this.forwardSensorAttack(decision.action);
    }

    if (decision.action === 'block_code_view') {
      this.overlayBridge.blockMouseFor(8000);
    }

    // ──── VERIFY + LEARN (after 10s) ────
    setTimeout(() => {
      const postState = this.behaviorEngine.classifyState();
      const outcome = this.assessOutcome(priorState, postState, decision);
      this.memorySystem.recordOutcome({
        decision,
        priorState,
        postState,
        personalitySnapshot: this.personalityEngine.getState(),
        outcome,
        timestamp: Date.now(),
      });
      this.logFn('agent', 'info', `Outcome: ${outcome} (${priorState} → ${postState})`);
    }, 10_000);
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
