/**
 * splash.js — Anti-Copilot Boot Sequence
 * 
 * Synthesizes a water drop sound via Web Audio API and
 * listens for status updates from the Electron main process.
 */

(function () {
  'use strict';

  // ─── Water Drop Sound Synthesis ───
  function playWaterDrop() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();

      // Layer 1: Primary drop — descending pitch
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(1400, ctx.currentTime);
      osc1.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.15);
      gain1.gain.setValueAtTime(0.4, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.3);

      // Layer 2: Splash resonance — higher harmonic
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(2800, ctx.currentTime + 0.02);
      osc2.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.12);
      gain2.gain.setValueAtTime(0.15, ctx.currentTime + 0.02);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(ctx.currentTime + 0.02);
      osc2.stop(ctx.currentTime + 0.2);

      // Layer 3: Sub-bass ripple
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(80, ctx.currentTime + 0.08);
      osc3.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.4);
      gain3.gain.setValueAtTime(0.2, ctx.currentTime + 0.08);
      gain3.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.start(ctx.currentTime + 0.08);
      osc3.stop(ctx.currentTime + 0.5);

      console.log('[Splash] Water drop sound played');
    } catch (e) {
      console.error('[Splash] Audio synthesis failed:', e);
    }
  }

  // ─── Status Updates from Main Process ───
  const statusText = document.getElementById('status-text');
  const statusDot = document.getElementById('status-dot');

  if (window.antiCopilotSplash) {
    window.antiCopilotSplash.onStatusUpdate(function (status) {
      console.log('[Splash] Status:', status.message);
      if (statusText) {
        statusText.textContent = status.message;
      }
      if (statusDot && status.level === 'error') {
        statusDot.style.background = '#ff4444';
      } else if (statusDot && status.level === 'success') {
        statusDot.style.background = '#4ade80';
      }
    });
  }

  // ─── Boot Sequence ───
  // Play water drop immediately on load (Electron has autoplay enabled)
  window.addEventListener('DOMContentLoaded', function () {
    // Small delay to sync with flash animation
    setTimeout(playWaterDrop, 300);

    // Notify main process that splash animation is "done" after sequence plays
    setTimeout(function () {
      console.log('[Splash] Animation sequence complete');
      if (window.antiCopilotSplash) {
        window.antiCopilotSplash.splashReady();
      }
    }, 3000);
  });
})();
