export enum TriggerType {
  BlankSpace = 'blank_space',
  Code = 'code',
  TerminalError = 'terminal_error',
  Pause = 'pause',
  LargePaste = 'large_paste',
  TripleError = 'triple_error',
  DirtyCommit = 'dirty_commit',
}

export enum ActionType {
  Mock = 'mock',
  Demotivate = 'demotivate',
  Gossip = 'gossip',
  PlayVideo = 'play_video',
  SendMeme = 'send_meme',
  CreateWindow = 'create_window',
  BlockWindow = 'block_window',
  ForceLightMode = 'force_light_mode',
}

export interface TelemetryEntry {
  pk: string;
  sk: string;
  trigger: TriggerType;
  metadata: Record<string, unknown>;
  timestamp: number;
  createdAt: string;
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  totalErrors: number;
  topError: string;
  topErrorCount: number;
  shameScore: number;
}

export interface ActionResponse {
  action: ActionType;
  content: string;
  mediaUrl?: string;
  duration?: number;
}
