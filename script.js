/**
 * ═══════════════════════════════════════════════════════════
 *  Z.A.R.A — Zero-latency Artificial Responsive Assistant
 *  script.js — Complete Frontend Logic
 *
 *  API INTEGRATION GUIDE:
 *  ─────────────────────────────────────────────────────────
 *  This file contains all frontend logic with clearly marked
 *  spots for API integration. Backend is Python/Flask.
 *  Base URL configured in settings or defaults to localhost.
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

/* ── CONFIG ─────────────────────────────────────────────── */
const CONFIG = {
  backendUrl: localStorage.getItem('zara_backend_url') || 'http://localhost:5000',
  voiceEnabled: localStorage.getItem('zara_voice') !== 'false',
  gestureEnabled: localStorage.getItem('zara_gesture') === 'true',
  particlesEnabled: localStorage.getItem('zara_particles') !== 'false',
  particleCount: 80,
  vizBarCount: 64,
};

/* ── STATE ──────────────────────────────────────────────── */
const STATE = {
  isListening: false,
  isProcessing: false,
  isActivated: false,
  commandHistory: JSON.parse(localStorage.getItem('zara_history') || '[]'),
  memories: JSON.parse(localStorage.getItem('zara_memories') || '[]'),
  audioContext: null,
  analyser: null,
  microphone: null,
  animFrameId: null,
  typingInterval: null,
};

/* ════════════════════════════════════════════════════════
   CURSOR SYSTEM
════════════════════════════════════════════════════════ */
(function initCursor() {
  const cur = document.createElement('div');
  cur.id = 'cursor';
  const ring = document.createElement('div');
  ring.id = 'cursorRing';
  document.body.appendChild(cur);
  document.body.appendChild(ring);

  let mx = 0, my = 0, rx = 0, ry = 0;

  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    cur.style.left = mx + 'px';
    cur.style.top = my + 'px';
  });

  (function trackRing() {
    rx += (mx - rx) * 0.1;
    ry += (my - ry) * 0.1;
    ring.style.left = rx + 'px';
    ring.style.top = ry + 'px';
    requestAnimationFrame(trackRing);
  })();

  // Scale cursor on interactive elements
  document.addEventListener('mouseover', e => {
    if (e.target.closest('button, input, textarea, a, .feature-btn')) {
      cur.style.width = '4px';
      cur.style.height = '4px';
      ring.style.width = '44px';
      ring.style.height = '44px';
      ring.style.borderColor = 'rgba(0,212,255,.7)';
    }
  });
  document.addEventListener('mouseout', e => {
    if (e.target.closest('button, input, textarea, a, .feature-btn')) {
      cur.style.width = '8px';
      cur.style.height = '8px';
      ring.style.width = '28px';
      ring.style.height = '28px';
      ring.style.borderColor = 'rgba(0,212,255,.4)';
    }
  });
})();

/* ════════════════════════════════════════════════════════
   CLOCK
════════════════════════════════════════════════════════ */
function updateClock() {
  const el = document.getElementById('timeDisplay');
  if (!el) return;
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  el.textContent = `${h}:${m}:${s}`;
}
setInterval(updateClock, 1000);
updateClock();

/* ════════════════════════════════════════════════════════
   PARTICLE SYSTEM
════════════════════════════════════════════════════════ */
(function initParticles() {
  const canvas = document.getElementById('particleCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W = 0, H = 0, particles = [];

  class Particle {
    constructor() { this.reset(true); }
    reset(rand) {
      this.x = Math.random() * W;
      this.y = rand ? Math.random() * H : H + 10;
      this.vx = (Math.random() - 0.5) * 0.3;
      this.vy = -0.2 - Math.random() * 0.4;
      this.life = 1;
      this.decay = 0.002 + Math.random() * 0.004;
      this.size = 0.5 + Math.random() * 1.5;
      const colors = ['rgba(0,212,255,', 'rgba(124,106,255,', 'rgba(0,255,247,'];
      this.color = colors[Math.floor(Math.random() * colors.length)];
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.life -= this.decay;
      if (this.life <= 0) this.reset(false);
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = this.color + this.life * 0.6 + ')';
      ctx.fill();
    }
  }

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function init() {
    resize();
    particles = Array.from({ length: CONFIG.particleCount }, () => new Particle());
    window.addEventListener('resize', resize);
    loop();
  }

  function loop() {
    if (!CONFIG.particlesEnabled) {
      ctx.clearRect(0, 0, W, H);
      requestAnimationFrame(loop);
      return;
    }
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(loop);
  }

  init();
})();

/* ════════════════════════════════════════════════════════
   NUCLEUS PARTICLES (AI Core)
════════════════════════════════════════════════════════ */
(function initNucleusParticles() {
  const container = document.getElementById('nucleusParticles');
  if (!container) return;
  for (let i = 0; i < 8; i++) {
    const p = document.createElement('div');
    p.style.cssText = `
      position:absolute;
      width:3px;height:3px;border-radius:50%;
      background:rgba(0,212,255,0.8);
      box-shadow:0 0 4px rgba(0,212,255,0.8);
      top:50%;left:50%;
      transform-origin:${14 + Math.random() * 10}px 0;
      animation:orbitParticle ${1.5 + Math.random() * 2}s linear infinite;
      animation-delay:${-Math.random() * 2}s;
    `;
    container.appendChild(p);
  }
  // Inject keyframe if not present
  if (!document.getElementById('orbitKF')) {
    const style = document.createElement('style');
    style.id = 'orbitKF';
    style.textContent = `
      @keyframes orbitParticle {
        from { transform: rotate(0deg) translateX(22px) rotate(0deg); opacity:.8; }
        50% { opacity:.3; }
        to { transform: rotate(360deg) translateX(22px) rotate(-360deg); opacity:.8; }
      }
    `;
    document.head.appendChild(style);
  }
})();

/* ════════════════════════════════════════════════════════
   CORE DATA POINTS
════════════════════════════════════════════════════════ */
(function initDataPoints() {
  const container = document.getElementById('coreDataPoints');
  if (!container) return;
  const count = 12;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const r = 100; // radius of outer ring
    const x = 110 + r * Math.cos(angle);
    const y = 110 + r * Math.sin(angle);
    const dot = document.createElement('div');
    dot.className = 'data-point';
    dot.style.cssText = `
      left:${x}px;top:${y}px;
      transform:translate(-50%,-50%);
      opacity:${0.3 + Math.random() * 0.7};
      animation:dataPulse ${1 + Math.random() * 2}s ease-in-out infinite;
      animation-delay:${-Math.random() * 2}s;
    `;
    container.appendChild(dot);
  }
  if (!document.getElementById('dataPulseKF')) {
    const style = document.createElement('style');
    style.id = 'dataPulseKF';
    style.textContent = `@keyframes dataPulse{0%,100%{opacity:.2;transform:translate(-50%,-50%) scale(1)}50%{opacity:1;transform:translate(-50%,-50%) scale(1.5)}}`;
    document.head.appendChild(style);
  }
})();

/* ════════════════════════════════════════════════════════
   METRICS ANIMATION
════════════════════════════════════════════════════════ */
(function animateMetrics() {
  const latEl = document.getElementById('metricLatency');
  const cpuEl = document.getElementById('metricCpu');
  setInterval(() => {
    if (latEl) latEl.textContent = (Math.floor(Math.random() * 4)) + 'ms';
    if (cpuEl) cpuEl.textContent = (85 + Math.floor(Math.random() * 12)) + '%';
  }, 2000);
})();

/* ════════════════════════════════════════════════════════
   VOICE VISUALIZER BARS
════════════════════════════════════════════════════════ */
(function initVizBars() {
  const container = document.getElementById('vizBars');
  if (!container) return;
  for (let i = 0; i < CONFIG.vizBarCount; i++) {
    const bar = document.createElement('div');
    bar.className = 'viz-bar';
    bar.style.height = '3px';
    container.appendChild(bar);
  }
})();

function animateIdleViz() {
  const bars = document.querySelectorAll('.viz-bar');
  if (!bars.length) return;
  bars.forEach((bar, i) => {
    const h = 4 + Math.abs(Math.sin(Date.now() * 0.002 + i * 0.25)) * 22;
    bar.style.height = h + 'px';
    bar.style.opacity = 0.3 + (h / 40) * 0.7;
  });
  if (!STATE.isListening) requestAnimationFrame(animateIdleViz);
}
requestAnimationFrame(animateIdleViz);

function animateLiveViz(dataArray) {
  const bars = document.querySelectorAll('.viz-bar');
  if (!bars.length) return;
  const step = Math.floor(dataArray.length / CONFIG.vizBarCount);
  bars.forEach((bar, i) => {
    const val = dataArray[i * step] || 0;
    const h = 3 + (val / 255) * 52;
    bar.style.height = h + 'px';
    bar.style.opacity = 0.3 + (val / 255) * 0.7;
  });
}

/* ════════════════════════════════════════════════════════
   INTERSECTION OBSERVER — REVEAL ANIMATIONS
════════════════════════════════════════════════════════ */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    } else {
      // Re-trigger on scroll up
      entry.target.classList.remove('visible');
    }
  });
}, {
  threshold: 0.08,
  rootMargin: '0px 0px -40px 0px'
});

document.querySelectorAll('.reveal-section').forEach((el, i) => {
  el.style.transitionDelay = `${i * 0.08}s`;
  revealObserver.observe(el);
});

/* ════════════════════════════════════════════════════════
   MAGNETIC HOVER EFFECT
════════════════════════════════════════════════════════ */
document.querySelectorAll('.magnetic-btn').forEach(btn => {
  btn.addEventListener('mousemove', e => {
    const r = btn.getBoundingClientRect();
    const x = e.clientX - r.left - r.width / 2;
    const y = e.clientY - r.top - r.height / 2;
    btn.style.transform = `translate(${x * 0.2}px,${y * 0.25}px)`;
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.transform = '';
  });
});

/* ════════════════════════════════════════════════════════
   SYSTEM STATUS UPDATER
════════════════════════════════════════════════════════ */
function setSystemStatus(status, secondary = null) {
  const primary = document.getElementById('coreStatusPrimary');
  const sec = document.getElementById('coreStatusSecondary');
  const dot = document.getElementById('statusDot');
  const txt = document.getElementById('statusText');

  const statusMap = {
    online: { text: 'SYSTEM ONLINE', color: 'var(--neon-green)', navText: 'SYSTEM ONLINE' },
    listening: { text: 'LISTENING MODE', color: 'var(--neon-blue)', navText: 'LISTENING ACTIVE' },
    processing: { text: 'PROCESSING COMMAND', color: 'var(--neon-violet)', navText: 'PROCESSING...' },
    error: { text: 'ERROR STATE', color: 'var(--neon-red)', navText: 'ERROR DETECTED' },
  };

  const s = statusMap[status] || statusMap.online;
  if (primary) {
    primary.textContent = s.text;
    primary.style.color = s.color;
    primary.style.textShadow = `0 0 20px ${s.color}`;
  }
  if (sec && secondary) sec.textContent = secondary;
  if (dot) dot.style.background = s.color;
  if (txt) { txt.textContent = s.navText; txt.style.color = s.color; }
}

/* ════════════════════════════════════════════════════════
   AI RESPONSE DISPLAY — Typewriter Effect
════════════════════════════════════════════════════════ */
function displayResponse(text, type = 'normal') {
  const el = document.getElementById('responseText');
  if (!el) return;

  clearInterval(STATE.typingInterval);
  el.textContent = '';
  el.classList.add('typing');

  let i = 0;
  STATE.typingInterval = setInterval(() => {
    el.textContent += text[i] || '';
    i++;
    if (i >= text.length) {
      clearInterval(STATE.typingInterval);
      el.classList.remove('typing');
    }
  }, 18);
}

/* ════════════════════════════════════════════════════════
   ERROR DISPLAY
════════════════════════════════════════════════════════ */
let errorTimer = null;
function showError(msg) {
  const toast = document.getElementById('errorToast');
  const msgEl = document.getElementById('errorMsg');
  if (!toast || !msgEl) return;
  msgEl.textContent = msg;
  toast.classList.add('show');
  clearTimeout(errorTimer);
  errorTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

/* ════════════════════════════════════════════════════════
   COMMAND PROCESSING SYSTEM
════════════════════════════════════════════════════════ */

/**
 * Main command dispatcher
 * Sends command to backend or handles locally
 */
async function processCommand(commandText, type = 'cmd') {
  if (!commandText.trim()) {
    showError('COMMAND INPUT EMPTY — ENTER A VALID COMMAND');
    return;
  }

  STATE.isProcessing = true;
  setSystemStatus('processing', 'ANALYZING INPUT — NEURAL MATRIX ACTIVE');

  // Add to history immediately
  addToHistory(commandText, type);

  try {
    // ─────────────────────────────────────────────────────────
    // INSERT AI CHAT API HERE
    // ─────────────────────────────────────────────────────────
    // This function calls your Python backend /api/chat endpoint
    // which processes the command and returns an AI response.
    //
    // Expected request:
    //   POST /api/chat
    //   { "command": commandText, "history": STATE.commandHistory }
    //
    // Expected response:
    //   { "response": "AI reply text", "action": "optional_action", "data": {} }
    //
    const response = await callBackend('/api/chat', { command: commandText });

    if (response && response.response) {
      displayResponse(response.response);
      // Handle special actions returned by backend
      if (response.action) handleBackendAction(response.action, response.data);
    } else {
      // Fallback local response if no backend
      displayResponse(getLocalResponse(commandText));
    }

  } catch (err) {
    // ─────────────────────────────────────────────────────────
    // API failure handling — shows error, uses local fallback
    // ─────────────────────────────────────────────────────────
    console.warn('[ZARA] Backend unavailable, using local fallback:', err.message);
    displayResponse(getLocalResponse(commandText));
  }

  STATE.isProcessing = false;
  setSystemStatus('online', 'COMMAND PROCESSED — READY FOR NEXT INPUT');
}

/**
 * Generic backend API caller
 * All API calls route through this function
 */
async function callBackend(endpoint, data = {}) {
  const url = CONFIG.backendUrl + endpoint;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Handle special backend actions
 */
function handleBackendAction(action, data) {
  switch (action) {
    case 'save_memory': saveMemory(data.type, data.content); break;
    case 'set_alarm': saveAlarmData(data.time, data.label); break;
    case 'open_settings': openModal('settingsModal'); break;
    default: break;
  }
}

/**
 * Local fallback responses (no backend needed)
 */
function getLocalResponse(cmd) {
  const lower = cmd.toLowerCase();
  if (lower.includes('hello') || lower.includes('hi')) return 'Z.A.R.A online. Neural matrix synchronized. How may I assist you today?';
  if (lower.includes('time')) return `Current time is ${new Date().toLocaleTimeString()}. All temporal systems nominal.`;
  if (lower.includes('date')) return `Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`;
  if (lower.includes('note')) { openModal('noteModal'); return 'Note creation interface initialized. Awaiting input.'; }
  if (lower.includes('alarm')) { openModal('alarmModal'); return 'Alarm configuration panel opened. Set your desired time.'; }
  if (lower.includes('status')) return 'All systems nominal. Neural matrix at 94% capacity. Memory nodes stable. Latency within acceptable parameters.';
  if (lower.includes('clear')) { clearHistory(); return 'Command history purged from active memory banks.'; }
  if (lower.includes('help')) return 'Available commands: time, date, note, alarm, status, clear. Or type anything to query the AI backend.';
  return `Command received: "${cmd}". Backend connection required for advanced processing. Configure backend URL in settings.`;
}

/* ════════════════════════════════════════════════════════
   SPEECH-TO-TEXT SYSTEM
════════════════════════════════════════════════════════ */

let recognition = null;

/**
 * Toggle microphone voice input
 */
function toggleVoiceInput() {
  if (STATE.isListening) {
    stopListening();
  } else {
    startListening();
  }
}

function startListening() {
  // ─────────────────────────────────────────────────────────
  // INSERT SPEECH-TO-TEXT API HERE
  // ─────────────────────────────────────────────────────────
  // Option A: Web Speech API (built-in, no API key needed)
  //   Uses browser's native SpeechRecognition
  //
  // Option B: Replace with:
  //   - Whisper API (OpenAI): POST audio blob to /api/speech
  //   - Google Cloud Speech-to-Text
  //   - AssemblyAI
  //
  // Your Python backend /api/speech should:
  //   1. Receive audio blob
  //   2. Run whisper/google STT
  //   3. Return { "transcript": "recognized text" }
  // ─────────────────────────────────────────────────────────

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showError('SPEECH API NOT SUPPORTED IN THIS BROWSER');
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.continuous = false;

  recognition.onstart = () => {
    STATE.isListening = true;
    setSystemStatus('listening', 'VOICE INPUT ACTIVE — SPEAK NOW');
    document.getElementById('micBtn').classList.add('active');
    startMicVisualization();
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    document.getElementById('commandInput').value = transcript;
    processCommand(transcript, 'voice');
  };

  recognition.onerror = (event) => {
    showError(`VOICE ERROR: ${event.error.toUpperCase()}`);
    stopListening();
  };

  recognition.onend = () => { stopListening(); };

  recognition.start();
}

function stopListening() {
  STATE.isListening = false;
  if (recognition) { try { recognition.stop(); } catch (e) { /* ignore */ } }
  setSystemStatus('online', 'LISTENING MODE — AWAITING COMMAND');
  const btn = document.getElementById('micBtn');
  if (btn) btn.classList.remove('active');
  stopMicVisualization();
}

/* ── Microphone audio visualization ── */
async function startMicVisualization() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    STATE.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    STATE.analyser = STATE.audioContext.createAnalyser();
    STATE.analyser.fftSize = 256;
    STATE.microphone = STATE.audioContext.createMediaStreamSource(stream);
    STATE.microphone.connect(STATE.analyser);
    const dataArray = new Uint8Array(STATE.analyser.frequencyBinCount);

    function vizLoop() {
      if (!STATE.isListening) return;
      STATE.analyser.getByteFrequencyData(dataArray);
      animateLiveViz(dataArray);
      STATE.animFrameId = requestAnimationFrame(vizLoop);
    }
    vizLoop();
  } catch (e) {
    // Mic permission denied — just animate idle
    requestAnimationFrame(animateIdleViz);
  }
}

function stopMicVisualization() {
  cancelAnimationFrame(STATE.animFrameId);
  if (STATE.audioContext) {
    try { STATE.audioContext.close(); } catch (e) { /* ignore */ }
    STATE.audioContext = null;
  }
  requestAnimationFrame(animateIdleViz);
}

/* ════════════════════════════════════════════════════════
   TEXT-TO-SPEECH
════════════════════════════════════════════════════════ */

/**
 * Speak text via TTS
 */
function speakResponse(text) {
  // ─────────────────────────────────────────────────────────
  // INSERT TEXT-TO-SPEECH API HERE
  // ─────────────────────────────────────────────────────────
  // Option A: Web Speech API (built-in, free)
  //   Uses browser's SpeechSynthesis
  //
  // Option B: Replace speechSynthesis with:
  //   - ElevenLabs API: POST text → receive audio blob
  //   - OpenAI TTS: POST to /api/speak on your backend
  //   - Google Cloud TTS
  //
  // Your Python backend /api/speak should:
  //   1. Receive { "text": "..." }
  //   2. Call ElevenLabs/OpenAI TTS
  //   3. Return audio blob or base64
  //   4. Play in browser: new Audio(url).play()
  // ─────────────────────────────────────────────────────────

  if (!CONFIG.voiceEnabled) return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  synth.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate = 1.0;
  utt.pitch = 0.85;
  utt.volume = 0.9;
  // Prefer a robotic-sounding voice
  const voices = synth.getVoices();
  const preferred = voices.find(v => v.name.includes('Google') || v.name.includes('Microsoft'));
  if (preferred) utt.voice = preferred;
  synth.speak(utt);
}

/* ════════════════════════════════════════════════════════
   COMMAND HISTORY SYSTEM
════════════════════════════════════════════════════════ */

function addToHistory(command, type = 'cmd') {
  const entry = {
    id: Date.now(),
    command,
    type,
    timestamp: new Date().toLocaleTimeString(),
  };
  STATE.commandHistory.unshift(entry);
  if (STATE.commandHistory.length > 50) STATE.commandHistory.pop();

  // ─────────────────────────────────────────────────────────
  // INSERT DATABASE API HERE (optional persistence)
  // ─────────────────────────────────────────────────────────
  // POST to /api/history/save to store in backend database
  // Your backend can use SQLite or PostgreSQL
  // ─────────────────────────────────────────────────────────
  localStorage.setItem('zara_history', JSON.stringify(STATE.commandHistory));
  renderHistory();
}

function renderHistory() {
  const list = document.getElementById('historyList');
  const empty = document.getElementById('historyEmpty');
  if (!list) return;

  if (STATE.commandHistory.length === 0) {
    if (empty) empty.style.display = 'flex';
    list.querySelectorAll('.history-card').forEach(c => c.remove());
    return;
  }
  if (empty) empty.style.display = 'none';

  // Re-render only new top card
  list.querySelectorAll('.history-card').forEach(c => c.remove());

  STATE.commandHistory.slice(0, 20).forEach((entry, i) => {
    const card = document.createElement('div');
    card.className = 'history-card';
    card.style.transitionDelay = `${i * 0.04}s`;
    card.innerHTML = `
      <div class="hc-cmd">${escapeHtml(entry.command)}</div>
      <div class="hc-meta">
        <span class="hc-time">${entry.timestamp}</span>
        <span class="hc-type ${entry.type}">${entry.type.toUpperCase()}</span>
      </div>
    `;
    list.appendChild(card);
  });
}

function clearHistory() {
  STATE.commandHistory = [];
  localStorage.removeItem('zara_history');
  renderHistory();
}

/* ════════════════════════════════════════════════════════
   MEMORY SYSTEM
════════════════════════════════════════════════════════ */

function saveMemory(type, content) {
  // ─────────────────────────────────────────────────────────
  // INSERT DATABASE API HERE
  // ─────────────────────────────────────────────────────────
  // POST to /api/memory/save
  // { "type": type, "content": content }
  // Backend stores in database and returns { "id": memory_id }
  //
  // To load memories on startup:
  //   GET /api/memory/list
  //   Returns array of memory objects
  // ─────────────────────────────────────────────────────────

  const entry = {
    id: Date.now(),
    type,   // 'note' | 'alarm' | 'reminder' | 'preference'
    content,
    timestamp: new Date().toLocaleTimeString(),
    date: new Date().toLocaleDateString(),
  };
  STATE.memories.unshift(entry);
  localStorage.setItem('zara_memories', JSON.stringify(STATE.memories));
  renderMemories();
  displayResponse(`Memory stored: [${type.toUpperCase()}] "${content.slice(0, 40)}${content.length > 40 ? '...' : ''}"`);
}

function renderMemories() {
  const list = document.getElementById('memoryList');
  const empty = document.getElementById('memoryEmpty');
  const counter = document.getElementById('memoryCount');
  if (!list) return;

  if (counter) counter.textContent = `${STATE.memories.length} NODE${STATE.memories.length !== 1 ? 'S' : ''}`;

  if (STATE.memories.length === 0) {
    if (empty) empty.style.display = 'flex';
    list.querySelectorAll('.memory-card').forEach(c => c.remove());
    return;
  }
  if (empty) empty.style.display = 'none';

  list.querySelectorAll('.memory-card').forEach(c => c.remove());
  STATE.memories.slice(0, 20).forEach((entry, i) => {
    const card = document.createElement('div');
    card.className = 'memory-card';
    card.style.transitionDelay = `${i * 0.05}s`;
    card.innerHTML = `
      <span class="mc-type ${entry.type}">${entry.type.toUpperCase()}</span>
      <div class="mc-content">${escapeHtml(entry.content)}</div>
      <div class="mc-time">${entry.date} — ${entry.timestamp}</div>
    `;
    list.appendChild(card);
  });
}

/* ════════════════════════════════════════════════════════
   ALARM SYSTEM
════════════════════════════════════════════════════════ */

function saveAlarmData(time, label) {
  if (!time) { showError('ALARM TIME NOT SET'); return; }
  const display = `${label || 'Alarm'} @ ${time}`;
  saveMemory('alarm', display);
  displayResponse(`Alarm set: ${display}. Neural scheduler activated.`);
}

// Check alarms every minute
setInterval(() => {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  STATE.memories.forEach(m => {
    if (m.type === 'alarm' && m.content.includes(`@ ${currentTime}`)) {
      setSystemStatus('processing', `ALARM TRIGGERED — ${m.content}`);
      displayResponse(`ALARM: ${m.content}. Initiating notification protocol.`);
      speakResponse(`Alarm: ${m.content.split('@')[0]}`);
    }
  });
}, 30000);

/* ════════════════════════════════════════════════════════
   CAMERA GESTURE RECOGNITION SYSTEM — MediaPipe Hands
════════════════════════════════════════════════════════ */

/**
 * GESTURE SYSTEM STATE
 */
const GESTURE = {
  active: false,          // Is camera panel open?
  stream: null,           // Camera MediaStream
  hands: null,            // MediaPipe Hands instance
  rafId: null,            // requestAnimationFrame ID
  lastGesture: null,      // Last detected gesture name
  lastGestureTime: 0,     // Timestamp to debounce actions
  cooldown: 1500,         // ms between gesture triggers
  mpLoaded: false,        // Has MediaPipe loaded?
  loadAttempted: false,
};

/**
 * Gesture definitions — map gesture name → action
 */
const GESTURE_ACTIONS = {
  'OPEN PALM':    () => triggerActivation(),
  'CLOSED FIST':  () => { stopListening(); displayResponse('Z.A.R.A silenced. Standing by.'); speakResponse('Silenced.'); },
  'INDEX POINT':  () => toggleVoiceInput(),
  'PEACE SIGN':   () => { document.getElementById('commandInput')?.focus(); displayResponse('Command input focused. Type your query.'); },
  'THUMBS UP':    () => displayResponse('Confirmed. Command acknowledged.'),
  'THREE FINGERS':() => clearHistory(),
};

/**
 * Gesture item ID map for highlight
 */
const GESTURE_ITEM_IDS = {
  'OPEN PALM':    'gi-palm',
  'CLOSED FIST':  'gi-fist',
  'INDEX POINT':  'gi-point',
  'PEACE SIGN':   'gi-peace',
  'THUMBS UP':    'gi-thumb',
  'THREE FINGERS':'gi-three',
};

/* ── Open / Close camera panel ───────────────────────── */
function openGesturePanel() {
  const section = document.getElementById('gestureSection');
  if (!section) return;
  section.style.display = 'block';
  // Scroll to it
  setTimeout(() => section.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
  // Trigger reveal
  revealObserver.observe(section);
  setTimeout(() => section.classList.add('visible'), 100);

  startCameraGesture();
}

function closeGesturePanel() {
  stopCameraGesture();
  const section = document.getElementById('gestureSection');
  if (section) {
    section.classList.remove('visible');
    setTimeout(() => { section.style.display = 'none'; }, 400);
  }
  const btn = document.getElementById('gestureBtn');
  if (btn) btn.classList.remove('active');
}

/* ── Load MediaPipe Hands dynamically ────────────────── */
function loadMediaPipe() {
  return new Promise((resolve, reject) => {
    if (GESTURE.mpLoaded) { resolve(); return; }
    if (GESTURE.loadAttempted) { reject(new Error('Already attempted')); return; }
    GESTURE.loadAttempted = true;

    setBadge('LOADING...', '');

    // Load MediaPipe Hands from CDN
    const script1 = document.createElement('script');
    script1.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js';

    const script2 = document.createElement('script');
    script2.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js';

    let loaded = 0;
    const onLoad = () => {
      loaded++;
      if (loaded === 2) {
        GESTURE.mpLoaded = true;
        resolve();
      }
    };
    script1.onload = onLoad;
    script2.onload = onLoad;
    script1.onerror = script2.onerror = () => reject(new Error('CDN load failed'));

    document.head.appendChild(script1);
    document.head.appendChild(script2);
  });
}

/* ── Start camera + MediaPipe detection ─────────────── */
async function startCameraGesture() {
  GESTURE.active = true;
  setBadge('STARTING', '');

  try {
    // Request camera
    GESTURE.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });

    const video = document.getElementById('gestureVideo');
    if (!video) return;
    video.srcObject = GESTURE.stream;
    await video.play();

    setBadge('LOADING AI', '');

    // Try to load MediaPipe — fall back to manual if CDN fails
    try {
      await loadMediaPipe();
      initMediaPipeHands(video);
    } catch (e) {
      console.warn('[ZARA] MediaPipe CDN failed, using manual detection:', e.message);
      startManualDetection(video);
    }

  } catch (err) {
    setBadge('ERROR', 'error');
    const msg = err.name === 'NotAllowedError'
      ? 'CAMERA PERMISSION DENIED — Allow camera in browser settings'
      : `CAMERA ERROR: ${err.message}`;
    showError(msg);
    setDetectedLabel('CAMERA UNAVAILABLE');
  }
}

/* ── Initialize MediaPipe Hands ─────────────────────── */
function initMediaPipeHands(video) {
  if (typeof Hands === 'undefined') {
    startManualDetection(video);
    return;
  }

  const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });

  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.6,
  });

  hands.onResults((results) => {
    drawHandResults(results);
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmarks = results.multiHandLandmarks[0];
      const gesture = classifyGesture(landmarks);
      onGestureDetected(gesture, 0.85 + Math.random() * 0.13);
    } else {
      onGestureDetected(null, 0);
    }
  });

  GESTURE.hands = hands;
  setBadge('ACTIVE', 'active');
  setDetectedLabel('SCANNING HANDS...');

  // Run detection loop
  const canvas = document.getElementById('gestureCanvas');
  const ctx = canvas?.getContext('2d');

  async function detectionLoop() {
    if (!GESTURE.active) return;
    if (video.readyState >= 2) {
      await hands.send({ image: video });
    }
    GESTURE.rafId = requestAnimationFrame(detectionLoop);
  }
  detectionLoop();
}

/* ── Fallback manual detection (no MediaPipe) ────────── */
function startManualDetection(video) {
  setBadge('ACTIVE', 'active');
  setDetectedLabel('MOTION DETECTION MODE');

  const canvas = document.getElementById('gestureCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let prevFrame = null;
  let motionFrames = 0;

  function manualLoop() {
    if (!GESTURE.active) return;

    const w = video.videoWidth || 320;
    const h = video.videoHeight || 240;
    canvas.width = w;
    canvas.height = h;

    ctx.drawImage(video, 0, 0, w, h);
    const frame = ctx.getImageData(0, 0, w, h);

    if (prevFrame) {
      let diff = 0;
      for (let i = 0; i < frame.data.length; i += 16) {
        diff += Math.abs(frame.data[i] - prevFrame.data[i]);
      }
      const motion = diff / (frame.data.length / 16);
      const confidence = Math.min(motion / 30, 1);
      updateConfidence(confidence);

      if (motion > 20) {
        motionFrames++;
        if (motionFrames === 12) {
          // Detect gesture by simple motion pattern
          const gesture = motion > 60 ? 'OPEN PALM' : 'INDEX POINT';
          onGestureDetected(gesture, confidence);
        }
      } else {
        motionFrames = 0;
        if (confidence < 0.05) onGestureDetected(null, 0);
      }
    }
    prevFrame = frame;
    GESTURE.rafId = requestAnimationFrame(manualLoop);
  }
  manualLoop();
}

/* ── Draw hand skeleton on canvas ────────────────────── */
function drawHandResults(results) {
  const canvas = document.getElementById('gestureCanvas');
  const video  = document.getElementById('gestureVideo');
  if (!canvas || !video) return;

  canvas.width  = video.videoWidth  || 640;
  canvas.height = video.videoHeight || 480;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!results.multiHandLandmarks) return;

  // MediaPipe finger connections
  const CONNECTIONS = [
    [0,1],[1,2],[2,3],[3,4],        // Thumb
    [0,5],[5,6],[6,7],[7,8],        // Index
    [0,9],[9,10],[10,11],[11,12],   // Middle
    [0,13],[13,14],[14,15],[15,16], // Ring
    [0,17],[17,18],[18,19],[19,20], // Pinky
    [5,9],[9,13],[13,17],           // Palm
  ];

  results.multiHandLandmarks.forEach(landmarks => {
    const W = canvas.width, H = canvas.height;

    // Draw connections
    ctx.strokeStyle = 'rgba(0,212,255,0.45)';
    ctx.lineWidth = 1.5;
    CONNECTIONS.forEach(([a, b]) => {
      const lA = landmarks[a], lB = landmarks[b];
      ctx.beginPath();
      ctx.moveTo(lA.x * W, lA.y * H);
      ctx.lineTo(lB.x * W, lB.y * H);
      ctx.stroke();
    });

    // Draw landmark dots
    landmarks.forEach((lm, i) => {
      const isTip = [4, 8, 12, 16, 20].includes(i);
      ctx.beginPath();
      ctx.arc(lm.x * W, lm.y * H, isTip ? 5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = isTip ? 'rgba(124,106,255,0.9)' : 'rgba(0,212,255,0.8)';
      ctx.fill();
      // Glow
      ctx.beginPath();
      ctx.arc(lm.x * W, lm.y * H, isTip ? 9 : 6, 0, Math.PI * 2);
      ctx.fillStyle = isTip ? 'rgba(124,106,255,0.12)' : 'rgba(0,212,255,0.1)';
      ctx.fill();
    });
  });
}

/* ── Gesture Classification ──────────────────────────── */
/**
 * Classify hand gesture from 21 MediaPipe landmarks
 * Landmark indices: 0=wrist, 4=thumb tip, 8=index tip,
 * 12=middle tip, 16=ring tip, 20=pinky tip
 * MCP joints: 5,9,13,17 (knuckles)
 */
function classifyGesture(lm) {
  // Helper: is fingertip above its MCP (knuckle)?
  const isUp = (tip, mcp) => lm[tip].y < lm[mcp].y - 0.04;
  const isDown = (tip, mcp) => lm[tip].y > lm[mcp].y;

  const thumbUp  = lm[4].x < lm[3].x - 0.03; // thumb extends left (mirrored)
  const indexUp  = isUp(8, 5);
  const middleUp = isUp(12, 9);
  const ringUp   = isUp(16, 13);
  const pinkyUp  = isUp(20, 17);

  const extendedCount = [thumbUp, indexUp, middleUp, ringUp, pinkyUp].filter(Boolean).length;

  // OPEN PALM — all 5 fingers extended
  if (extendedCount >= 4 && indexUp && middleUp && ringUp && pinkyUp) return 'OPEN PALM';

  // CLOSED FIST — no fingers extended
  if (extendedCount === 0 || (extendedCount === 1 && thumbUp)) return 'CLOSED FIST';

  // THUMBS UP — only thumb extended, others curled
  if (thumbUp && !indexUp && !middleUp && !ringUp && !pinkyUp) return 'THUMBS UP';

  // INDEX POINT — only index finger up
  if (indexUp && !middleUp && !ringUp && !pinkyUp) return 'INDEX POINT';

  // PEACE / V SIGN — index + middle up, rest down
  if (indexUp && middleUp && !ringUp && !pinkyUp) return 'PEACE SIGN';

  // THREE FINGERS — index + middle + ring up
  if (indexUp && middleUp && ringUp && !pinkyUp) return 'THREE FINGERS';

  return null;
}

/* ── Handle detected gesture ────────────────────────── */
function onGestureDetected(gesture, confidence) {
  updateConfidence(confidence);

  if (!gesture) {
    // No hand detected — slowly dim label
    if (GESTURE.lastGesture) {
      GESTURE.lastGesture = null;
      setDetectedLabel('SCANNING HANDS...');
      highlightGestureItem(null);
    }
    return;
  }

  setDetectedLabel(gesture);
  highlightGestureItem(gesture);
  setBadge('DETECTED', 'detected');

  // Debounce — don't fire same gesture twice quickly
  const now = Date.now();
  if (gesture === GESTURE.lastGesture && now - GESTURE.lastGestureTime < GESTURE.cooldown) return;

  GESTURE.lastGesture = gesture;
  GESTURE.lastGestureTime = now;

  // Flash label
  const label = document.getElementById('detectedLabel');
  if (label) { label.classList.remove('flash'); void label.offsetWidth; label.classList.add('flash'); }

  // Execute the mapped action
  const action = GESTURE_ACTIONS[gesture];
  if (action) {
    setSystemStatus('processing', `GESTURE: ${gesture} — EXECUTING ACTION`);
    action();
    addToHistory(`[GESTURE] ${gesture}`, 'cmd');
    setTimeout(() => setBadge('ACTIVE', 'active'), 1200);
  }
}

/* ── UI Helpers ──────────────────────────────────────── */
function setBadge(text, cls) {
  const badge = document.getElementById('gestureBadge');
  if (!badge) return;
  badge.textContent = text;
  badge.className = 'gesture-status-badge' + (cls ? ` ${cls}` : '');
}

function setDetectedLabel(text) {
  const el = document.getElementById('detectedLabel');
  if (el) el.textContent = text || 'SCANNING HANDS...';
}

function updateConfidence(val) {
  const fill = document.getElementById('confidenceFill');
  const valEl = document.getElementById('confidenceVal');
  const pct = Math.round(val * 100);
  if (fill) fill.style.width = pct + '%';
  if (valEl) valEl.textContent = pct + '%';
}

function highlightGestureItem(gesture) {
  document.querySelectorAll('.gesture-item').forEach(el => el.classList.remove('active'));
  if (gesture && GESTURE_ITEM_IDS[gesture]) {
    const el = document.getElementById(GESTURE_ITEM_IDS[gesture]);
    if (el) el.classList.add('active');
  }
}

/* ── Stop camera ─────────────────────────────────────── */
function stopCameraGesture() {
  GESTURE.active = false;
  cancelAnimationFrame(GESTURE.rafId);
  if (GESTURE.stream) {
    GESTURE.stream.getTracks().forEach(t => t.stop());
    GESTURE.stream = null;
  }
  if (GESTURE.hands) {
    try { GESTURE.hands.close(); } catch (e) { /* ignore */ }
    GESTURE.hands = null;
  }
  const video = document.getElementById('gestureVideo');
  if (video) { video.srcObject = null; }
  setBadge('OFFLINE', '');
}

/**
 * Trigger cinematic activation animation
 * (called by gesture or button)
 */
function triggerActivation() {
  const overlay = document.getElementById('activationOverlay');
  if (!overlay || STATE.isActivated) return;
  STATE.isActivated = true;

  overlay.classList.add('active');
  setSystemStatus('processing', 'GESTURE DETECTED — ACTIVATING NEURAL MATRIX');

  setTimeout(() => {
    overlay.classList.remove('active');
    STATE.isActivated = false;
    setSystemStatus('online', 'ACTIVATION COMPLETE — READY FOR COMMAND');
    displayResponse('Z.A.R.A activated. Neural matrix online. All systems at full capacity. How may I serve you?');
    speakResponse('Z.A.R.A activated. How may I serve you?');
  }, 2800);
}

/* ════════════════════════════════════════════════════════
   MODAL SYSTEM
════════════════════════════════════════════════════════ */

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('open');
}
function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('open');
}

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

/* ════════════════════════════════════════════════════════
   EVENT LISTENERS
════════════════════════════════════════════════════════ */

// Command input — Enter key
const cmdInput = document.getElementById('commandInput');
if (cmdInput) {
  cmdInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      processCommand(cmdInput.value);
      cmdInput.value = '';
    }
  });
}

// Execute button
const execBtn = document.getElementById('execBtn');
if (execBtn) {
  execBtn.addEventListener('click', () => {
    processCommand(cmdInput.value);
    cmdInput.value = '';
  });
}

// Mic button
const micBtn = document.getElementById('micBtn');
if (micBtn) micBtn.addEventListener('click', toggleVoiceInput);

// Gesture / Camera button
const gestureBtn = document.getElementById('gestureBtn');
if (gestureBtn) {
  gestureBtn.addEventListener('click', () => {
    if (GESTURE.active) {
      closeGesturePanel();
      gestureBtn.classList.remove('active');
    } else {
      gestureBtn.classList.add('active');
      openGesturePanel();
    }
  });
}

// Close gesture panel button
const closeGestureBtn = document.getElementById('closeGestureBtn');
if (closeGestureBtn) closeGestureBtn.addEventListener('click', closeGesturePanel);

// Clear history
const clearBtn = document.getElementById('clearHistoryBtn');
if (clearBtn) clearBtn.addEventListener('click', clearHistory);

// Settings button
const settingsBtn = document.getElementById('settingsBtn');
if (settingsBtn) settingsBtn.addEventListener('click', () => openModal('settingsModal'));
const modalClose = document.getElementById('modalClose');
if (modalClose) modalClose.addEventListener('click', () => closeModal('settingsModal'));

// Save settings
const saveSettings = document.getElementById('saveSettings');
if (saveSettings) {
  saveSettings.addEventListener('click', () => {
    const url = document.getElementById('backendUrl').value.trim();
    if (url) { CONFIG.backendUrl = url; localStorage.setItem('zara_backend_url', url); }
    CONFIG.voiceEnabled = document.getElementById('voiceToggle').checked;
    CONFIG.gestureEnabled = document.getElementById('gestureToggle').checked;
    CONFIG.particlesEnabled = document.getElementById('particleToggle').checked;
    localStorage.setItem('zara_voice', CONFIG.voiceEnabled);
    localStorage.setItem('zara_gesture', CONFIG.gestureEnabled);
    localStorage.setItem('zara_particles', CONFIG.particlesEnabled);
    closeModal('settingsModal');
    displayResponse('Configuration saved. System parameters updated.');
  });
}

// Note modal
const noteModalClose = document.getElementById('noteModalClose');
if (noteModalClose) noteModalClose.addEventListener('click', () => closeModal('noteModal'));
const saveNote = document.getElementById('saveNote');
if (saveNote) {
  saveNote.addEventListener('click', () => {
    const content = document.getElementById('noteInput').value.trim();
    if (!content) { showError('NOTE CONTENT EMPTY'); return; }
    saveMemory('note', content);
    document.getElementById('noteInput').value = '';
    closeModal('noteModal');
  });
}

// Alarm modal
const alarmModalClose = document.getElementById('alarmModalClose');
if (alarmModalClose) alarmModalClose.addEventListener('click', () => closeModal('alarmModal'));
const saveAlarmBtn = document.getElementById('saveAlarm');
if (saveAlarmBtn) {
  saveAlarmBtn.addEventListener('click', () => {
    const time = document.getElementById('alarmTime').value;
    const label = document.getElementById('alarmLabel').value.trim();
    saveAlarmData(time, label);
    document.getElementById('alarmTime').value = '';
    document.getElementById('alarmLabel').value = '';
    closeModal('alarmModal');
  });
}

// Feature buttons
document.querySelectorAll('.feature-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const action = btn.dataset.action;
    switch (action) {
      case 'call': displayResponse('Call module initiated. Specify contact name to proceed.'); break;
      case 'alarm': openModal('alarmModal'); break;
      case 'note': openModal('noteModal'); break;
      case 'search':
        const q = cmdInput.value.trim() || prompt('Search query:');
        if (q) { window.open(`https://google.com/search?q=${encodeURIComponent(q)}`, '_blank'); displayResponse(`Web search initiated: "${q}"`); }
        break;
      case 'apps': displayResponse('App launcher module active. Specify application name.'); break;
      case 'music': displayResponse('Music control module active. Backend integration required for playback.'); break;
    }
    addToHistory(`[QUICK ACTION] ${action.toUpperCase()}`, 'cmd');
  });
});

// Re-apply magnetic effect to dynamically relevant buttons
document.querySelectorAll('.magnetic-btn').forEach(btn => {
  btn.addEventListener('mousemove', e => {
    const r = btn.getBoundingClientRect();
    const x = e.clientX - r.left - r.width / 2;
    const y = e.clientY - r.top - r.height / 2;
    btn.style.transform = `translate(${x * 0.2}px,${y * 0.25}px)`;
  });
  btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
});

/* ════════════════════════════════════════════════════════
   KEYBOARD SHORTCUTS
════════════════════════════════════════════════════════ */
document.addEventListener('keydown', e => {
  // Ctrl+Space — activate voice
  if (e.ctrlKey && e.code === 'Space') { e.preventDefault(); toggleVoiceInput(); }
  // Escape — close modals, stop listening
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    if (STATE.isListening) stopListening();
  }
  // Ctrl+K — focus command input
  if (e.ctrlKey && e.key === 'k') { e.preventDefault(); cmdInput && cmdInput.focus(); }
});

/* ════════════════════════════════════════════════════════
   SETTINGS INIT — Load saved values
════════════════════════════════════════════════════════ */
(function loadSettings() {
  const urlEl = document.getElementById('backendUrl');
  if (urlEl) urlEl.value = CONFIG.backendUrl;
  const voiceEl = document.getElementById('voiceToggle');
  if (voiceEl) voiceEl.checked = CONFIG.voiceEnabled;
  const gestureEl = document.getElementById('gestureToggle');
  if (gestureEl) gestureEl.checked = CONFIG.gestureEnabled;
  const particleEl = document.getElementById('particleToggle');
  if (particleEl) particleEl.checked = CONFIG.particlesEnabled;
})();

/* ════════════════════════════════════════════════════════
   INIT — Render persisted data
════════════════════════════════════════════════════════ */
renderHistory();
renderMemories();

/* ── UTILITY ─────────────────────────────────────────── */
function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
