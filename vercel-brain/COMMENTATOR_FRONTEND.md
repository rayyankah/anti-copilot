# Commentator Frontend ↔ Brain Integration

The brain (this repo, hosted on Vercel) exposes a live-commentary endpoint the
**Commentator** frontend calls. The frontend sends the current conversation, what
the user is doing, and optional event triggers; the brain returns one
in-character commentary line plus presentation metadata.

---

## 1. Endpoint

```
POST  https://vercel-brain-zeta.vercel.app/api/commentator
GET   https://vercel-brain-zeta.vercel.app/api/commentator   → liveness + lists events/styles
```

- CORS is enabled (`Access-Control-Allow-Origin: *` by default; lock down with the
  `ALLOWED_ORIGIN` env var on the brain).
- `Content-Type: application/json`.
- No auth required by default.

---

## 2. Request body

```jsonc
{
  "sessionId": "abc-123",                 // optional — enables a stored transcript
  "conversation": [                       // the running chat the commentator watches
    { "role": "user",      "content": "let's refactor the auth flow", "timestamp": 1719700000000 },
    { "role": "assistant", "content": "sure, here's a plan..." }
  ],
  "userActivity": {                       // what the user is doing RIGHT NOW
    "summary": "renaming variables in auth.ts for the 4th time",
    "status": "typing",                   // optional freeform: idle | typing | speaking | winning | ...
    "metadata": { "file": "auth.ts", "errors": 2 }   // optional, anything
  },
  "event": {                              // optional explicit trigger (see §4)
    "type": "roast",
    "payload": { "reason": "they pasted code they didn't read" }
  },
  "style": "gremlin",                     // gremlin | hype | sports | snark | deadpan
  "recentComments": [                     // last few lines already shown, to avoid repeats
    "Refactor number four. Bold strategy."
  ]
}
```

Only `conversation`, `userActivity`, `event`, and `recentComments` really matter
per call — all fields are optional and have safe defaults. `style` defaults to
`"gremlin"`.

---

## 3. Response body

```jsonc
{
  "comment": "Renaming variables won't fix logic you never understood.",
  "emotion": "smug",        // smug|gleeful|amused|hyped|bored|shocked|disgusted|sarcastic|curious|neutral|sad|devastated
  "intensity": 0.6,         // 0 = mutter, 1 = screaming — drive TTS volume / animation
  "shouldSpeak": true,      // if false, render nothing this beat
  "reasoning": "Their repeated renames signal they're lost.",
  "event": "roast"          // echoes the triggered event (or null)
}
```

Render rule: if `shouldSpeak === false` or `comment` is empty, show nothing.

---

## 4. Event triggers (`event.type`)

Recommended values the brain has tuned playbooks for:

| type           | when to fire it                                              |
| -------------- | ----------------------------------------------------------- |
| `intro`        | session/stream just started — cocky opener                  |
| `outro`        | wrapping up — smug sign-off                                  |
| `react`        | react to the most recent message specifically               |
| `roast`        | order a direct, personal roast of the user                  |
| `celebrate`    | user thinks they nailed it (gremlin gets jealous/sad)       |
| `hype`         | crank energy, play-by-play at a peak moment                  |
| `warn`         | dramatically warn about a mistake/risk                      |
| `play_by_play` | narrate the live action moment-to-moment                    |
| `tangent`      | short absurd aside                                          |
| `silence`      | strongly bias toward staying quiet                          |

Any other string is accepted too — the brain treats it as a custom event and
reacts to `event.payload`. Omit `event` entirely to just comment on the current
state.

---

## 5. Minimal client (TypeScript / fetch)

```ts
const BRAIN_URL = "https://vercel-brain-zeta.vercel.app";

export interface CommentatorResponse {
  comment: string;
  emotion: string;
  intensity: number;
  shouldSpeak: boolean;
  reasoning: string;
  event: string | null;
}

export async function getCommentary(input: {
  sessionId?: string;
  conversation: { role: "user" | "assistant" | "system"; content: string }[];
  userActivity: { summary: string; status?: string; metadata?: Record<string, unknown> };
  event?: { type: string; payload?: Record<string, unknown> };
  style?: "gremlin" | "hype" | "sports" | "snark" | "deadpan";
  recentComments?: string[];
}): Promise<CommentatorResponse> {
  const res = await fetch(`${BRAIN_URL}/api/commentator`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Brain error ${res.status}`);
  return res.json();
}

// Fire on an event button:
await getCommentary({
  conversation,
  userActivity: { summary: "stuck on the same bug for 10 minutes", status: "idle" },
  event: { type: "roast" },
  recentComments: lastThreeLines,
});
```

---

## 6. Builder prompt (paste into v0 / Claude to scaffold the frontend)

> Build a **Commentator** web app (Next.js + React + TypeScript, Tailwind) that
> acts as a live peanut-gallery overlay for an ongoing conversation/session.
>
> **Data it manages**
> - A `conversation` array of `{ role, content }` messages (let me append to it
>   via an input box, or seed it from props).
> - A `userActivity` object: `{ summary, status?, metadata? }` describing what the
>   user is doing right now (editable text field + status dropdown).
> - A feed of commentary lines the app has received.
>
> **Backend contract** — call `POST https://vercel-brain-zeta.vercel.app/api/commentator`
> with JSON `{ sessionId?, conversation, userActivity, event?, style?, recentComments? }`
> and receive `{ comment, emotion, intensity, shouldSpeak, reasoning, event }`.
> Always send the last 3–5 prior comments back as `recentComments` so it never
> repeats itself. If `shouldSpeak` is false or `comment` is empty, render nothing.
>
> **UI**
> - A live commentary feed: each line shows the `comment`, an emoji/color derived
>   from `emotion`, and uses `intensity` to scale font size / animation punch.
> - A row of **event trigger buttons** — `intro`, `react`, `roast`, `hype`,
>   `celebrate`, `warn`, `outro`, `tangent` — each POSTs with that `event.type`.
> - A **style selector**: `gremlin | hype | sports | snark | deadpan` (sent as `style`).
> - An "auto-comment" toggle that, while on, calls the endpoint every ~8s with no
>   explicit event so the commentator riffs on the current state on its own.
> - Optional: speak each `comment` with the Web Speech API, mapping `intensity`
>   to volume/rate and `emotion` to pitch.
>
> Keep one stable `sessionId` per page load (e.g. `crypto.randomUUID()`) so the
> backend stores a transcript. Handle network errors gracefully (skip the beat).
```

---

## 7. Notes

- The commentator persona is the same Anti-Copilot gremlin, in "color
  commentator" mode — it mocks more than it praises, and when the user *wins* it
  gets jealous/sad rather than congratulatory. Switch `style` for other tones.
- Transcripts (when `sessionId` is sent) are stored in DynamoDB under
  `pk = COMMENTARY#<sessionId>`, `sk = LINE#<timestamp>`.
- The endpoint runs on the Node runtime with a 30s max duration (Bedrock /
  Claude Haiku 4.5).
