/**
 * debug.js — Anti-Copilot Debug Monitor
 * 
 * Receives log entries from the Electron main process
 * and renders them as color-coded rows in a terminal-style table.
 */

(function () {
  'use strict';

  const logBody = document.getElementById('log-body');
  const logContainer = document.getElementById('log-container');
  const statsCount = document.getElementById('stats-count');
  const statsUptime = document.getElementById('stats-uptime');
  const btnAutoScroll = document.getElementById('btn-auto-scroll');
  const btnClear = document.getElementById('btn-clear');

  let entryCount = 0;
  let autoScroll = true;
  const startTime = Date.now();

  // ─── Auto-scroll toggle ───
  btnAutoScroll.addEventListener('click', function () {
    autoScroll = !autoScroll;
    btnAutoScroll.classList.toggle('active', autoScroll);
  });

  // ─── Clear logs ───
  btnClear.addEventListener('click', function () {
    logBody.innerHTML = '';
    entryCount = 0;
    updateStats();
  });

  // ─── Format timestamp ───
  function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  // ─── Update stats bar ───
  function updateStats() {
    statsCount.textContent = entryCount + ' entries';
    var elapsed = Math.floor((Date.now() - startTime) / 1000);
    var mins = Math.floor(elapsed / 60);
    var secs = elapsed % 60;
    statsUptime.textContent = 'Uptime: ' + (mins > 0 ? mins + 'm ' : '') + secs + 's';
  }

  // Update uptime every second
  setInterval(updateStats, 1000);

  // ─── Add log entry ───
  function addLogEntry(entry) {
    entryCount++;

    var tr = document.createElement('tr');

    // Time
    var tdTime = document.createElement('td');
    tdTime.textContent = formatTime(entry.timestamp || Date.now());
    tdTime.style.color = 'rgba(255,255,255,0.3)';
    tr.appendChild(tdTime);

    // Source
    var tdSource = document.createElement('td');
    var sourceSpan = document.createElement('span');
    sourceSpan.className = 'source-tag source-' + (entry.source || 'main').toLowerCase();
    sourceSpan.textContent = (entry.source || 'MAIN').toUpperCase();
    tdSource.appendChild(sourceSpan);
    tr.appendChild(tdSource);

    // Level
    var tdLevel = document.createElement('td');
    tdLevel.className = 'level-' + (entry.level || 'info').toLowerCase();
    tdLevel.textContent = (entry.level || 'INFO').toUpperCase();
    tr.appendChild(tdLevel);

    // Message
    var tdMsg = document.createElement('td');
    tdMsg.className = 'msg-cell';
    tdMsg.textContent = entry.message || '';
    tr.appendChild(tdMsg);

    logBody.appendChild(tr);

    // Auto-scroll
    if (autoScroll) {
      logContainer.scrollTop = logContainer.scrollHeight;
    }

    // Cap at 1000 rows for performance
    while (logBody.children.length > 1000) {
      logBody.removeChild(logBody.firstChild);
    }

    updateStats();
  }

  // ─── Listen for log entries from main process ───
  if (window.antiCopilotDebug) {
    window.antiCopilotDebug.onLogEntry(function (entry) {
      addLogEntry(entry);
    });
  }

  // ─── Initial entry ───
  addLogEntry({
    timestamp: Date.now(),
    source: 'main',
    level: 'info',
    message: 'Debug monitor initialized. Waiting for log entries...',
  });
})();
