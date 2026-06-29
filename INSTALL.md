# Gremlin — Install & Boot Guide

**Gremlin** (a.k.a. Anti-Copilot) is a desktop overlay + VS Code sensor that
watches you code and heckles you in real time. The "brain" is already hosted in
the cloud, so a new machine only needs to run the overlay and the VS Code
extension — no AWS keys, no server to start.

---

## 🚀 Quick start (one file)

1. Copy the **whole project folder** to the target PC.
2. Double-click **`Gremlin-Setup.bat`** (or right-click `Install-Gremlin.ps1` → *Run with PowerShell*).
3. Approve any install prompts. Watch the splash screen — it shows live messages
   while it connects to the cloud brain, then the gremlin takes over.

That single script checks what's missing, installs it, builds everything, installs
the VS Code extension, and boots the overlay. Re-running it is safe (idempotent).

> The overlay window runs from a terminal window. **Leave that window open** —
> closing it stops the Gremlin.

---

## 🧩 What the installer does automatically

| Step | Action |
| ---- | ------ |
| 1 | Checks for **Node.js LTS** and **VS Code**; installs missing ones via `winget`. |
| 2 | Runs `npm install` in `desktop-overlay/` and `vscode-sensor/`. |
| 3 | Packages the VS Code sensor (`.vsix`) and installs it with `code --install-extension`. |
| 4 | Builds the overlay. |
| 5 | Launches the overlay pointed at the hosted brain. |

---

## 📦 Required libraries / prerequisites (full list)

The script installs these for you, but here's exactly what the app needs:

### System-level (installed via `winget` if missing)
- **Node.js LTS** (`OpenJS.NodeJS.LTS`) — provides `node` + `npm`. v18+ required.
- **Visual Studio Code** (`Microsoft.VisualStudioCode`) — provides the `code` CLI used to install the extension.
- **winget / App Installer** — ships with Windows 11 and current Windows 10. If
  missing, install *App Installer* from the Microsoft Store, then re-run.

### Overlay (`desktop-overlay/`, installed by `npm install`)
- Runtime: `electron`, `react`, `react-dom`, `ws`, `@giphy/js-fetch-api`, `dotenv`, `electron-is-dev`
- Build/dev: `vite`, `@vitejs/plugin-react`, `typescript`, `concurrently`, `wait-on`

### VS Code sensor (`vscode-sensor/`, installed by `npm install`)
- Runtime: `ws`
- Build: `esbuild`, `@vscode/vsce`, `typescript`, `@types/vscode`, `@types/node`, `@types/ws`

> The cloud **brain** (`vercel-brain/`) is **not** needed on a client machine — it
> runs on Vercel. You don't install or configure it here.

---

## 🔌 How it connects to the backend

- The overlay talks to the hosted brain at
  **`https://vercel-brain-zeta.vercel.app`** over HTTPS.
- The VS Code sensor streams telemetry to the overlay locally over WebSocket
  (`ws://localhost:9009`); the overlay relays to the cloud brain.
- Override the brain URL if you ever self-host:
  ```powershell
  .\Install-Gremlin.ps1 -BackendUrl "https://your-brain.vercel.app"
  ```
  (or set the `ANTI_COPILOT_BRAIN_URL` environment variable before launch).

The splash screen polls the brain on boot and shows rotating status lines
("Waking the gremlin…", "Bribing the cloud…") until it gets a response, then
flips to **"Gremlin connected ✓"**.

---

## 🛠️ Manual install (if you'd rather not use the script)

```powershell
# 1. Prereqs
winget install OpenJS.NodeJS.LTS -e
winget install Microsoft.VisualStudioCode -e
#    open a NEW terminal so PATH refreshes

# 2. Dependencies
cd desktop-overlay ; npm install ; cd ..
cd vscode-sensor   ; npm install

# 3. Build + install the sensor
npm run package
code --install-extension *.vsix --force
cd ..

# 4. Boot the overlay (connects to the hosted brain)
cd desktop-overlay
$env:ANTI_COPILOT_BRAIN_URL = "https://vercel-brain-zeta.vercel.app"
npm run dev
```

---

## ❓ Troubleshooting

- **"node/code is not recognized" right after install** → open a **new** terminal
  (PATH only refreshes for new shells) and re-run the script.
- **"running scripts is disabled on this system"** → use the `.bat`, or run
  `powershell -ExecutionPolicy Bypass -File .\Install-Gremlin.ps1`.
- **winget not found** → install *App Installer* from the Microsoft Store.
- **Overlay shows "Backend slow — booting anyway…"** → it couldn't reach the brain
  in ~30s (no internet / brain down). It still boots and keeps retrying; check
  `https://vercel-brain-zeta.vercel.app/api/commentator` in a browser (should be JSON).
- **Port 9009 busy** → another Gremlin instance is running; close its terminal window.
- **Stop the Gremlin** → close the terminal window that the overlay launched from.

---

## 🖥️ Supported platforms

The one-click installer targets **Windows 10/11**. On macOS/Linux, follow the
*Manual install* steps (replace `winget` with `brew`/your package manager and use
the platform Electron build).
