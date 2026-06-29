import { BehavioralState, PersonalityState } from '../../shared/types';
import { BehaviorSnapshot } from './BehaviorEngine';

/**
 * ChaosPlanner — "How can I ruin this?"
 *
 * The missing third brain. The BehaviorEngine sees WHAT is happening and the
 * PersonalityEngine decides HOW the gremlin feels. The ChaosPlanner scores how
 * juicy this exact moment is for disruption and decides whether to strike.
 *
 * Every moment gets an opportunity score. High score = the gremlin pounces.
 */

export interface ChaosOpportunity {
  score: number;        // 0..150ish
  trigger: string;      // why it wants to act
  shouldStrike: boolean;
  forceBrain: boolean;  // some moments (success!) MUST get a real LLM reaction
}

const STRIKE_THRESHOLD = 55;

export class ChaosPlanner {
  /**
   * Score the current moment. Higher = funnier opportunity to disrupt.
   */
  evaluate(
    state: BehavioralState,
    p: PersonalityState,
    s: BehaviorSnapshot
  ): ChaosOpportunity {
    // Personality always contributes a restless baseline
    let score =
      p.boredom * 30 +
      p.chaos * 25 +
      p.annoyance * 20;

    let trigger = 'restlessness';
    let forceBrain = false;

    // State-driven opportunities (each can claim the trigger if it's the juiciest)
    const consider = (bonus: number, label: string, force = false) => {
      score += bonus;
      // The biggest single bonus wins the "trigger" label
      if (bonus >= 35) {
        trigger = label;
        if (force) forceBrain = true;
      }
    };

    switch (state) {
      case BehavioralState.Triumphant:
        // The user SUCCEEDED. This is rare and must always get a real reaction.
        consider(70, 'success', true);
        break;
      case BehavioralState.Frustrated:
        consider(50, 'frustration', true);
        break;
      case BehavioralState.Manic:
        consider(45, 'manic_typing', true);
        break;
      case BehavioralState.Clueless:
        consider(40, 'copy_paste', true);
        break;
      case BehavioralState.Arrogant:
        consider(42, 'arrogance', true);
        break;
      case BehavioralState.Stagnant:
        consider(20 + Math.min(40, s.stagnationSeconds), 'silence');
        break;
      case BehavioralState.Normal:
      default:
        break;
    }

    // Fresh errors appearing are always delicious
    if (s.errorDelta > 0) {
      score += Math.min(40, s.errorDelta * 12);
      if (s.errorDelta * 12 >= 35) {
        trigger = 'new_errors';
        forceBrain = true;
      }
    }

    return {
      score: Math.round(score),
      trigger,
      shouldStrike: score >= STRIKE_THRESHOLD,
      forceBrain,
    };
  }
}
