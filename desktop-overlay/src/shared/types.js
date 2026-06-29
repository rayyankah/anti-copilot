"use strict";
// ═══════════════════════════════════════════
// ANTI-COPILOT — Shared Type Definitions
// ═══════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionType = exports.BehavioralState = void 0;
// ── Behavioral States (detected by BehaviorEngine) ──
var BehavioralState;
(function (BehavioralState) {
    BehavioralState["Normal"] = "normal";
    BehavioralState["Frustrated"] = "frustrated";
    BehavioralState["Clueless"] = "clueless";
    BehavioralState["Manic"] = "manic";
    BehavioralState["Stagnant"] = "stagnant";
    BehavioralState["Arrogant"] = "arrogant";
})(BehavioralState || (exports.BehavioralState = BehavioralState = {}));
// ── Action Types (for overlay rendering) ──
var ActionType;
(function (ActionType) {
    ActionType["Mock"] = "mock";
    ActionType["Demotivate"] = "demotivate";
    ActionType["Gossip"] = "gossip";
    ActionType["PlayVideo"] = "play_video";
    ActionType["SendMeme"] = "send_meme";
    ActionType["BlockWindow"] = "block_window";
    ActionType["ForceLightMode"] = "force_light_mode";
    ActionType["FlashLightMode"] = "flash_light_mode";
    ActionType["SpeakRoast"] = "speak_roast";
    ActionType["TriggerTantrum"] = "trigger_tantrum";
    ActionType["FlashThemeStrobe"] = "flash_theme_strobe";
    ActionType["TriggerPeekaboo"] = "trigger_peekaboo";
    ActionType["PlayBrainrot"] = "play_brainrot";
    ActionType["ParentalOverride"] = "parental_override";
    ActionType["CritiqueCodeSemantics"] = "critique_code_semantics";
    ActionType["BlockCodeView"] = "block_code_view";
    ActionType["StaySilent"] = "stay_silent";
})(ActionType || (exports.ActionType = ActionType = {}));
