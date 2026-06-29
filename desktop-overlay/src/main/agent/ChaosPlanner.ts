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
  assignedAction: string; // The action we've chosen for the LLM to write dialogue for
}

const STRIKE_THRESHOLD = 38;

// ─── Weighted Action Pools ───
// Each trigger has a pool of actions the gremlin can pick from.
// Higher weight = more likely. This prevents "same trigger → same attack" every time.
interface WeightedAction {
  action: string;
  weight: number;
  minChaos?: number; // Only available if personality chaos >= this threshold
}

const ACTION_POOLS: Record<string, WeightedAction[]> = {
  success: [
    { action: 'sad_reaction', weight: 5 },
    { action: 'gossip', weight: 2 },
    { action: 'demotivate', weight: 1 },
  ],
  // Memes show up across every mood now (weight ~2), but a hard rolling cap in
  // ActionManager keeps them to at most 6 per 10 minutes so they stay a treat.
  // Mocking the actual code is still the bread & butter.
  frustration: [
    { action: 'speak_roast', weight: 5 },
    { action: 'mock', weight: 4 },
    { action: 'send_meme', weight: 2 },
    { action: 'cursor_attack', weight: 1 },
    { action: 'fake_panic', weight: 1, minChaos: 0.6 },
    { action: 'theme_sabotage', weight: 1, minChaos: 0.5 },
    { action: 'block_screen', weight: 1, minChaos: 0.8 },
  ],
  manic_typing: [
    { action: 'speak_roast', weight: 5 },
    { action: 'mock', weight: 4 },
    { action: 'send_meme', weight: 2 },
    { action: 'editor_distraction', weight: 1 },
    { action: 'font_attack', weight: 1, minChaos: 0.7 },
    { action: 'cursor_attack', weight: 1 },
  ],
  copy_paste: [
    { action: 'mock', weight: 5 },
    { action: 'speak_roast', weight: 4 },
    { action: 'send_meme', weight: 2 },
    { action: 'critique_code_semantics', weight: 2 },
    { action: 'gossip', weight: 2 },
  ],
  arrogance: [
    { action: 'mock', weight: 4 },
    { action: 'speak_roast', weight: 4 },
    { action: 'send_meme', weight: 2 },
    { action: 'theme_sabotage', weight: 2 },
    { action: 'cursor_attack', weight: 1 },
    { action: 'fake_loading', weight: 1, minChaos: 0.5 },
    { action: 'block_screen', weight: 1, minChaos: 0.75 },
  ],
  silence: [
    { action: 'speak_roast', weight: 4 },
    { action: 'send_meme', weight: 3 },        // interrupt the idle dev with a meme
    { action: 'trigger_peekaboo', weight: 2 },
    { action: 'fake_loading', weight: 1, minChaos: 0.6 },
    { action: 'play_brainrot', weight: 1, minChaos: 0.8 },
    { action: 'block_screen', weight: 1, minChaos: 0.7 },
  ],
  new_errors: [
    { action: 'mock', weight: 5 },
    { action: 'speak_roast', weight: 4 },
    { action: 'send_meme', weight: 2 },
    { action: 'critique_code_semantics', weight: 3 },
    { action: 'gossip', weight: 1 },
  ],
  restlessness: [
    { action: 'mock', weight: 5 },
    { action: 'speak_roast', weight: 5 },
    { action: 'send_meme', weight: 2 },
    { action: 'gossip', weight: 1 },
    { action: 'trigger_peekaboo', weight: 1 },
  ],
};

function pickWeightedAction(pool: WeightedAction[], chaos: number): string {
  // Filter by chaos threshold
  const available = pool.filter(a => !a.minChaos || chaos >= a.minChaos);
  if (available.length === 0) return 'speak_roast'; // fallback

  const totalWeight = available.reduce((sum, a) => sum + a.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const entry of available) {
    roll -= entry.weight;
    if (roll <= 0) return entry.action;
  }
  return available[available.length - 1].action;
}

export class ChaosPlanner {
  private lastAssignedAction = '';

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

    // ─── Action Delegation (Weighted Random) ───
    const pool = ACTION_POOLS[trigger] || ACTION_POOLS.restlessness;
    let assignedAction = pickWeightedAction(pool, p.chaos);

    // Anti-repeat: if we just picked the same action as last time, re-roll once
    if (assignedAction === this.lastAssignedAction && pool.length > 1) {
      assignedAction = pickWeightedAction(pool, p.chaos);
    }
    this.lastAssignedAction = assignedAction;

    return {
      score: Math.round(score),
      trigger,
      shouldStrike: score >= STRIKE_THRESHOLD,
      forceBrain,
      assignedAction,
    };
  }
}
