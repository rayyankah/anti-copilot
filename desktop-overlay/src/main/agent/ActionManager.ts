import { ActionType } from '../../shared/types';
import { ChaosOpportunity } from './ChaosPlanner';
import { MemorySystem } from './MemorySystem';

interface CooldownConfig {
  lastUsed: number;
  cooldownMs: number;
}

export class ActionManager {
  private cooldowns: Map<string, CooldownConfig> = new Map();
  private chaosLevel: number = 0; // The escalating intensity of the gremlin

  // Rolling-window rate cap for memes: at most MEME_MAX in any MEME_WINDOW_MS.
  private memeTimestamps: number[] = [];
  private readonly MEME_WINDOW_MS = 600_000; // 10 minutes
  private readonly MEME_MAX = 6;

  constructor(private memorySystem: MemorySystem) {
    this.initCooldowns();
  }

  private initCooldowns() {
    // Some attacks can be spammed, others should be rare
    this.cooldowns.set(ActionType.ThemeSabotage, { lastUsed: 0, cooldownMs: 120_000 });
    this.cooldowns.set(ActionType.FontAttack, { lastUsed: 0, cooldownMs: 300_000 });
    this.cooldowns.set(ActionType.FakePanic, { lastUsed: 0, cooldownMs: 600_000 });
    this.cooldowns.set(ActionType.CursorAttack, { lastUsed: 0, cooldownMs: 60_000 });
    this.cooldowns.set(ActionType.FakeLoading, { lastUsed: 0, cooldownMs: 120_000 });
    this.cooldowns.set(ActionType.EditorDistraction, { lastUsed: 0, cooldownMs: 180_000 });
    this.cooldowns.set(ActionType.PlayBrainrot, { lastUsed: 0, cooldownMs: 240_000 });
    this.cooldowns.set(ActionType.FlashThemeStrobe, { lastUsed: 0, cooldownMs: 120_000 });
    this.cooldowns.set(ActionType.BlockCodeView, { lastUsed: 0, cooldownMs: 300_000 });
    this.cooldowns.set(ActionType.Gossip, { lastUsed: 0, cooldownMs: 20_000 });
    this.cooldowns.set(ActionType.SpeakRoast, { lastUsed: 0, cooldownMs: 2_000 });
    this.cooldowns.set(ActionType.Mock, { lastUsed: 0, cooldownMs: 2_000 });
    this.cooldowns.set(ActionType.SendMeme, { lastUsed: 0, cooldownMs: 90_000 });
    this.cooldowns.set(ActionType.BlockScreen, { lastUsed: 0, cooldownMs: 300_000 });
  }

  /**
   * Attempts to execute the chosen action.
   * Checks cooldowns and escalation rules.
   * Returns true if allowed, false if blocked.
   */
  public attemptAction(opportunity: ChaosOpportunity): boolean {
    const action = opportunity.assignedAction;
    
    // Always allow stay_silent
    if (action === ActionType.StaySilent) return true;

    // Check Cooldown
    const config = this.cooldowns.get(action);
    if (config) {
      const now = Date.now();
      if (now - config.lastUsed < config.cooldownMs) {
        return false; // Rejected due to cooldown
      }
    }

    // Hard rolling-window cap for memes (max 6 per 10 minutes)
    if (action === ActionType.SendMeme && !this.memeBudgetAvailable()) {
      return false;
    }

    // ─── Escalation Logic ───
    const recentReactions = this.memorySystem.getLastReaction();
    if (recentReactions === 'none') {
       this.chaosLevel = Math.min(10, this.chaosLevel + 1);
    } else {
       // Interaction cools it down slightly
       this.chaosLevel = Math.max(0, this.chaosLevel - 2);
    }

    // If it's a high intensity attack, we might block it if chaos level is low
    const highIntensityAttacks = [ActionType.FakePanic, ActionType.BlockCodeView, ActionType.FontAttack, ActionType.BlockScreen];
    if (highIntensityAttacks.includes(action as ActionType) && this.chaosLevel < 4) {
       return false; // Not chaotic enough for this yet
    }

    // Accept the action
    return true;
  }

  /**
   * Mark the action as used to start its cooldown.
   */
  public recordActionUsed(action: string) {
    const config = this.cooldowns.get(action);
    if (config) {
      config.lastUsed = Date.now();
    }
    if (action === ActionType.SendMeme) {
      this.memeTimestamps.push(Date.now());
    }
  }

  /** True if we're still under the 6-memes-per-10-minutes budget. */
  private memeBudgetAvailable(): boolean {
    const cutoff = Date.now() - this.MEME_WINDOW_MS;
    this.memeTimestamps = this.memeTimestamps.filter((t) => t > cutoff);
    return this.memeTimestamps.length < this.MEME_MAX;
  }

  public getChaosLevel(): number {
    return this.chaosLevel;
  }
}
