// ═══════════════════════════════════════════
// ANTI-COPILOT — Shared Type Definitions
// ═══════════════════════════════════════════

// ── Behavioral States (detected by BehaviorEngine) ──
export enum BehavioralState {
  Normal = 'normal',
  Frustrated = 'frustrated',
  Clueless = 'clueless',
  Manic = 'manic',
  Stagnant = 'stagnant',
  Arrogant = 'arrogant',
}

// ── Telemetry Frame (raw sensor data streamed via WebSocket) ──
export interface TelemetryFrame {
  type: 'telemetry';
  kst: number;      // ms since last keystroke
  err: { count: number; messages: string[] };
  txt: number;      // character length delta
  timestamp: number;
}

// ── Personality State (internal robot emotions) ──
export interface PersonalityState {
  mood: number;        // -1 (angry) to 1 (happy)
  curiosity: number;   // 0 to 1
  boredom: number;     // 0 to 1
  confidence: number;  // 0 to 1
  attachment: number;  // 0 to 1 (how much it "likes" the user)
  energy: number;      // 0 to 1
}

// ── Agent Decision (output from AWS Brain) ──
export interface AgentDecision {
  action: string;
  content: string;
  avatarEmotion: 'smug' | 'disgusted' | 'gleeful' | 'bored' | 'angry' | 'threatened' | 'curious' | 'neutral';
  confidence: number;
  reasoning: string;
  persona?: 'debugger' | 'meme' | 'support' | 'rival';
}

// ── Memory Records ──
export interface EpisodeRecord {
  decision: AgentDecision;
  priorState: BehavioralState;
  postState: BehavioralState;
  personalitySnapshot: PersonalityState;
  outcome: 'effective' | 'ignored' | 'backfired';
  timestamp: number;
}

export interface SemanticPattern {
  patternId: string;
  description: string;       // e.g. "User struggles with async bugs"
  confidence: number;
  observationCount: number;
  lastSeen: number;
}

// ── Working Memory (in-process session state) ──
export interface WorkingMemory {
  recentActions: AgentDecision[];
  currentBehavioralState: BehavioralState;
  currentPersonality: PersonalityState;
  sessionStartTime: number;
  interactionCount: number;
  activeErrors: string[];
}

// ── Agent Payload (sent to AWS Brain) ──
export interface AgentPayload {
  userId: string;
  username: string;
  behavioralState: BehavioralState;
  personalityState: PersonalityState;
  telemetrySnapshot: {
    avgKST: number;
    errorDelta: number;
    stagnationSeconds: number;
    wpm: number;
  };
  codeContext: {
    filePath: string;
    language: string;
    cursorLine: number;
    surroundingCode: string;
  };
  diagnostics: {
    errors: Array<{ message: string; line: number }>;
  };
  memory: {
    recentActions: string[];
    sessionInteractionCount: number;
    learnedPatterns: string[];
  };
}

// ── Action Types (for overlay rendering) ──
export enum ActionType {
  Mock = 'mock',
  Demotivate = 'demotivate',
  Gossip = 'gossip',
  PlayVideo = 'play_video',
  SendMeme = 'send_meme',
  BlockWindow = 'block_window',
  ForceLightMode = 'force_light_mode',
  FlashLightMode = 'flash_light_mode',
  SpeakRoast = 'speak_roast',
  TriggerTantrum = 'trigger_tantrum',
  FlashThemeStrobe = 'flash_theme_strobe',
  TriggerPeekaboo = 'trigger_peekaboo',
  PlayBrainrot = 'play_brainrot',
  ParentalOverride = 'parental_override',
  CritiqueCodeSemantics = 'critique_code_semantics',
  BlockCodeView = 'block_code_view',
  StaySilent = 'stay_silent',
}

// ── Robot Overlay State (sent from agent to renderer) ──
export interface RobotState {
  behavioralState: BehavioralState;
  personality: PersonalityState;
  avatarEmotion: AgentDecision['avatarEmotion'];
  isIdle: boolean;
}
