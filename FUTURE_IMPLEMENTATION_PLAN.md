# Goal: The "Annoying iPad Kid" Transformation

The current system works flawlessly on a technical level, but the AI feels too robotic and predictable because the triggers (10s pause, 40 WPM, 3 errors) always result in a direct, static response. To make it feel truly **lively and annoying**, we need to introduce spontaneity, random variations, and a radical shift in personality.

We will transform the persona into a **Hyperactive, Unfiltered 8-Year-Old "iPad Kid" / Backseat Coder**.

## User Review Required

> [!IMPORTANT]
> Please review the proposed new behaviors and UI actions below. Let me know which ones sound the most fun/annoying to you, and if you have any other ideas for ways the kid could torture you while coding.

## 1. The Persona Shift
- **Voice Profile**: We will tweak the Web Speech API to have a higher pitch (`pitch: 1.6`) and faster rate (`rate: 1.3`) to mimic a hyperactive child.
- **Personality**: The AI will act like an incredibly impatient child watching their older sibling play a boring video game. 
- **Vocabulary**: "Are we done yet?", "My dad works at Microsoft and says your code is trash", "Can you download Fortnite on this?", "Why is that red? Did you break it?", "I'm bored."

## 2. Unpredictable "Spontaneous" Triggers
Currently, the system only reacts when *you* do something (or pause). To make it lively, the kid needs to interrupt you **unprompted**.
- **Boredom Interruption**: A background timer in the VS Code sensor. If you code for more than 3 minutes without a break, the kid randomly interrupts: *"Are we there yet? How much longer? I want to play games."*
- **Random Singing/Noises**: Instead of always giving a structured roast, the LLM will occasionally be instructed to just "make annoying sound effects" (e.g., "Beep boop! Ding! Wah wah wah!") or sing a nonsensical song.

## 3. New Visual & Annoying UI Actions (Desktop Overlay)

We will expand the `App.tsx` overlay to include new, highly distracting visual behaviors:

### A. The "Tantrum" (`action: 'tantrum'`)
- **Trigger**: Fired when you get 3 terminal errors in a row (replacing the Light Mode punishment, or combining with it).
- **Effect**: The entire VS Code window visually shakes violently (using a CSS keyframe animation on the overlay), random colors flash, and the kid screams *"IT'S NOT WORKING! YOU BROKE IT!"*

### B. The "Bouncing DVD Logo" (`action: 'dvd_distraction'`)
- **Trigger**: Fired during the 10-second pause.
- **Effect**: Instead of just roasting you, a bouncing DVD logo (or a cartoon face) appears on screen and slowly bounces off the edges of your monitor. The kid says, *"Look at it go! Don't type anything, I want to see if it hits the corner!"* If you start typing and interrupt it, the kid gets incredibly mad at you.

### C. The "Peekaboo" (`action: 'peekaboo'`)
- **Trigger**: Randomly while typing fast.
- **Effect**: A giant cartoon kid face suddenly slides in from the bottom of the screen, stares directly at your cursor for 3 seconds, says *"What's that?"*, and slides back down.

## 4. Technical Implementation Steps

### Phase 1: Brain & Persona Update (`vercel-brain`)
- Rewrite the `route.ts` system prompt completely. Instruct Claude 3 Haiku to adopt the 8-year-old persona.
- Update the JSON schema to allow the LLM to choose between the new actions (`mock`, `tantrum`, `dvd_distraction`, `peekaboo`).

### Phase 2: Sensor Spontaneity (`vscode-sensor`)
- Add a `SpontaneousTimer` to `SensorManager.ts`. It will independently fire a `bored_interruption` trigger every 2-4 minutes regardless of what the user is doing.

### Phase 3: Overlay Upgrades (`desktop-overlay`)
- Update `audioController.ts` to use a child-like pitch and speed.
- Add CSS animations for the Screen Shake (`tantrum`).
- Build a new React component for the `Bouncing DVD` logic.
- Add a new React component for the `Peekaboo` pop-up.

## Open Questions

> [!TIP]
> 1. **Do you like the "Bouncing DVD Logo" idea?** We could use an actual DVD logo, or a picture of a kid, or a giant eyeball following your cursor.
> 2. **Should the kid play actual sound effects** (like fart noises or Roblox 'Oof' sounds) alongside the text, or just rely on the Speech Synthesis voice?
