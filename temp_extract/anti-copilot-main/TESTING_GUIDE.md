# TESTING_GUIDE.md — Anti-Copilot End-to-End QA Manual

> **Audience**: Absolute beginners. Every keystroke, every terminal command, every expected result is documented.
>
> **Goal**: Physically verify that every trigger, action, audio response, visual overlay, and database write is functional in real-time.

---

## Phase 1: Booting the Engine

You need **three separate terminal windows** and **one VS Code window**. Do not skip any step.

### Prerequisites

- **Node.js v18+** installed
- **VS Code** installed
- Your OS speakers/headphones must be unmuted (for TTS audio tests)
- All dependencies installed. If you haven't done this, run from the project root:

```bash
cd "c:\Users\Afnan khalil\OneDrive\Desktop\Anti-Copilot"
npm install
```

---

### Step 1.1: Start the Vercel Brain (Next.js API + Hall of Shame)

Open **Terminal 1** (PowerShell or CMD).

```bash
cd "c:\Users\Afnan khalil\OneDrive\Desktop\Anti-Copilot"
npm run dev:brain
```

**Wait for this output:**
```
✓ Ready in Xs
- Local: http://localhost:3000
```

**Verification:**
1. Open your web browser and navigate to `http://localhost:3000`.
2. You should see the **"🏆 Global Hall of Shame"** page with either leaderboard entries or the text "No victims yet."
3. If you see a red error page, check that your `.env.local` file exists in the `vercel-brain/` directory with valid AWS credentials.

> ⚠️ **DO NOT close this terminal.** The server must stay running for the entire testing session.

---

### Step 1.2: Start the Desktop Overlay (Electron App)

Open **Terminal 2** (PowerShell or CMD).

```bash
cd "c:\Users\Afnan khalil\OneDrive\Desktop\Anti-Copilot"
npm run dev:overlay
```

**What to expect:**
1. Vite starts a dev server on `http://localhost:5173`.
2. After a few seconds, an **Electron window** appears **fixed in the bottom-right corner** of your screen. It is transparent and click-through.
3. A **DevTools window** will open automatically in dev mode — this lets you inspect console logs from the overlay renderer.
4. You should see a small **pulsing 💀 skull** in the bottom-right corner of your screen. This is the idle indicator confirming the overlay is alive.
5. After **3 seconds**, a **self-test notification card** will automatically slide up saying:
   ```
   💀 Anti-Copilot is online and watching you code.
   ```
   You should also **hear this message spoken aloud** via TTS.

**If the self-test card does NOT appear:**
- Check Terminal 2 for errors.
- Look at the DevTools Console tab for `[Anti-Copilot Renderer]` log messages.
- Common issue: port 5173 or 9009 is already in use. Kill any previous Electron/Vite processes first.

> ⚠️ **DO NOT close this terminal.** The Electron overlay must stay running.

---

### Step 1.3: Launch the VS Code Extension Development Host

1. Open a **fresh VS Code window** (not the one you're coding in).
2. Use **File → Open Folder** and navigate to:
   ```
   c:\Users\Afnan khalil\OneDrive\Desktop\Anti-Copilot\vscode-sensor
   ```
3. Open the folder. VS Code will load the extension project.
4. Press **`F5`** on your keyboard (or go to **Run → Start Debugging**).
5. VS Code will compile the TypeScript and then open a **new VS Code window** titled **"[Extension Development Host]"**.

**Verification in the Extension Development Host window:**
1. Press **`Ctrl+Shift+P`** to open the Command Palette.
2. Type **`Anti-Copilot: Activate Sensor`** and press Enter.
3. You should see a notification at the bottom right:
   ```
   💀 Anti-Copilot is now watching you, [YourInsultingName].
   ```
   Example: `💀 Anti-Copilot is now watching you, SpaghettiCoder_42.`

4. Note down the insulting username — you'll verify it in the database later.
5. In **Terminal 2**, you should see: `[Anti-Copilot] VS Code sensor connected`

> 📌 **From this point forward, ALL coding tests must be done inside the Extension Development Host window.** Not in your original VS Code window.

---

## Phase 2: AI Voice & Audio Layer Validation

Before running behavioral tests, confirm the audio pipeline is functional.

### Step 2.1: Verify the Self-Test

When the Electron overlay boots (Step 1.2), it automatically sends a self-test trigger after 3 seconds. This tests the entire renderer + TTS pipeline without needing the VS Code sensor.

**What to check:**
1. **Visual**: A notification card slides up from the bottom-right with the text "💀 Anti-Copilot is online and watching you code."
2. **Audio**: Your speakers/headphones read this message aloud in a robotic voice.
3. **DevTools Console**: In the auto-opened DevTools window, you should see:
   ```
   [Anti-Copilot Renderer] App mounted, registering trigger listener...
   [Anti-Copilot Renderer] Trigger listener registered successfully.
   [Anti-Copilot Renderer] Trigger received: {type: 'action', action: 'mock', content: '💀 Anti-Copilot is online and watching you code.'}
   [Anti-Copilot Renderer] TTS speaking: 💀 Anti-Copilot is online and watching you code.
   ```

If all three (visual + audio + console logs) are present, the overlay is fully operational.

### Step 2.2: Autoplay Policy Verification

The project bypasses browser audio autoplay restrictions via this setting in `desktop-overlay/src/main/main.ts`:

```typescript
autoplayPolicy: 'no-user-gesture-required'
```

This means:
- ✅ `SpeechSynthesisUtterance` (TTS voices) will auto-play without user click.
- ✅ YouTube iframes with `?autoplay=1` will auto-play without user click.

**No manual override is needed.** This is already configured.

### Step 2.3: TTS Coverage

TTS (text-to-speech) plays for **all action types except** these three visual-only actions:
- `block_window` (fullscreen ACCESS DENIED — visual impact only)
- `force_light_mode` (theme change — visual impact only)
- `play_video` (YouTube audio plays instead)

All other actions (`mock`, `demotivate`, `gossip`, `send_meme`) will speak the AI's roast aloud.

---

## Phase 3: Testing the 7 Triggers & 8 Actions

> 📌 **Important context**: The AI (Claude Haiku 4.5 via AWS Bedrock) dynamically picks which action to return based on the trigger. You cannot force it to return a specific action every time. The tests below describe the **most likely** action for each trigger. If the AI returns a different valid action, that's still a PASS — the key is that the full pipeline fires.
>
> The fallback system (when Bedrock is unavailable) DOES guarantee specific trigger→action mappings. To test with fallbacks, temporarily rename `.env.local` to `.env.local.bak` and restart the Vercel Brain.

---

### Test 1: Blank Space → Mock

**Purpose:** Verify that opening or switching to an empty file triggers the sensor.

**Steps:**
1. In the **Extension Development Host** window, press `Ctrl+N` to create a new untitled file.
2. **Do nothing.** Do not type. Just stare at the empty file.
3. Wait **2–5 seconds**.

**Expected Results:**

| Layer | Expected Behavior |
|-------|-------------------|
| **Terminal 1 (Vercel Brain)** | You see `POST /api/action 200` in the logs |
| **Terminal 2 (Electron)** | You see `[Anti-Copilot] Trigger received: { action: 'mock', content: '...' }` |
| **Electron Overlay** | A notification card slides up in the bottom-right corner with the AI's insult text |
| **Audio** | Your speakers/headphones read the insult aloud in a robotic voice |
| **Dashboard** | Refresh `http://localhost:3000` — your username's error count has incremented |

**Pass Criteria:** The overlay shows text AND you hear audio AND the Vercel Brain log shows `200`.

---

### Test 2: Code (WPM) → Demotivate / Mock

**Purpose:** Verify that typing triggers the debounced code sensor with WPM data.

**Steps:**
1. In the Extension Development Host, create a new file: `test.js`.
2. Type the following code **manually** (do not paste it):
   ```javascript
   function fibonacci(n) {
     if (n <= 1) return n;
     return fibonacci(n - 1) + fibonacci(n - 2);
   }
   console.log(fibonacci(10));
   ```
3. Type at a normal speed. The trigger fires **10 seconds after your first keystroke** (debounce timer).
4. Wait 10–15 seconds after you stop typing.

**Expected Results:**

| Layer | Expected Behavior |
|-------|-------------------|
| **Terminal 1** | `POST /api/action 200` — the request body contains `"trigger": "code"` and `"wpm": <number>` |
| **Electron Overlay** | A notification card slides up in the bottom-right |
| **Audio** | TTS reads the insult aloud |

**Pass Criteria:** The terminal shows the `code` trigger fired with a `wpm` value.

---

### Test 3: Terminal Error → Mock / Send Meme

**Purpose:** Verify that compiler/linter errors in the active file trigger the sensor.

**Steps:**
1. In the Extension Development Host, create a new file: `broken.ts`.
2. Type this **intentionally broken TypeScript** (or paste it — but note that pasting >50 chars will trigger the paste sensor instead):
   ```typescript
   const x: number = "hello";
   let y = undeclaredVariable;
   ```
3. Save the file (`Ctrl+S`). VS Code's TypeScript linter will show red squiggly underlines.
4. Wait 2–3 seconds for the diagnostics to fire.

**Expected Results:**

| Layer | Expected Behavior |
|-------|-------------------|
| **Terminal 1** | `POST /api/action 200` — trigger is `"terminal_error"` |
| **Electron Overlay** | A notification card with the AI roast, OR a meme image with caption |
| **Audio** | TTS reads the roast or meme caption aloud |
| **VS Code** | Red squiggly underlines remain on the broken code |

**Verifying Send Meme specifically:** The `send_meme` action shows a meme image (from imgflip.com) with the AI-generated caption text below it. If the AI chose `mock` instead, that's still valid — the key is the pipeline fires.

---

### Test 4: Pause → Demotivate

**Purpose:** Verify that 5 seconds of keyboard inactivity (while code is present) triggers the pause sensor.

**Steps:**
1. In the Extension Development Host, open `test.js` (from Test 2, which has code in it).
2. Type a single character (e.g., press the spacebar once).
3. **Stop typing completely.** Do not touch the keyboard.
4. Wait exactly **5 seconds.**

**Expected Results:**

| Layer | Expected Behavior |
|-------|-------------------|
| **Terminal 1** | `POST /api/action 200` — trigger is `"pause"` |
| **Electron Overlay** | A demotivation notification card slides up |
| **Audio** | TTS reads the demotivation message |

**Pass Criteria:** The overlay fires exactly after the 5-second inactivity window.

---

### Test 5: Large Paste → Gossip / Demotivate

**Purpose:** Verify that pasting 50+ characters in a single stroke triggers the copy-paste sensor.

**Steps:**
1. In the Extension Development Host, create a new file: `paste-test.js`.
2. **Copy the following text** to your clipboard (highlight it here and press `Ctrl+C`):
   ```
   Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
   ```
   (This is 233 characters — well over the 50-character threshold.)
3. Click inside the empty `paste-test.js` file in the Extension Development Host.
4. Press **`Ctrl+V`** to paste.

**Expected Results:**

| Layer | Expected Behavior |
|-------|-------------------|
| **Terminal 1** | `POST /api/action 200` — trigger is `"large_paste"`, metadata includes `"pastedLength": 233` |
| **Electron Overlay** | A gossip bubble layout or notification card appears |
| **Audio** | TTS reads the roast aloud (gossip, mock, and demotivate all have TTS) |

**Pass Criteria:** The trigger metadata shows `pastedLength > 50`.

---

### Test 6: Triple Error → Force Light Mode

**Purpose:** Verify that the same terminal error occurring 3 times consecutively forces VS Code into light mode.

> ⚠️ **This trigger requires the `onDidWriteTerminalData` proposed API**, which may not be available in all VS Code versions. If the terminal monitoring isn't active, this test will not fire. Check the Debug Console for `[Anti-Copilot Sensor] Terminal monitoring not available.` — if you see that, skip this test.

**Steps:**
1. In the Extension Development Host, open the **integrated terminal** (`` Ctrl+` ``).
2. Run the **exact same failing command** three times in a row:
   ```bash
   node -e "throw new Error('test failure')"
   ```
3. Run it a second time:
   ```bash
   node -e "throw new Error('test failure')"
   ```
4. Run it a third time:
   ```bash
   node -e "throw new Error('test failure')"
   ```

**Expected Results:**

| Layer | Expected Behavior |
|-------|-------------------|
| **Terminal 1** | `POST /api/action 200` — trigger is `"triple_error"` |
| **VS Code Theme** | The entire VS Code window **switches to "Default Light Modern"** (blinding white theme) |
| **Electron Overlay** | A force_light_mode notification card appears (yellow left border) |

**Pass Criteria:** The VS Code color theme physically changes to a light theme. Look at the title bar, sidebar, and editor background — they should all be bright white.

**Recovery:** After testing, you can manually restore your dark theme via **Settings → Color Theme** or wait for the next session.

---

### Test 7: Dirty Commit → Block Window

**Purpose:** Verify that running `git commit` while diagnostic errors exist triggers the fullscreen blocker.

**Steps:**
1. In the Extension Development Host, make sure `broken.ts` (from Test 3) is open and has red squiggly errors visible.
2. Open the **integrated terminal** (`` Ctrl+` ``).
3. Type (but don't worry if it fails — the sensor triggers on the terminal text, not the git result):
   ```bash
   git commit -m "yolo"
   ```
4. Press Enter.

**Expected Results:**

| Layer | Expected Behavior |
|-------|-------------------|
| **Terminal 1** | `POST /api/action 200` — trigger is `"dirty_commit"` |
| **Electron Overlay** | The overlay **expands to fullscreen**, showing a giant **"🛑 ACCESS DENIED"** message with a red heading and white explanation text |
| **Audio** | No TTS for block_window (by design — visual impact only) |
| **Window Behavior** | The overlay becomes **un-clickable-through** — it physically blocks your mouse from reaching VS Code for 8 seconds |

**Pass Criteria:**
1. The Electron window resizes from 420×350 to your full screen resolution.
2. You cannot click through to VS Code for 8 seconds.
3. After 8 seconds, the overlay shrinks back to the bottom-right corner.

---

### Test 8: Play Video (YouTube Rickroll)

**Purpose:** Verify the YouTube iframe injection and autoplay.

> 📝 The `play_video` action is not currently one of the options in the Bedrock prompt. To test this action, manually send a WebSocket message.

**Manual Test Steps:**
1. Open a **new terminal** (Terminal 3).
2. Run wscat:
   ```bash
   npx wscat -c ws://localhost:9009
   ```
3. Once connected, paste this JSON and press Enter:
   ```json
   {"type":"action","action":"play_video","content":"Enjoy this educational content while I judge your code."}
   ```

**Expected Results:**

| Layer | Expected Behavior |
|-------|-------------------|
| **Electron Overlay** | A card appears with the text message AND a YouTube video player showing Rick Astley's "Never Gonna Give You Up" |
| **Audio** | The YouTube video audio should play automatically (via autoplayPolicy setting) |
| **Duration** | The overlay stays visible for 15 seconds before auto-hiding |

---

### Test 9: Gossip (Manual Test)

**Purpose:** Verify the 3-bubble gossip chat layout with staggered animations.

**Manual Test Steps:**
1. In the same wscat connection (or reconnect with `npx wscat -c ws://localhost:9009`):
   ```json
   {"type":"action","action":"gossip","content":"I heard they still use var in 2026."}
   ```

**Expected Results:**

| Layer | Expected Behavior |
|-------|-------------------|
| **Electron Overlay** | Three chat bubbles appear with staggered animation: |
| | Bubble 1 (blue gradient, left-aligned): "Did you see that copy paste?" |
| | Bubble 2 (purple gradient, left-aligned, 150ms delay): "Yeah, 0 original thoughts." |
| | Bubble 3 (red gradient, right-aligned, 300ms delay): The AI-generated content |
| **Audio** | TTS reads the gossip content aloud |
| **Duration** | Visible for 6 seconds |

---

## Phase 4: Validating AWS DynamoDB & The Hall of Shame UI

### Step 4.1: Local Frontend Inspection

1. Open your web browser.
2. Navigate to: **`http://localhost:3000`**
3. You should see the **"🏆 Global Hall of Shame"** leaderboard.

**What to verify:**
- Your insulting username (from Step 1.3, e.g., `SpaghettiCoder_42`) appears in the list.
- The **Shame Score** has incremented (it should be `total_triggers × 10`).
- The **Most common fail** shows the trigger type you activated most (e.g., `terminal_error`).
- The leaderboard auto-refreshes every 5 seconds (you'll see numbers go up if you keep triggering events).

### Step 4.2: Data Aggregation Check

After running Tests 1–7, your developer profile should show approximately:

| Field | Expected Value |
|-------|---------------|
| **Display Name** | Your insulting username (e.g., `CluelessDev_817`) |
| **Total Errors** | 7+ (one per test, plus any extras from rapid-fire testing) |
| **Top Error** | `terminal_error` (you likely triggered this the most) |
| **Shame Score** | `totalErrors × 10` |

If these values appear correctly on the dashboard, the full DynamoDB → Leaderboard API → React UI pipeline is confirmed working.

### Step 4.3: AWS Console Verification

1. Go to: **https://console.aws.amazon.com/**
2. Sign in with your AWS credentials.
3. In the search bar at the top, type **"DynamoDB"** and click the DynamoDB service.
4. In the left sidebar, click **"Tables"**.
5. Click on the table named: **`anti-copilot-telemetry`**
6. Click the **"Explore table items"** button (top right).
7. You will see a list of items. Each item has:

| Attribute | Description |
|-----------|-------------|
| `pk` | `USER#<your-uuid>` — The developer's unique ID |
| `sk` | `TRIGGER#<timestamp>` — The event timestamp |
| `username` | Your insulting username (e.g., `BuggyCoder_42`) |
| `trigger` | The trigger type (e.g., `terminal_error`, `blank_space`, `pause`) |
| `metadata` | JSON object with details (e.g., `errorCount`, `wpm`, `pastedLength`) |
| `createdAt` | ISO timestamp of when the event was logged |

**Verification Checklist:**
- [ ] Multiple items exist with your UUID in the `pk` field.
- [ ] Each test you ran has a corresponding item with the correct `trigger` value.
- [ ] The `metadata` field contains the relevant data (e.g., `wpm` for code triggers, `pastedLength` for paste triggers).
- [ ] Timestamps are recent (within the last hour).

---

## Troubleshooting

### "POST /api/action 500" in Terminal 1
- **Cause:** AWS credentials are invalid or Bedrock model access is not enabled.
- **Fix:** Check `vercel-brain/.env.local` has valid `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`. Go to AWS Console → Bedrock → Model access and ensure Claude Haiku 4.5 is enabled.
- **Note:** Even with a 500 on Bedrock, the app falls back to hardcoded insults and still returns a `200`.

### Electron overlay is invisible / no self-test card
- Check Terminal 2 for `[Anti-Copilot] WebSocket server listening on ws://localhost:9009`.
- Open the auto-attached DevTools and check the Console tab for `[Anti-Copilot Renderer]` messages.
- If you see `window.antiCopilot is NOT available! Preload may have failed.`, re-run `npm run build:overlay` and restart.
- Look for the pulsing 💀 skull in the bottom-right corner — if it's there, the renderer is alive.

### "tile memory limits exceeded" errors
- This was caused by the old cursor-tracking implementation. The overlay now uses a **fixed position** in the bottom-right corner. If you still see this error, you may be running an old build. Stop the overlay, run `npm run build:overlay`, and restart.

### No audio / TTS is silent
1. Check your system volume is unmuted.
2. Confirm the Electron app has `autoplayPolicy: 'no-user-gesture-required'` in `desktop-overlay/src/main/main.ts`.
3. TTS plays for `mock`, `demotivate`, `gossip`, and `send_meme` actions — not for `block_window`, `force_light_mode`, or `play_video`.

### Extension Development Host doesn't start
1. Make sure you opened the `vscode-sensor/` folder (not the project root) in VS Code.
2. Press `F5`. If prompted, select "VS Code Extension Development".
3. If compilation fails, run `npm run compile` in the `vscode-sensor/` directory and fix any TypeScript errors.

### "onDidWriteTerminalData" not available
- This is a **proposed VS Code API** that may not be available in all versions. If you see `[Anti-Copilot Sensor] Terminal monitoring not available.` in the debug console, Tests 6 (Triple Error) and 7 (Dirty Commit) **will not fire via terminal detection**.
- The linter/diagnostic error detection (red squiggly lines) works independently and does NOT depend on this API.

### Port conflicts
- The WebSocket server uses **port 9009**. If this port is in use, the Electron app will crash on startup.
- Run `netstat -ano | findstr :9009` to check. Kill the conflicting process or change the port in both `desktop-overlay/src/main/main.ts` and `vscode-sensor/src/extension.ts`.

---

## Summary Checklist

After completing all tests, confirm every row:

| # | Test | Trigger Fired | Action Rendered | Audio Played | DB Written |
|---|------|:---:|:---:|:---:|:---:|
| 0 | Self-Test (auto) | ✅ auto | ☐ | ☐ | N/A |
| 1 | Blank Space | ☐ | ☐ | ☐ | ☐ |
| 2 | Code / WPM | ☐ | ☐ | ☐ | ☐ |
| 3 | Terminal Error | ☐ | ☐ | ☐ | ☐ |
| 4 | Pause | ☐ | ☐ | ☐ | ☐ |
| 5 | Large Paste | ☐ | ☐ | ☐ | ☐ |
| 6 | Triple Error | ☐ | ☐ | N/A | ☐ |
| 7 | Dirty Commit | ☐ | ☐ | N/A | ☐ |
| 8 | Play Video (manual) | ☐ | ☐ | ☐ | N/A |
| 9 | Gossip (manual) | ☐ | ☐ | ☐ | N/A |
| 10 | Hall of Shame UI | N/A | ☐ | N/A | ☐ |
| 11 | DynamoDB Console | N/A | N/A | N/A | ☐ |

**If all boxes are checked, Anti-Copilot is fully operational.** 🎉💀
