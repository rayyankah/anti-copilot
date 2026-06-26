export enum TriggerType {
  BlankSpace = 'blank_space',
  Code = 'code',
  TerminalError = 'terminal_error',
  Pause = 'pause',
  LargePaste = 'large_paste',
  TripleError = 'triple_error',
  DirtyCommit = 'dirty_commit',
}

export interface TriggerPayload {
  trigger: TriggerType;
  timestamp: number;
  metadata: Record<string, unknown>;
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
