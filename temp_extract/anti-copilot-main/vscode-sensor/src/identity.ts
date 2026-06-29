import * as vscode from 'vscode';
import * as crypto from 'crypto';

const IDENTITY_KEY = 'antiCopilot.identity';

export interface DeveloperIdentity {
  uuid: string;
  username: string;
}

const INSULTING_PREFIXES = ['Spaghetti', 'CtrlC', 'CopyPaste', 'Buggy', 'Clueless', 'StackOverflow', 'Laggy', 'Lazy', 'Noob'];
const INSULTING_NOUNS = ['Coder', 'Victim', 'Hacker', 'Dev', 'Typist', 'ScriptKiddie', 'Engineer', 'Architect'];

function generateInsultingUsername(): string {
  const prefix = INSULTING_PREFIXES[Math.floor(Math.random() * INSULTING_PREFIXES.length)];
  const noun = INSULTING_NOUNS[Math.floor(Math.random() * INSULTING_NOUNS.length)];
  const num = Math.floor(Math.random() * 999);
  return `${prefix}${noun}_${num}`;
}

export function getOrCreateIdentity(context: vscode.ExtensionContext): DeveloperIdentity {
  let identity = context.globalState.get<DeveloperIdentity>(IDENTITY_KEY);

  if (!identity) {
    identity = {
      uuid: crypto.randomUUID(),
      username: generateInsultingUsername(),
    };
    context.globalState.update(IDENTITY_KEY, identity);
  }

  return identity;
}
