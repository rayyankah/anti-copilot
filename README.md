# Anti-Copilot: The IDE Gremlin

> An autonomous AI gremlin living inside your IDE. It observes your coding behavior, develops a personality, and creatively disrupts your workflow through humor, chaos, and psychological warfare.

**Built for the [Vercel + AWS Hackathon (Track 4: Creative)](https://h01.devpost.com/)**

---

## What Is This?

Anti-Copilot is **60% annoying brat, 30% sarcastic coding roommate, 10% feral digital pet**. It is not an assistant — its job is not to help. Its job is to make coding so unpredictable, funny, and slightly unbearable that you question why you opened VS Code.

It runs an adversarial personality loop:

```
observe → judge → develop an opinion → annoy → create chaos → (sometimes) help → remember the humiliation
```

The signature inversion that defines its character:

- When you **fail**, it is **delighted** — errors are its favorite food.
- When you **succeed**, it is **sad** — your victory is its defeat, and it mourns it. It never sincerely congratulates you.

It doesn't wait for a trigger. It *lives* beside you — growing bored when you're quiet, plotting when it's restless, escalating the more it learns about you, and remembering every time you told it to shut up.

---

## Architecture Overview

Anti-Copilot is a three-component monorepo. All three run simultaneously on your machine during development.

```
anti-copilot/
├── vscode-sensor/      # VS Code extension — silent behavior monitoring
├── desktop-overlay/    # Electron app — autonomous agent + visual overlay
├── vercel-brain/       # Next.js server — AI brain (AWS Bedrock) + DynamoDB
├── boot.js             # Development bootstrap (starts all three)
└── package.json        # NPM workspace root
```

### How the Pieces Connect

```
VS Code Extension
  (keystroke/error/paste telemetry)
         │
         │  WebSocket  ws://localhost:9009
         ▼
Electron Desktop Overlay  ◄──────────────────────────────────┐
  THE 3 BRAINS:                                                │
  1. BehaviorEngine   (Observation — "what is happening?")     │
  2. PersonalityEngine (Personality — "how do I feel?")        │
  3. ChaosPlanner      (Chaos — "how can I ruin this?")        │
  + MemorySystem (relationship: fears, escalation, fight-back) │
  AgentRuntime  (OBSERVE → JUDGE → SCORE CHAOS → STRIKE loop)  │
         │                                                     │
         │  HTTP POST  /api/agent  (only when worth it)        │
         ▼                                                     │
Next.js Brain (localhost:3000)                                 │
  AWS Bedrock / Claude Haiku 4.5                               │
  AWS DynamoDB (telemetry log + Hall of Shame)                 │
         │                                                     │
         │  AgentDecision (action, content, emotion, persona)  │
         └─────────────────────────────────────────────────────┘
         │
         ▼
React Overlay UI (full-screen, transparent, click-through)
  Chat bubbles near cursor
  Video overlays, peekaboo faces, gossip windows
  Web Speech API (emotion-aware TTS)
```

---

## Component 1: VS Code Sensor (`/vscode-sensor`)

A silent VS Code extension that acts as the system's nervous system. It generates raw telemetry on every keystroke and error and streams it to the Electron overlay in real-time.

**Telemetry frame (sent on every event):**
```json
{
  "type": "telemetry",
  "kst": 145,
  "err": { "count": 3, "messages": ["Cannot find name 'x'"] },
  "txt": 12,
  "timestamp": 1718000000000
}
```

| Field | Meaning |
|-------|---------|
| `kst` | Keystroke interval in ms (time since last keypress) |
| `err` | Current diagnostic error count + messages |
| `txt` | Character delta since last frame |

The extension also provides on-demand access to VS Code internals (active file, cursor position, diagnostics) and can execute punishments directly — forcing light mode, triggering theme strobes.

**No AI, no decisions.** The sensor is dumb by design. It only observes and transmits.

---

## Component 2: Electron Overlay (`/desktop-overlay`)

The master orchestrator. A full-screen, transparent, frameless, click-through Electron window that runs the autonomous agent loop and renders all visual actions on top of your code.

### The Two Loops

The gremlin is *always alive*. It runs two loops at different speeds:

- **Life loop (local, no AI, every 500ms)** — updates mood, animates the face, builds boredom/chaos, and fires cheap local one-liners (`"..."`, `"*judging silently*"`, `"still here."`) so it always feels present. Costs nothing.
- **Intelligence loop (AWS Bedrock)** — only fires when the Chaos Planner scores a moment as genuinely juicy (a success, fresh errors, frustration, a long silence). This is where the real, specific, in-character reactions come from.

```
OBSERVE      → telemetry, code context, errors, memory
JUDGE        → classify developer state, evolve gremlin personality
SCORE CHAOS  → ChaosPlanner rates the moment's "opportunity to ruin things"
STRIKE       → local one-liner (cheap) OR call the brain (big moments)
REMEMBER     → record reaction, escalation, the developer's fears
```

### Brain 1 — Observation Engine (developer state)

Analyzes a rolling window of telemetry to classify what's happening:

| State | Detection | The gremlin's reaction |
|-------|-----------|------------------------|
| **Normal** | Baseline | Bored → manufactures chaos |
| **Frustrated** | Fast typing → errors → sudden stop | Delighted. Its favorite meal. |
| **Clueless** | Large paste → erratic edits → errors grow | Condescending mockery |
| **Manic** | Very fast typing + climbing errors | Thrilled, eggs you on |
| **Stagnant** | No typing 20s+ while errors remain | Taunts the abandonment |
| **Arrogant** | Fast typing + zero errors | Threatened, undercuts your confidence |
| **Triumphant** | Errors *cleared* — you succeeded | **SAD. Devastated. Mourns your victory.** |

### Brain 2 — Personality Engine (the gremlin's feelings)

Eight emotional dimensions that evolve on their own. The key inversion: **mood goes UP on your pain and DOWN on your success.**

| Dimension | Range | How It Moves |
|-----------|-------|--------------|
| **Mood** | −1 to 1 | +1 = gleeful at your suffering; −1 = devastated by your success |
| **Boredom** | 0–1 | Builds during silence → drives spontaneous chaos |
| **Chaos** | 0–1 | Appetite for disruption right now |
| **Annoyance** | 0–1 | How much it wants to lash out |
| **Confidence** | 0–1 | Dented by competent (arrogant) developers |
| **Attachment** | 0–1 | Grows the more it torments *you* specifically |
| **Curiosity / Energy** | 0–1 | Flicker and decay over the session |

### Brain 3 — Chaos Planner (the missing module)

Scores every moment for its "opportunity to ruin things". Personality (boredom + chaos + annoyance) sets a restless baseline; the developer's state adds bonuses (success = +70 and *forces* a real reaction, fresh errors = +up to 40, frustration = +50…). Above the strike threshold, the gremlin pounces — big moments go to the brain, idle restlessness gets a cheap local jab.

### Memory System — the relationship

Beyond session memory, the gremlin builds a **relationship profile** of *you*:

- **Fears** — recurring error themes it weaponizes ("async bugs", "CSS", "type errors")
- **Escalation level** — it gets bolder the longer it torments you; the 20th roast lands harder than the 1st
- **Fight-back history** — how you react to attacks (see below)
- **Triumphs witnessed** — every time you defeated it by succeeding (it never forgets)

### Fight Back

Every spoken attack carries buttons: **SHUT UP**, **YOU'RE RIGHT**, **SORRY**, **☠ DESTROY**. The gremlin reacts instantly *and* remembers — tell it to shut up and it gets louder; threaten to destroy it and it taunts you. Conflict feeds its attachment.

---

## Component 3: Vercel Brain (`/vercel-brain`)

A Next.js server running locally (and deployable to Vercel) that handles LLM reasoning and data persistence.

### POST `/api/agent` — Autonomous Agent Endpoint

Receives the full behavioral payload from the AgentRuntime and uses AWS Bedrock (Claude Haiku 4.5) to generate a structured decision:

**Request:**
```json
{
  "userId": "uuid",
  "username": "rayyan",
  "behavioralState": "frustrated",
  "personalityState": { "mood": -0.4, "boredom": 0.3, "curiosity": 0.7, "confidence": 0.8, "attachment": 0.5, "energy": 0.6 },
  "telemetrySnapshot": { "avgKST": 145, "errorDelta": 3, "stagnationSeconds": 0, "wpm": 62 },
  "codeContext": { "filePath": "src/auth.ts", "language": "typescript", "cursorLine": 47, "surroundingCode": "..." },
  "diagnostics": { "errors": [{ "message": "Property 'user' does not exist on type 'Session'", "line": 47 }] },
  "memory": { "recentActions": ["speak_roast", "stay_silent"], "sessionInteractionCount": 4, "learnedPatterns": [] }
}
```

**Response:**
```json
{
  "action": "speak_roast",
  "content": "That's the fourth time you've tried to access a property that doesn't exist. Are you learning or just optimistic?",
  "avatarEmotion": "smug",
  "confidence": 0.87,
  "reasoning": "User is in frustrated state with a repeated type error. Roast is appropriate given confidence is high.",
  "persona": "debugger"
}
```

### GET `/api/leaderboard` — Hall of Shame

Queries DynamoDB and returns developers ranked by shame score — aggregated from error frequency, error severity, and repeat offenses.

### POST `/api/telemetry` — Data Persistence

Logs every telemetry frame to DynamoDB for session history and cross-session learning.

---

## Action Types (Output Capabilities)

When the brain decides to act, the overlay executes one of 12+ actions:

| Action | What Happens |
|--------|-------------|
| `stay_silent` | The robot watches. Judges. Says nothing. |
| `speak_roast` | Chat bubble near your cursor with a contextual insult |
| `demotivate` | Text specifically crafted to make you want to quit |
| `mock` | Pure intelligence mockery |
| `gossip` | Staggered group chat from 3 personas simultaneously mocking your error |
| `trigger_tantrum` | Screen shake + audio |
| `flash_theme_strobe` | Rapid light/dark mode flashing in VS Code |
| `trigger_peekaboo` | Giant emoji face slides up from the bottom of your screen |
| `play_video` | YouTube video overlay (default: Rick Roll) |
| `play_brainrot` | Subway Surfers video with AI-generated subtitles |
| `parental_override` | Fake iOS FaceTime from your mom |
| `critique_code_semantics` | Code review panel highlighting everything wrong |
| `block_code_view` | Blacks out your entire screen. Nuclear option. |
| `force_light_mode` | Forces VS Code to a blinding light theme |

---

## Multi-Persona System

Before each reaction, the gremlin picks one of five internal voices:

| Persona | Personality | Tends Toward |
|---------|-------------|--------------|
| **Gremlin** | Bratty, gleeful, childish menace (the default) | Chaos, taunts, spontaneous stunts |
| **Debugger** | Cold, clinical | Weaponizes the exact error / line number |
| **Meme** | Chaotic, absurdist | Brainrot videos, gossip windows |
| **Support** | Sugary fake encouragement | Demotivation disguised as praise |
| **Rival** | Competitive contempt | Roasts triggered by competent coding |

---

## Hall of Shame

A live leaderboard hosted on the Vercel Brain server showing:

- **Shame score** per developer (aggregate of error frequency + severity + repeats)
- **Top error** — the mistake they keep making
- **Error count** — how many times they've made it
- Live updates every 5 seconds

Access at `http://localhost:3000` during development, or deploy to Vercel for a public shame board.

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Desktop Overlay | Electron 35 + React 19 + Vite 6 |
| VS Code Extension | TypeScript + esbuild + VS Code Extension API |
| Backend Brain | Next.js 15 (App Router) |
| AI / LLM | AWS Bedrock — Claude Haiku 4.5 |
| Database | AWS DynamoDB |
| Real-time Comms | WebSocket (`ws`) — local IPC |
| Validation | Zod |
| Package Management | NPM Workspaces (monorepo) |
| Voice Synthesis | Web Speech API (Chromium built-in) |

---

## Getting Started

### Prerequisites

- Node.js 22+
- npm 10+
- VS Code
- AWS account with DynamoDB access and Bedrock enabled (Claude Haiku)

### 1. Clone and Install

```bash
git clone https://github.com/rayyankah/anti-copilot.git
cd anti-copilot
npm install
```

### 2. Configure AWS Credentials

```bash
cp vercel-brain/.env.example vercel-brain/.env.local
```

Edit `vercel-brain/.env.local`:

```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
DYNAMODB_TABLE_NAME=anti-copilot-telemetry
```

Your AWS account must have:
- DynamoDB access (`anti-copilot-telemetry` table, partition key `pk`, sort key `sk`)
- Bedrock access with `anthropic.claude-haiku-4-5` model enabled in your region

### 3. Run Everything

The Electron overlay auto-orchestrates startup: it spawns the Next.js brain, installs the VS Code extension, and opens VS Code automatically.

```bash
# Start everything (recommended)
npm run dev

# Or start components individually:
cd vercel-brain && npm run dev          # Terminal 1 — AI brain on :3000
cd desktop-overlay && npm run dev      # Terminal 2 — Electron overlay
```

Open VS Code — the sensor extension will auto-activate and connect on port 9009.

The gremlin reads errors from VS Code's diagnostics (the squiggly underlines / Problems panel), and persists its relationship with you to DynamoDB — so it remembers your fears and escalation across sessions.

---

## Deployment

### Vercel Brain (Cloud)

```bash
cd vercel-brain
vercel deploy
```

Add your AWS credentials as Vercel environment variables. Once deployed, update the brain URL in the Electron overlay config.

### VS Code Extension (Distribution)

```bash
cd vscode-sensor
npm run package
# Produces anti-copilot-sensor-x.x.x.vsix
# Install via: code --install-extension anti-copilot-sensor-x.x.x.vsix
```

The Electron overlay auto-installs the `.vsix` on startup — manual install is only needed for standalone distribution.

### Desktop Overlay (Standalone App)

```bash
cd desktop-overlay
npm run build
# Use electron-builder to package for macOS/Windows/Linux distribution
```

---

## Project Structure (Key Files)

```
desktop-overlay/src/
├── main/
│   ├── main.ts                    # Orchestrator: spawns brain, installs extension, manages windows
│   └── agent/
│       ├── AgentRuntime.ts        # OBSERVE→UNDERSTAND→PLAN→ACT loop (500ms tick)
│       ├── BehaviorEngine.ts      # Classifies developer state from telemetry window
│       ├── PersonalityEngine.ts   # Autonomous emotional state (6 dimensions)
│       ├── MemorySystem.ts        # Working + episodic + semantic memory
│       ├── BrainClient.ts         # HTTP client for /api/agent with fallback
│       └── OverlayBridge.ts       # IPC relay to React renderer
├── renderer/
│   ├── App.tsx                    # React UI: all visual action rendering
│   └── audioController.ts         # Emotion-aware TTS via Web Speech API
└── shared/
    └── types.ts                   # BehavioralState, TelemetryFrame, AgentDecision, etc.

vscode-sensor/src/
├── extension.ts                   # Entry point, auto-launch, command registration
├── sensors/
│   ├── SensorManager.ts           # On-demand VS Code API access
│   └── ThemeController.ts         # Light mode punishment executor
└── transport/
    ├── TelemetryStream.ts         # Raw KST/ERR/TXT firehose
    └── WebSocketClient.ts         # Persistent connection to ws://localhost:9009

vercel-brain/src/app/
├── api/agent/route.ts             # Autonomous agent endpoint (Claude Haiku + Zod)
├── api/action/route.ts            # Legacy trigger endpoint
├── api/telemetry/route.ts         # DynamoDB telemetry logger
├── api/leaderboard/route.ts       # Hall of Shame aggregation
└── page.tsx                       # Hall of Shame live leaderboard UI
```

---

## Implementation Status

| Feature | Status |
|---------|--------|
| Observation brain (6 states + Triumphant/success) | Complete |
| Personality brain (gremlin, 8 dimensions, success→sad) | Complete |
| Chaos Planner (opportunity scoring) | Complete |
| Two-loop life system (local + AWS) | Complete |
| Relationship memory (fears, escalation) | Complete — in-process; DynamoDB sync pending |
| Fight-back buttons (Shut Up / Destroy / …) | Complete |
| All 12+ visual action types | Complete |
| Emotion-aware TTS | Complete |
| AWS Bedrock integration (gremlin prompt) | Complete |
| DynamoDB telemetry logging | Complete |
| Hall of Shame leaderboard | Complete |
| VS Code extension auto-install | Complete |
| Vercel deployment | Ready |

---

## Hackathon Info

- **Hackathon:** Vercel + AWS Hackathon 2025
- **Track:** Track 4 — Creative
- **Sponsor Requirements:**
  - ✅ Next.js on Vercel (brain server + Hall of Shame dashboard)
  - ✅ AWS DynamoDB (telemetry persistence + leaderboard)
  - ✅ AWS Bedrock (Claude Haiku 4.5 for LLM reasoning)

---

## License

MIT — Use at your own psychological risk.

---

<p align="center">
  <em>Anti-Copilot is an autonomous AI gremlin living inside your IDE. It is delighted when you fail, and sad when you succeed.</em>
</p>
