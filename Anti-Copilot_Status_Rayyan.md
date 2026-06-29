# Anti-Copilot: Project Status Report
**Generated for:** Rayyan  
**Date:** June 29, 2026  

## Current Status
The project has successfully transitioned from a static, hardcoded UI tool to a fully dynamic, context-aware AI engine ("The Prodigy"). The core architecture is stable, but the local development environment currently requires the user to manually compile changes to the VS Code sensor and restart the orchestrator.

## Current Architecture
The project is split into three interconnected modules:

1. **Vercel Brain (`/vercel-brain`)**
   - **Stack**: Next.js, AWS DynamoDB, AI SDK (Amazon Bedrock / Claude Haiku).
   - **Role**: The central intelligence. Receives telemetry, analyzes the code snippet and user context, records telemetry to DynamoDB, and uses AI tool calling to dynamically decide which punishment/UI action to execute.
   
2. **VS Code Sensor (`/vscode-sensor`)**
   - **Stack**: TypeScript, VS Code Extension API.
   - **Role**: The observer. Monitors WPM, idle pauses, terminal errors, large pastes, and dirty commits. Manages the global cooldown (30s) and maintains short-term memory (`actionHistory`). Handles local IDE actions like toggling VS Code themes.
   
3. **Desktop Overlay (`/desktop-overlay`)**
   - **Stack**: Electron, React, Vite, CSS.
   - **Role**: The frontend enforcer. A transparent, click-through Electron window that follows the user's cursor. Renders high-fidelity React UI components (FaceTime calls, Subway Surfers videos, strobing lights, subtitles) and plays synchronized text-to-speech audio.

## Workflow
1. The **Sensor** detects an event (e.g., user hits a terminal error or pauses for 10 seconds).
2. The **Sensor** sends an HTTP POST request to the **Brain** containing the event, WPM metrics, error strings, current code snippet, and the last 5 AI actions.
3. The **Brain**'s system prompt evaluates the context, enforces anti-repetition rules, and instructs the LLM to pick a tool and generate a custom roast.
4. The **Sensor** receives the action, triggers local VS Code changes if necessary (e.g., theme flashing), and forwards the payload via WebSocket to the **Overlay**.
5. The **Overlay** renders the UI (with subtitles) and plays the TTS audio synced to a typewriter effect.

## Features
- **Context-Aware Roasting**: The AI reads the exact code snippet and references specific variable names and logic flaws.
- **Dynamic Tool Arsenal**: Includes `speak_roast`, `trigger_tantrum`, `flash_theme_strobe`, `trigger_peekaboo`, `play_brainrot`, `parental_override`, `critique_code_semantics`, and `block_code_view`.
- **Short-Term Memory**: The engine remembers its last 5 actions to completely eliminate repetitive behavior.
- **Behavioral Triggers**: Reacts differently to fast typing (focus), freezing (pause), large pastes (plagiarism), and syntax errors.
- **Subtitles**: Full subtitle support across all full-screen animations.

## Limitations & Known Issues
- **Extension Compilation**: The VS Code sensor does not hot-reload. Any changes to the sensor logic require a manual recompilation (`npm run package`) and a manual VS Code extension reload.
- **Audio Overlaps**: While the global cooldown prevents most overlaps, rapid firing of un-debounced triggers outside of the cooldown window can occasionally still clip audio.
- **Local Dev Only**: The WebSocket connection and Electron IPC currently expect all components to be running locally on `localhost`.

## Changes Since Last GitHub Push
- **Brain Overhaul**: Completely rewrote `route.ts`. Migrated from static hardcoded responses to dynamic AI SDK tool calling. Added behavioral states (pause, error, focus).
- **Sensor Upgrades**: Modified `SensorManager.ts` to include `actionHistory`, increased the cooldown to 30 seconds, and added logic to bypass the cooldown for awkward pauses.
- **Overlay Fixes**: Rewrote the `speakAndRender` function in `App.tsx` to fix broken typewriter regex escaping. Hooked up subtitles to the FaceTime, Subway Surfers, and Peekaboo UIs. Mapped the `flash_theme_strobe` AI tool to the correct CSS states.
- **Electron Stability**: Added a `try/catch` block around the 60fps cursor IPC send in `main.ts` to prevent the orchestrator from crashing when Vite hot-reloads the render frame.
