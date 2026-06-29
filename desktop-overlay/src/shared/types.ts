// ═══════════════════════════════════════════
// ANTI-COPILOT — Shared Type Definitions
// ═══════════════════════════════════════════

// ── Behavioral States (detected by the Observation Brain) ──
export enum BehavioralState {
  Normal = 'normal',
  Frustrated = 'frustrated',
  Clueless = 'clueless',
  Manic = 'manic',
  Stagnant = 'stagnant',
  Arrogant = 'arrogant',
  Triumphant = 'triumphant', // User SUCCEEDED — the gremlin's worst nightmare
}

// ── Gremlin State (internal state machine) ──
export enum GremlinState {
  Idle = 'idle',
  Bored = 'bored',
  Curious = 'curious',
  Teasing = 'teasing',
  Attacking = 'attacking',
  Defeated = 'defeated',
  Plotting = 'plotting',
}

// ── Telemetry Frame (raw sensor data streamed via WebSocket) ──
export interface TelemetryFrame {
  type: 'telemetry';
  kst: number;      // ms since last keystroke
  err: { count: number; messages: string[] };
  txt: number;      // character length delta
  timestamp: number;
}

// ── Personality State (the Gremlin's internal emotional life) ──
// mood is the key inversion: +1 = GLEEFUL (thriving on the user's pain),
// -1 = DEVASTATED (the user succeeded and the gremlin is sad).
export interface PersonalityState {
  mood: number;        // -1 (sad/defeated) to 1 (gleeful/evil)
  curiosity: number;   // 0 to 1
  boredom: number;     // 0 to 1 — drives spontaneous chaos
  confidence: number;  // 0 to 1
  attachment: number;  // 0 to 1 (how attached it is to tormenting THIS user)
  energy: number;      // 0 to 1
  chaos: number;       // 0 to 1 — appetite for disruption right now
  annoyance: number;   // 0 to 1 — how much it wants to lash out
}

// ── Fight-back: how the user reacts to an attack ──
export type UserReaction = 'shut_up' | 'youre_right' | 'apologize' | 'destroy';

// ── Avatar emotions the gremlin can wear ──
export type AvatarEmotion =
  | 'smug' | 'disgusted' | 'gleeful' | 'bored' | 'angry'
  | 'threatened' | 'curious' | 'neutral' | 'sad' | 'devastated';

// ── Agent Decision (output from the Chaos Agent / AWS Brain) ──
export interface AgentDecision {
  action: string;
  content: string;
  avatarEmotion: AvatarEmotion;
  confidence: number;
  reasoning: string;
  persona?: 'debugger' | 'meme' | 'support' | 'rival' | 'gremlin';
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

// ── Relationship Profile (how the gremlin knows THIS developer) ──
// This is what makes the 20th roast land harder than the 1st.
export interface RelationshipProfile {
  escalationLevel: number;                       // grows over the session — gremlin gets bolder
  totalInteractions: number;
  reactionCounts: Record<UserReaction, number>;  // how the user fights back
  favoriteAttack: string;                        // action the user reacts to most
  fears: string[];                               // recurring error themes ("CSS", "async", "types")
  triumphsWitnessed: number;                     // times the user actually succeeded (gremlin defeats)
}

// ── Working Memory (in-process session state) ──
export interface WorkingMemory {
  recentActions: AgentDecision[];
  currentBehavioralState: BehavioralState;
  currentPersonality: PersonalityState;
  sessionStartTime: number;
  interactionCount: number;
  activeErrors: string[];
  currentFile: string;           // what file the developer is editing right now
  fileStartTime: number;         // when they started editing this file
  currentArc: {
    problem: string;      // e.g., "errors in auth.ts" or "working on auth.ts"
    startedAt: number;
    timesMentioned: number;
    lastEscalation: string;
  } | null;
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
  // The gremlin's relationship with this developer + why it's striking now
  relationship?: {
    escalationLevel: number;
    favoriteAttack: string;
    fears: string[];
    triumphsWitnessed: number;
    lastReaction: UserReaction | 'none';
  };
  opportunity?: {
    score: number;          // how juicy this moment is for chaos
    trigger: string;        // why the chaos planner fired ("boredom", "success", "repeated_error")
    assignedAction: string; // The assigned action
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
  FlashThemeStrobe = 'flash_theme_strobe',
  TriggerPeekaboo = 'trigger_peekaboo',
  PlayBrainrot = 'play_brainrot',
  ParentalOverride = 'parental_override',
  CritiqueCodeSemantics = 'critique_code_semantics',
  BlockCodeView = 'block_code_view',
  FakeRewrite = 'fake_rewrite',
  StaySilent = 'stay_silent',
  
  // New Attack Library Actions
  ThemeSabotage = 'theme_sabotage',
  FontAttack = 'font_attack',
  FakePanic = 'fake_panic',
  CursorAttack = 'cursor_attack',
  FakeLoading = 'fake_loading',
  EditorDistraction = 'editor_distraction',
  SadReaction = 'sad_reaction',
  BlockScreen = 'block_screen',
}

// ── Robot Overlay State (sent from agent to renderer) ──
export interface RobotState {
  behavioralState: BehavioralState;
  gremlinState: GremlinState;
  personality: PersonalityState;
  avatarEmotion: AgentDecision['avatarEmotion'];
  isIdle: boolean;
}
