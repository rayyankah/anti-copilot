# 🏆 Gremlin: The Ultimate Anti-Productivity Tool

**Copilot helps you write code. Gremlin actively tries to ruin it. It hijacks your editor, flashes memes when you panic, and live-streams your suffering to a heckler on the web. Pure, chaotic anti-productivity.**

---

## 🚀 What it does
Gremlin is a transparent desktop overlay, a VS Code extension, and a live web dashboard that actively bullies you while you code. It doesn't wait for you to ask a question. Instead, it tracks your real-time telemetry, calculates your stress levels, and physically attacks your editor when you mess up.

* **The Chaos Planner:** Instead of random timers, our internal logic engine mathematically calculates a "Chaos Opportunity Score" based on your cognitive state. If you are typing frantically or staring blankly, it pulls from a weighted action pool to flash live Giphy memes, block your screen, or audibly roast your typos.
* **Physical Editor Attacks:** The VS Code extension doesn't just watch you—it attacks you. If you panic-type too many errors, the agent can actively reach into your editor and turn your font completely invisible to break your tunnel vision.
* **Live Esports Commentator Dashboard:** All of your session data is logged to our AWS DynamoDB backend and visualized on a personal Next.js dashboard. But it's not just stats—we built a live AI commentator powered by Claude Haiku that watches your telemetry and heckles you in real-time like a toxic sports caster.

## 🛠️ How we built it
We architected the system using **Vercel v0** and **AWS**, making full use of the **$100 AWS credit** provided by the hackathon!

* **The Brain (AWS Bedrock & Claude Haiku):** We run **AWS Bedrock** as our core reasoning engine, specifically utilizing the lightning-fast **Claude Haiku** model. When our local Chaos Planner decides it's time to strike, it queries Claude Haiku via Bedrock to instantly generate highly personalized roasts and live commentary.
* **The Dashboard & Database:** The web dashboard, generated with **Vercel v0**, hosts our live Esports Commentator UI. We integrated **AWS DynamoDB** to securely store the session logs and telemetry data in real-time. 
* **The Desktop Client & IDE Takeover:** We built a transparent Electron app that sits cleanly on top of VS Code, complete with dynamic Giphy integration for memes. A lightweight VS Code extension tracks keystrokes via WebSockets, but it also contains active Controllers that can physically hijack the developer's font and cursor. 
* **The Deployment:** We even wrote automated PowerShell scripts (`Install-Gremlin.ps1`) so we can easily inject this chaotic setup onto other developers' machines.

## 🔧 Installation & Testing

See [INSTALL.md](./INSTALL.md) for full setup instructions to unleash Gremlin locally.
