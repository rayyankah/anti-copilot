# 🏴‍☠️ Anti-Copilot: The Worst Decision Of Your Life

> A psychological warfare engine disguised as a developer tool. Instead of helping you code, it stalks your cursor, tracks your mistakes, and actively demotivates you.

**Built for the [Vercel + AWS Hackathon (Track 4: Creative)](https://h01.devpost.com/)**

---

## 🧠 What Is This?

Anti-Copilot is an AI-powered anti-productivity suite that monitors your coding habits in real-time and responds with perfectly timed insults, memes, and psychological warfare. It's the developer tool nobody asked for — and the one you secretly deserve.

---

## 🎯 The 7 Triggers (Input States)

The system reacts to these distinct local states detected from VS Code:

| # | Trigger | Description |
|---|---------|-------------|
| 1 | **Blank Space** | User opens a new file or deletes everything and stares at the void |
| 2 | **Code** | User is actively typing (WPM tracked to mock fast-but-bad typing) |
| 3 | **Terminal Error** | Compiler, linter, or terminal throws an error |
| 4 | **Pause** | User stops typing while the file has code |
| 5 | **Large Paste** | Detects pasting >50 characters (the "Copy-Paste Interrogator") |
| 6 | **Triple Error** | Same terminal error hit 3 times in a row |
| 7 | **Dirty Commit** | Attempting `git commit` with active red squiggly lines |

---

## 💀 The 8 Persona Actions (Output Capabilities)

When a trigger fires, the AI engine commands the Electron overlay to execute one of:

| # | Action | Description |
|---|--------|-------------|
| 1 | **Mock** | Short text insulting their intelligence |
| 2 | **Demotivate** | Text explicitly telling them to give up |
| 3 | **Gossip** | Spawns multiple windows simulating a group chat mocking their error |
| 4 | **Play Video** | Embeds and autoplays a demotivating YouTube video |
| 5 | **Send Meme** | Shows an image meme with TTS voice synthesis + subtitles |
| 6 | **Create Window** | Sleek window floating 50px from their cursor (default state) |
| 7 | **Block Window** | Expands UI to intentionally obscure their code canvas |
| 8 | **Force Light Mode** | Changes VS Code theme to a blinding Light Theme ☀️ |

---

## 🏗️ Architecture (Monorepo)

```
anti-copilot/
├── desktop-overlay/    # Electron.js — Transparent, frameless overlay UI
├── vscode-sensor/      # VS Code Extension — Silent trigger monitoring
├── vercel-brain/       # Next.js + AWS DynamoDB — AI brain & Hall of Shame
├── .gitignore
├── package.json        # Root workspace configuration
└── README.md
```

### 1. `/desktop-overlay` — Electron.js Overlay
A transparent, frameless, click-through window that acts as the visual UI layer. It:
- Tracks the global OS cursor position
- Renders insults, memes, videos, and gossip windows
- Receives commands from the Vercel brain via WebSocket
- Can expand to block the entire screen (Dirty Commit punishment)

### 2. `/vscode-sensor` — VS Code Extension
A silent monitoring extension that detects the 7 triggers:
- Monitors text document changes, diagnostics, and terminal output
- Calculates WPM for typing-speed mockery
- Detects paste events, pause durations, and repeated errors
- Pushes trigger events via local WebSocket to the overlay
- Has API access to force VS Code theme changes (Light Mode punishment)

### 3. `/vercel-brain` — Next.js + AWS DynamoDB
The central intelligence server deployed on Vercel:
- **Receives telemetry** from the VS Code sensor
- **Logs error frequencies** into AWS DynamoDB
- **Uses an LLM** to generate contextual demotivating responses
- **Hosts the "Global Hall of Shame"** — a live leaderboard ranking developers by their most embarrassing, frequently repeated errors
- Built with Next.js (scaffolded via Vercel v0)

---

## 🏆 Global Hall of Shame

A public web dashboard (hosted on Vercel) that pulls from AWS DynamoDB to display:
- **Live leaderboard** of the worst developers
- **Error frequency charts** showing most repeated mistakes
- **Shame scores** calculated from trigger frequency and severity
- **Hall of Fame** for the most consistently terrible coders

---

## ⚙️ Tech Stack

| Component | Technology |
|-----------|-----------|
| Desktop Overlay | Electron.js + React |
| VS Code Sensor | TypeScript VS Code Extension |
| Backend/Brain | Next.js (App Router) on Vercel |
| Database | AWS DynamoDB |
| AI/LLM | AWS Bedrock / OpenAI |
| Frontend UI | Vercel v0 (scaffolded components) |
| Communication | WebSocket (local) + REST API (cloud) |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- npm 10+
- VS Code
- AWS account with DynamoDB access
- Vercel account

### Installation

```bash
# Clone the repository
git clone https://github.com/rayyankah/anti-copilot.git
cd anti-copilot

# Install all dependencies
npm install

# Set up environment variables
cp vercel-brain/.env.example vercel-brain/.env.local
# Edit vercel-brain/.env.local with your AWS credentials
```

### Development

```bash
# Start the Next.js brain server
cd vercel-brain && npm run dev

# Start the Electron overlay (in a new terminal)
cd desktop-overlay && npm run dev

# Build the VS Code extension
cd vscode-sensor && npm run compile
```

---

## 📦 Deployment

### Vercel Brain
```bash
cd vercel-brain
vercel deploy
```

### VS Code Extension
```bash
cd vscode-sensor
npm run package
# Install the .vsix file in VS Code
```

### Desktop Overlay
```bash
cd desktop-overlay
npm run build
# Package with electron-builder for distribution
```

---

## 🏁 Hackathon Info

- **Hackathon**: Vercel + AWS Hackathon 2025
- **Track**: Track 4 — Creative
- **Sponsor Requirements**: 
  - ✅ Vercel v0 for production-ready Next.js frontend
  - ✅ AWS DynamoDB for data persistence
- **Credits**: $100 AWS promotional + $30 Vercel v0

---

## 📄 License

MIT — Use at your own risk. We're not responsible for any psychological damage.

---

<p align="center">
  <strong>Anti-Copilot: Because you weren't suffering enough already.</strong>
</p>
