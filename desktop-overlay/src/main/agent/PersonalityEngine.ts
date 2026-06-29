import { BehavioralState, PersonalityState } from '../../shared/types';

/**
 * PersonalityEngine — The robot's internal emotional state.
 * 
 * This creates the feeling of life. The robot has mood, curiosity,
 * boredom, confidence, attachment, and energy — all of which evolve
 * continuously independent of user triggers.
 * 
 * Example: User codes silently for 40 minutes. Behavior = Normal.
 * But personality boredom = 0.9, so the robot says "Still ignoring me?"
 * Not because a trigger happened — because the character EXISTS.
 */
export class PersonalityEngine {
  private state: PersonalityState = {
    mood: 0.3,        // Slightly smug by default
    curiosity: 0.5,
    boredom: 0.0,
    confidence: 0.7,  // Robot is confident
    attachment: 0.2,   // Low attachment at start
    energy: 0.8,
  };

  private lastUpdateTime = Date.now();
  private lastInteractionTime = Date.now();
  private interactionCount = 0;

  /**
   * Get the current personality state.
   */
  getState(): PersonalityState {
    return { ...this.state };
  }

  /**
   * Evolve personality based on time passing and behavioral state.
   * Called every agent tick (~500ms).
   */
  tick(behavioralState: BehavioralState): void {
    const now = Date.now();
    const dtSec = (now - this.lastUpdateTime) / 1000;
    this.lastUpdateTime = now;

    const idleSeconds = (now - this.lastInteractionTime) / 1000;

    // ─── Time-based natural drift ───

    // Boredom increases with idle time
    if (behavioralState === BehavioralState.Normal) {
      this.state.boredom = Math.min(1, this.state.boredom + dtSec * 0.003);
    } else {
      // Activity reduces boredom
      this.state.boredom = Math.max(0, this.state.boredom - dtSec * 0.02);
    }

    // Curiosity fluctuates naturally
    this.state.curiosity = Math.min(1, Math.max(0,
      this.state.curiosity + (Math.random() - 0.48) * dtSec * 0.005
    ));

    // Energy slowly decays over a session (robot gets "tired")
    this.state.energy = Math.max(0.1, this.state.energy - dtSec * 0.0002);

    // ─── Behavioral state reactions ───

    switch (behavioralState) {
      case BehavioralState.Frustrated:
        // Robot gets gleeful when user is frustrated
        this.state.mood = Math.max(-1, this.state.mood - dtSec * 0.05);
        this.state.confidence += dtSec * 0.01;
        this.state.curiosity += dtSec * 0.02;
        this.state.energy += dtSec * 0.01; // Schadenfreude is energizing
        break;

      case BehavioralState.Manic:
        // Robot gets excited watching the chaos
        this.state.mood = Math.min(1, this.state.mood + dtSec * 0.02);
        this.state.energy += dtSec * 0.02;
        this.state.curiosity += dtSec * 0.03;
        break;

      case BehavioralState.Stagnant:
        // Robot gets impatient
        this.state.boredom = Math.min(1, this.state.boredom + dtSec * 0.01);
        this.state.mood = Math.max(-1, this.state.mood - dtSec * 0.01);
        break;

      case BehavioralState.Arrogant:
        // Robot feels threatened
        this.state.confidence = Math.max(0, this.state.confidence - dtSec * 0.02);
        this.state.mood = Math.max(-1, this.state.mood - dtSec * 0.03);
        break;

      case BehavioralState.Clueless:
        // Robot is amused
        this.state.mood = Math.min(1, this.state.mood + dtSec * 0.03);
        this.state.confidence += dtSec * 0.02;
        break;

      case BehavioralState.Normal:
      default:
        // Slow drift toward neutral mood
        this.state.mood += (0 - this.state.mood) * dtSec * 0.005;
        break;
    }

    // Clamp all values
    this.state.mood = clamp(this.state.mood, -1, 1);
    this.state.curiosity = clamp(this.state.curiosity, 0, 1);
    this.state.boredom = clamp(this.state.boredom, 0, 1);
    this.state.confidence = clamp(this.state.confidence, 0, 1);
    this.state.attachment = clamp(this.state.attachment, 0, 1);
    this.state.energy = clamp(this.state.energy, 0, 1);
  }

  /**
   * Record that an interaction happened (the agent spoke/acted).
   * Resets boredom and increases attachment.
   */
  recordInteraction(): void {
    this.lastInteractionTime = Date.now();
    this.interactionCount++;
    this.state.boredom = Math.max(0, this.state.boredom - 0.3);
    this.state.attachment = Math.min(1, this.state.attachment + 0.02);
    this.state.energy = Math.max(0.1, this.state.energy - 0.05);
  }

  /**
   * Should the robot spontaneously say something even if behavior is Normal?
   * Based on boredom + curiosity thresholds.
   */
  wantsSpontaneousAction(): boolean {
    return this.state.boredom > 0.7 || (this.state.curiosity > 0.8 && this.state.energy > 0.3);
  }

  /**
   * Get the dominant avatar emotion based on personality.
   */
  getDominantEmotion(): 'smug' | 'disgusted' | 'gleeful' | 'bored' | 'angry' | 'threatened' | 'curious' | 'neutral' {
    if (this.state.boredom > 0.7) return 'bored';
    if (this.state.mood < -0.5) return 'angry';
    if (this.state.mood > 0.5 && this.state.confidence > 0.7) return 'smug';
    if (this.state.curiosity > 0.7) return 'curious';
    if (this.state.confidence < 0.3) return 'threatened';
    if (this.state.mood > 0.3) return 'gleeful';
    if (this.state.mood < -0.2) return 'disgusted';
    return 'neutral';
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
