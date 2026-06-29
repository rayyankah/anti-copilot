import {
  AgentDecision,
  BehavioralState,
  PersonalityState,
  WorkingMemory,
  EpisodeRecord,
  SemanticPattern,
} from '../../shared/types';

/**
 * MemorySystem — Three-tier memory for the autonomous agent.
 * 
 * Working Memory: In-process, current session only.
 * Episodic Memory: Timestamped records of every interaction (future: DynamoDB).
 * Semantic Memory: Learned patterns about the user (future: DynamoDB).
 */
export class MemorySystem {
  // ─── Working Memory (in-process) ───
  private working: WorkingMemory = {
    recentActions: [],
    currentBehavioralState: BehavioralState.Normal,
    currentPersonality: {
      mood: 0.3,
      curiosity: 0.5,
      boredom: 0,
      confidence: 0.7,
      attachment: 0.2,
      energy: 0.8,
    },
    sessionStartTime: Date.now(),
    interactionCount: 0,
    activeErrors: [],
  };

  // ─── Episodic Memory (local buffer, flush to DynamoDB later) ───
  private episodes: EpisodeRecord[] = [];
  private readonly MAX_EPISODES = 100;

  // ─── Semantic Memory (learned patterns) ───
  private patterns: SemanticPattern[] = [];

  // ═══ Working Memory ═══

  getWorkingMemory(): WorkingMemory {
    return { ...this.working };
  }

  updateState(state: BehavioralState, personality: PersonalityState, errors: string[]): void {
    this.working.currentBehavioralState = state;
    this.working.currentPersonality = { ...personality };
    this.working.activeErrors = errors;
  }

  getRecentActionNames(): string[] {
    return this.working.recentActions.map(a => a.action);
  }

  getLastAction(): string {
    const actions = this.working.recentActions;
    return actions.length > 0 ? actions[actions.length - 1].action : 'none';
  }

  // ═══ Episodic Memory ═══

  /**
   * Record a decision the agent made.
   */
  recordDecision(decision: AgentDecision): void {
    this.working.recentActions.push(decision);
    if (this.working.recentActions.length > 10) {
      this.working.recentActions.shift();
    }
    this.working.interactionCount++;
  }

  /**
   * Record the outcome of an action (called ~10s after acting).
   */
  recordOutcome(record: EpisodeRecord): void {
    this.episodes.push(record);
    if (this.episodes.length > this.MAX_EPISODES) {
      this.episodes.shift();
    }

    // Update semantic patterns based on outcome
    this.learnFromOutcome(record);
  }

  getRecentEpisodes(count: number = 5): EpisodeRecord[] {
    return this.episodes.slice(-count);
  }

  // ═══ Semantic Memory ═══

  getLearnedPatterns(): string[] {
    return this.patterns.map(p => p.description);
  }

  /**
   * Learn from an interaction outcome.
   * If a certain action was effective in a certain state, remember that.
   */
  private learnFromOutcome(record: EpisodeRecord): void {
    const patternKey = `${record.priorState}_${record.decision.action}`;
    const existing = this.patterns.find(p => p.patternId === patternKey);

    if (existing) {
      existing.observationCount++;
      existing.lastSeen = record.timestamp;
      // Update confidence based on outcome
      if (record.outcome === 'effective') {
        existing.confidence = Math.min(1, existing.confidence + 0.1);
      } else if (record.outcome === 'backfired') {
        existing.confidence = Math.max(0, existing.confidence - 0.15);
      }
    } else {
      this.patterns.push({
        patternId: patternKey,
        description: `${record.decision.action} when ${record.priorState}: ${record.outcome}`,
        confidence: record.outcome === 'effective' ? 0.6 : 0.3,
        observationCount: 1,
        lastSeen: record.timestamp,
      });
    }

    // Prune low-confidence patterns
    this.patterns = this.patterns.filter(p => p.confidence > 0.1 || p.observationCount > 3);
  }

  /**
   * Get context for the brain API — a summary of what the agent remembers.
   */
  getContextForBrain(): {
    recentActions: string[];
    sessionInteractionCount: number;
    learnedPatterns: string[];
  } {
    return {
      recentActions: this.getRecentActionNames(),
      sessionInteractionCount: this.working.interactionCount,
      learnedPatterns: this.getLearnedPatterns(),
    };
  }
}
