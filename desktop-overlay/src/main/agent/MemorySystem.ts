import {
  AgentDecision,
  BehavioralState,
  PersonalityState,
  WorkingMemory,
  EpisodeRecord,
  SemanticPattern,
  RelationshipProfile,
  UserReaction,
} from '../../shared/types';

// Recurring error themes the gremlin can weaponize as "fears"
const FEAR_KEYWORDS: Array<{ key: string; re: RegExp }> = [
  { key: 'async bugs',   re: /async|await|promise|then\(/i },
  { key: 'type errors',  re: /type|TS\d{4}|not assignable|undefined is not/i },
  { key: 'CSS',          re: /css|flex|grid|z-index|margin|padding/i },
  { key: 'null/undefined', re: /null|undefined|cannot read propert/i },
  { key: 'imports',      re: /cannot find module|import|export|require/i },
  { key: 'syntax',       re: /syntaxerror|unexpected token|expected/i },
  { key: 'references',   re: /referenceerror|is not defined/i },
];

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
      mood: 0.4,
      curiosity: 0.5,
      boredom: 0.2,
      confidence: 0.8,
      attachment: 0.2,
      energy: 0.8,
      chaos: 0.5,
      annoyance: 0.3,
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

  // ─── Relationship Memory (how it knows THIS developer) ───
  private relationship: RelationshipProfile = {
    escalationLevel: 1,
    totalInteractions: 0,
    reactionCounts: { shut_up: 0, youre_right: 0, apologize: 0, destroy: 0 },
    favoriteAttack: 'none',
    fears: [],
    triumphsWitnessed: 0,
  };
  private lastReaction: UserReaction | 'none' = 'none';
  private actionCounts: Record<string, number> = {};

  // ═══ Working Memory ═══

  getWorkingMemory(): WorkingMemory {
    return { ...this.working };
  }

  updateState(state: BehavioralState, personality: PersonalityState, errors: string[]): void {
    this.working.currentBehavioralState = state;
    this.working.currentPersonality = { ...personality };
    this.working.activeErrors = errors;

    // Learn the developer's recurring weaknesses from their errors → "fears"
    for (const err of errors) {
      for (const { key, re } of FEAR_KEYWORDS) {
        if (re.test(err) && !this.relationship.fears.includes(key)) {
          this.relationship.fears.push(key);
          if (this.relationship.fears.length > 6) this.relationship.fears.shift();
        }
      }
    }

    // Witnessing a success is a defeat the gremlin never forgets
    if (state === BehavioralState.Triumphant) {
      this.relationship.triumphsWitnessed++;
    }
  }

  // ═══ Relationship Memory ═══

  /**
   * Seed the relationship from persisted storage (DynamoDB) at session start.
   * This is what lets the gremlin remember a developer across sessions —
   * picking up its escalation, the user's fears, and old defeats.
   */
  seedRelationship(profile: {
    escalationLevel?: number;
    favoriteAttack?: string;
    fears?: string[];
    triumphsWitnessed?: number;
  }): void {
    if (!profile) return;
    if (typeof profile.escalationLevel === 'number') {
      this.relationship.escalationLevel = profile.escalationLevel;
    }
    if (profile.favoriteAttack) this.relationship.favoriteAttack = profile.favoriteAttack;
    if (Array.isArray(profile.fears)) this.relationship.fears = profile.fears.slice(0, 6);
    if (typeof profile.triumphsWitnessed === 'number') {
      this.relationship.triumphsWitnessed = profile.triumphsWitnessed;
    }
  }

  /**
   * The user fought back against an attack. Record it and let the gremlin escalate.
   */
  recordUserReaction(reaction: UserReaction): void {
    this.relationship.reactionCounts[reaction]++;
    this.lastReaction = reaction;
    this.relationship.escalationLevel = Math.min(10, this.relationship.escalationLevel + 0.5);
  }

  getRelationship(): RelationshipProfile {
    // Favorite attack = the action the user has provoked / reacted to most
    let favorite = 'none';
    let max = 0;
    for (const [action, count] of Object.entries(this.actionCounts)) {
      if (count > max) { max = count; favorite = action; }
    }
    this.relationship.favoriteAttack = favorite;
    this.relationship.totalInteractions = this.working.interactionCount;
    return { ...this.relationship };
  }

  getLastReaction(): UserReaction | 'none' {
    return this.lastReaction;
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
    // Track how often each attack is used (drives "favorite attack")
    this.actionCounts[decision.action] = (this.actionCounts[decision.action] || 0) + 1;
    // The gremlin slowly grows bolder the longer it torments this developer
    if (this.working.interactionCount % 5 === 0) {
      this.relationship.escalationLevel = Math.min(10, this.relationship.escalationLevel + 0.5);
    }
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
    // Include content so the brain knows what it already said and can avoid repeating
    const recentWithContent = this.working.recentActions.map(a =>
      a.content ? `${a.action}: "${a.content.slice(0, 60)}"` : a.action
    );
    return {
      recentActions: recentWithContent,
      sessionInteractionCount: this.working.interactionCount,
      learnedPatterns: this.getLearnedPatterns(),
    };
  }
}
