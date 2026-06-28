# Anti-Copilot: Architecture & Project Status

This document provides a comprehensive overview of the Anti-Copilot system architecture, current implementation status, data flow, and fallback mechanisms. It is designed to get any developer (or AI) immediately up to speed on the project.

---

## 1. Project Overview & Status

**Anti-Copilot** is a cynical, highly-integrated AI coding assistant that voluntarily "roasts" the developer for their coding habits instead of helping them. It consists of three primary components that work seamlessly together in a local development loop:

1. **VS Code Sensor (`/vscode-sensor`)**: A native VS Code extension that silently monitors the developer's actions (typing speed, pauses, terminal errors).
2. **Desktop Overlay (`/desktop-overlay`)**: An Electron-based desktop app that acts as the master launcher and displays a borderless, transparent UI anchored to the user's mouse cursor. It also synthesizes the AI's voice.
3. **Vercel Brain (`/vercel-brain`)**: A local Next.js server that processes telemetry, stores historical data in AWS DynamoDB, and prompts AWS Bedrock (Claude 3 Haiku) to generate context-aware jokes.

**Current Progress:** The core loop is completely functional. The Electron launcher correctly orchestrates the Next.js server and checks/installs the VS Code extension. The VS Code extension captures events with debouncing, sends them to the local Next.js brain, receives an AI response, and forwards it via WebSocket to the Electron overlay. The overlay successfully renders the UI near the cursor and speaks using the Web Speech API.

---

## 2. Component Connectivity & File Structure

### A. The VS Code Extension (`/vscode-sensor`)
- **`src/extension.ts`**: The entry point. It initializes the `SensorManager` and `WebSocketClient`.
- **`src/sensors/SensorManager.ts`**: The core logic for detecting user state. It monitors file changes, active editors, and terminal output. It handles debouncing (15s global cooldown) and sends HTTP POST requests to the Vercel Brain.
- **`src/transport/WebSocketClient.ts`**: Maintains a persistent connection to the Desktop Overlay (`ws://127.0.0.1:9009`) to forward the AI's responses for visual rendering.
- **Note:** The extension is compiled using `esbuild` to ensure the `ws` dependency is bundled natively into the `.vsix`.

### B. The Desktop Overlay (`/desktop-overlay`)
- **`src/main/main.ts`**: The Electron master orchestrator. 
  - Loads `.env` from the project root.
  - Spawns the Vercel Brain (`npx next dev -H 127.0.0.1`).
  - Checks if the VS Code extension is installed (and installs it if missing).
  - Starts a WebSocket server on port 9009.
  - Creates the frameless, transparent overlay window that tracks the mouse cursor via a 60fps polling loop.
- **`src/main/preload.ts`**: Exposes the IPC bridge (`window.antiCopilot`) to the React frontend.
- **`src/renderer/App.tsx`**: The React UI. Listens for triggers from the main process and updates the visual state (e.g., Idle Skull, Chat Bubble, Video Overlay).
- **`src/renderer/audioController.ts`**: Handles the Chromium Web Speech API. Includes specific workarounds for Chromium bugs (e.g., avoiding aggressive `cancel()` calls to prevent dropped audio).
- **`src/renderer/styles/global.css`**: Aligns the transparent canvas to `flex-start` so the UI anchors perfectly to the top-left of the cursor's hit-box.

### C. The Vercel Brain (`/vercel-brain`)
- **`src/app/api/action/route.ts`**: The primary intelligence endpoint (`POST /api/action`).
  - Receives telemetry.
  - Logs the event to AWS DynamoDB to track historical error counts.
  - Constructs a prompt for AWS Bedrock (`anthropic.claude-3-haiku-20240307-v1:0`).
  - Returns the AI-generated JSON response (`action`, `content`).

---

## 3. Data Flow & Communication

The data loop completes in under a second and follows this exact path:

1. **Detection**: `SensorManager.ts` detects a trigger (e.g., 10 seconds of inactivity).
2. **HTTP POST**: The sensor sends an HTTP POST request to `http://127.0.0.1:3000/api/action` with the payload (User ID, trigger type, timestamp). (A 15-second `AbortController` timeout protects this call).
3. **AI Generation**: Next.js (`route.ts`) contacts AWS Bedrock.
4. **HTTP Response**: Next.js returns the AI's judgment to the VS Code sensor.
5. **WebSocket Forwarding**: `SensorManager.ts` receives the HTTP response, updates the VS Code Status Bar, and immediately forwards the JSON payload via WebSocket to `ws://127.0.0.1:9009`.
6. **IPC Relay**: The Electron WebSocket server (`main.ts`) receives the payload and relays it to the React frontend via IPC (`webContents.send('trigger')`).
7. **Rendering**: `App.tsx` updates the visual state, and `audioController.ts` speaks the text out loud.

---

## 4. State Analysis & Debouncing

State changes in `SensorManager.ts` are tightly controlled to prevent notification spam and ensure a fluid, natural rhythm:

- **Global Cooldown**: A strict `15000ms` (15-second) global cooldown ensures that once a trigger fires, NO other triggers can fire until the timer expires.
- **Pause Detection**: A timer resets on every keystroke. If no keys are pressed for `10000ms` (10 seconds), the `Pause` trigger fires.
- **WPM Tracking**: Keystrokes are tracked in a 60-second sliding window to calculate live Words-Per-Minute.
- **Triple Error**: If the exact same terminal error is detected 3 times in a row, a `TripleError` trigger is fired (which commands the IDE to switch to Light Mode as punishment).
- **Dirty Commit**: Attempting to type `git commit` in the terminal while the editor contains active Diagnostics errors triggers a visual block.

---

## 5. Mock Data & API Fallback

To ensure the application never crashes during network outages, AWS credential failures, or rate-limiting, a robust fallback system is implemented.

### API Fallback Logic
Located in **`vercel-brain/src/app/api/action/route.ts`**:
If the AWS Bedrock call fails (caught by the `try/catch` block), the API gracefully degrades by calling `generatePlaceholderAction(trigger)`.

### Mock Data Location
The mock data itself is a hardcoded dictionary at the bottom of `route.ts`. It maps trigger types to static jokes:
```javascript
function generatePlaceholderAction(trigger: string) {
  const actions = {
    blank_space: { action: 'mock', content: 'Staring at an empty file won\'t make the code write itself...' },
    pause: { action: 'demotivate', content: 'Taking a break from writing bugs? Smart move.' },
    triple_error: { action: 'force_light_mode', content: 'Same error THREE times? Enjoy light mode as punishment.' },
    dirty_commit: { action: 'block_window', content: 'You\'re trying to commit with errors? I\'m not letting you embarrass yourself... publicly.' },
    // ...
  };
  return actions[trigger] || { action: 'mock', content: 'I\'m watching you. Always.' };
}
```

### Startup Mock Trigger
To verify that the IPC and Audio bridge are working correctly on boot, `main.ts` artificially injects a `mock` trigger directly into the overlay 2 seconds after the Electron window loads: `"Anti-Copilot is online and watching you code."`
