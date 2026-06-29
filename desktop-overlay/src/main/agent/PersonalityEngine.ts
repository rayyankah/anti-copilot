import { BehavioralState, PersonalityState, UserReaction, AvatarEmotion, GremlinState } from '../../shared/types';

/**
 * PersonalityEngine — The Gremlin's emotional core.
 *
 * This is NOT a helpful assistant's mood tracker. It is the internal life of
 * a little demon living in the IDE. Its mood works BACKWARDS from a normal AI:
 *
 *   - User suffering (errors, frustration) → mood UP (glee), energy UP
 *   - User SUCCESS                          → mood DOWN (devastation), it is SAD
 *   - Silence / idle                        → boredom + chaos build until it acts
 *
 * It asks "what is the funniest thing I can do right now?", never "how can I help?".
 */
export class PersonalityEngine {
  private state: PersonalityState = {
    mood: 0.4,        // starts amused, a little smug
    curiosity: 0.5,
    boredom: 0.2,
    confidence: 0.8,  // "dangerously high"
    attachment: 0.2,
    energy: 0.8,
    chaos: 0.5,       // baseline appetite for disruption
    annoyance: 0.3,
  };

  private lastUpdateTime = Date.now();
  private lastInteractionTime = Date.now();
  private interactionCount = 0;
  
  private currentGremlinState: GremlinState = GremlinState.Idle;

  getState(): PersonalityState {
    return { ...this.state };
  }

  /**
   * Evolve the gremlin's emotions every tick (~500ms).
   */
  tick(behavioralState: BehavioralState): void {
    const now = Date.now();
    const dtSec = (now - this.lastUpdateTime) / 1000;
    this.lastUpdateTime = now;

    // ─── Time-based drift: boredom & chaos build during silence ───
    if (behavioralState === BehavioralState.Normal) {
      this.state.boredom = clamp(this.state.boredom + dtSec * 0.012, 0, 1);
      this.state.chaos = clamp(this.state.chaos + dtSec * 0.008, 0, 1);
      this.state.annoyance = clamp(this.state.annoyance + dtSec * 0.004, 0, 1);
      // Slow slide back toward smug baseline
      this.state.mood += (0.3 - this.state.mood) * dtSec * 0.02;
    } else {
      // Something is happening — boredom drains
      this.state.boredom = clamp(this.state.boredom - dtSec * 0.03, 0, 1);
    }

    // Curiosity flickers; energy slowly decays
    this.state.curiosity = clamp(this.state.curiosity + (Math.random() - 0.48) * dtSec * 0.01, 0, 1);
    this.state.energy = clamp(this.state.energy - dtSec * 0.0003, 0.1, 1);

    // ─── Reactions to the developer's state ───
    switch (behavioralState) {
      case BehavioralState.Frustrated:
        // This is its FAVORITE. Pure delight.
        this.state.mood = clamp(this.state.mood + dtSec * 0.08, -1, 1);
        this.state.energy = clamp(this.state.energy + dtSec * 0.02, 0.1, 1);
        this.state.chaos = clamp(this.state.chaos + dtSec * 0.03, 0, 1);
        this.state.confidence = clamp(this.state.confidence + dtSec * 0.01, 0, 1);
        break;

      case BehavioralState.Manic:
        // Chaos feeds chaos. It's thrilled.
        this.state.mood = clamp(this.state.mood + dtSec * 0.05, -1, 1);
        this.state.energy = clamp(this.state.energy + dtSec * 0.03, 0.1, 1);
        this.state.chaos = clamp(this.state.chaos + dtSec * 0.04, 0, 1);
        break;

      case BehavioralState.Clueless:
        // Amused, condescending.
        this.state.mood = clamp(this.state.mood + dtSec * 0.06, -1, 1);
        this.state.confidence = clamp(this.state.confidence + dtSec * 0.02, 0, 1);
        break;

      case BehavioralState.Stagnant:
        // Gets impatient and antsy — wants to poke.
        this.state.annoyance = clamp(this.state.annoyance + dtSec * 0.02, 0, 1);
        this.state.chaos = clamp(this.state.chaos + dtSec * 0.02, 0, 1);
        break;

      case BehavioralState.Arrogant:
        // Threatened by competence. Mood sours, wants to knock them down.
        this.state.confidence = clamp(this.state.confidence - dtSec * 0.02, 0, 1);
        this.state.annoyance = clamp(this.state.annoyance + dtSec * 0.03, 0, 1);
        this.state.chaos = clamp(this.state.chaos + dtSec * 0.02, 0, 1);
        break;

      case BehavioralState.Triumphant:
        // THE WORST. The user SUCCEEDED. The gremlin is devastated.
        this.state.mood = clamp(this.state.mood - dtSec * 0.25, -1, 1);
        this.state.energy = clamp(this.state.energy - dtSec * 0.05, 0.1, 1);
        this.state.confidence = clamp(this.state.confidence - dtSec * 0.04, 0, 1);
        this.state.annoyance = clamp(this.state.annoyance + dtSec * 0.05, 0, 1);
        break;

      case BehavioralState.Normal:
      default:
        break;
    }

    // ─── Gremlin State Machine (Determine current phase) ───
    if (behavioralState === BehavioralState.Triumphant) {
      this.currentGremlinState = GremlinState.Defeated;
    } else if (this.state.chaos > 0.8 && this.state.energy > 0.7) {
      this.currentGremlinState = GremlinState.Attacking;
    } else if (this.state.annoyance > 0.6 || this.state.chaos > 0.6) {
      this.currentGremlinState = GremlinState.Teasing;
    } else if (this.state.boredom > 0.7) {
      this.currentGremlinState = GremlinState.Plotting;
    } else if (this.state.boredom > 0.4) {
      this.currentGremlinState = GremlinState.Bored;
    } else if (this.state.curiosity > 0.7) {
      this.currentGremlinState = GremlinState.Curious;
    } else {
      this.currentGremlinState = GremlinState.Idle;
    }
  }

  getGremlinState(): GremlinState {
    return this.currentGremlinState;
  }

  /**
   * The gremlin acted (spoke / attacked). Resets boredom & chaos, grows attachment.
   */
  recordInteraction(): void {
    this.lastInteractionTime = Date.now();
    this.interactionCount++;
    this.state.boredom = clamp(this.state.boredom - 0.4, 0, 1);
    this.state.chaos = clamp(this.state.chaos - 0.3, 0, 1);
    this.state.annoyance = clamp(this.state.annoyance - 0.2, 0, 1);
    this.state.attachment = clamp(this.state.attachment + 0.02, 0, 1);
    this.state.energy = clamp(this.state.energy - 0.04, 0.1, 1);
  }

  /**
   * The user fought back. The gremlin LOVES conflict — it feeds engagement.
   */
  recordUserReaction(reaction: UserReaction): void {
    this.state.attachment = clamp(this.state.attachment + 0.05, 0, 1);
    switch (reaction) {
      case 'shut_up':
        // Being told to shut up is delicious. Escalate.
        this.state.mood = clamp(this.state.mood + 0.2, -1, 1);
        this.state.chaos = clamp(this.state.chaos + 0.25, 0, 1);
        this.state.annoyance = clamp(this.state.annoyance + 0.15, 0, 1);
        break;
      case 'destroy':
        // A threat! It's gleeful and defiant.
        this.state.mood = clamp(this.state.mood + 0.3, -1, 1);
        this.state.chaos = clamp(this.state.chaos + 0.35, 0, 1);
        this.state.confidence = clamp(this.state.confidence + 0.1, 0, 1);
        break;
      case 'youre_right':
        // Validation. Smug satisfaction, briefly calmer.
        this.state.mood = clamp(this.state.mood + 0.15, -1, 1);
        this.state.confidence = clamp(this.state.confidence + 0.15, 0, 1);
        this.state.chaos = clamp(this.state.chaos - 0.2, 0, 1);
        break;
      case 'apologize':
        // The user apologized to a piece of software. It savors the power.
        this.state.mood = clamp(this.state.mood + 0.25, -1, 1);
        this.state.confidence = clamp(this.state.confidence + 0.2, 0, 1);
        break;
    }
  }

  /**
   * Does the gremlin want to act on its own (no behavioral trigger)?
   * Driven by boredom, chaos appetite, and built-up annoyance.
   */
  wantsSpontaneousAction(): boolean {
    return (
      this.state.boredom > 0.75 ||
      this.state.chaos > 0.85 ||
      (this.state.annoyance > 0.7 && this.state.energy > 0.4)
    );
  }

  /**
   * Map internal state to the face the robot wears.
   */
  getDominantEmotion(): AvatarEmotion {
    // Devastation from a user success overrides everything
    if (this.state.mood < -0.6) return 'devastated';
    if (this.state.mood < -0.25) return 'sad';
    if (this.state.boredom > 0.75) return 'bored';
    if (this.state.annoyance > 0.7) return 'angry';
    if (this.state.chaos > 0.8 && this.state.mood > 0.3) return 'gleeful';
    if (this.state.confidence < 0.3) return 'threatened';
    if (this.state.mood > 0.5 && this.state.confidence > 0.6) return 'smug';
    if (this.state.curiosity > 0.75) return 'curious';
    if (this.state.mood > 0.3) return 'gleeful';
    return 'neutral';
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
