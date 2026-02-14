const app = document.getElementById('app');

const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
app.appendChild(canvas);

const hud = document.createElement('div');
hud.className = 'hud';

const micBtn = document.createElement('button');
micBtn.textContent = 'Enable microphone';

const autoBtn = document.createElement('button');
autoBtn.textContent = 'Auto atmosphere: ON';

const modeSelect = document.createElement('select');
['orbit', 'particles', 'lattice', 'pulse'].forEach((id) => {
  const option = document.createElement('option');
  option.value = id;
  option.textContent = `Mode: ${id}`;
  modeSelect.appendChild(option);
});

const transitionSelect = document.createElement('select');
[
  ['1.0', 'Transition: fast'],
  ['1.8', 'Transition: normal'],
  ['2.8', 'Transition: slow'],
].forEach(([value, label]) => {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  if (value === '1.8') option.selected = true;
  transitionSelect.appendChild(option);
});

const atmosphereLabel = document.createElement('span');
atmosphereLabel.className = 'label';
atmosphereLabel.textContent = 'Atmosphere: unknown';

const audioLabel = document.createElement('span');
audioLabel.className = 'label';
audioLabel.textContent = 'Energy: 0.00';

const rightPanel = document.createElement('div');
rightPanel.className = 'hud-right';

const levels = document.createElement('div');
levels.className = 'levels';

const bassBar = document.createElement('span');
bassBar.className = 'level level-bass';

const midBar = document.createElement('span');
midBar.className = 'level level-mid';

const trebleBar = document.createElement('span');
trebleBar.className = 'level level-treble';

levels.append(bassBar, midBar, trebleBar);

const bpmLabel = document.createElement('span');
bpmLabel.className = 'label bpm';
bpmLabel.textContent = 'BPM: --';

rightPanel.append(levels, bpmLabel);

hud.append(micBtn, autoBtn, modeSelect, transitionSelect, atmosphereLabel, audioLabel, rightPanel);
app.appendChild(hud);

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
}
window.addEventListener('resize', resize);
resize();

const layerA = document.createElement('canvas');
const layerB = document.createElement('canvas');
const layerCtxA = layerA.getContext('2d');
const layerCtxB = layerB.getContext('2d');

function resizeLayers() {
  [layerA, layerB].forEach((layer) => {
    layer.width = canvas.width;
    layer.height = canvas.height;
  });
}
window.addEventListener('resize', resizeLayers);
resizeLayers();

const audioState = {
  enabled: false,
  rms: 0,
  bass: 0,
  mid: 0,
  treble: 0,
  centroid: 0,
  energy: 0,
  bpm: 0,
  beatPulse: 0,
  prevBass: 0,  // Track previous bass for spike detection
};

const beatTimes = [];
let lastBeatAt = 0;

let analyzer;
let dataArray;
let timeDomainArray;
let audioContext;
let micStream;

async function enableMic() {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,  // Disable to get raw audio
      noiseSuppression: false,  // Disable to prevent filtering out all sound
      autoGainControl: true,
    },
  });

  micStream = stream;
  
  // Check stream status
  const audioTracks = stream.getAudioTracks();
  console.log('[Audio] Stream info:', {
    active: stream.active,
    trackCount: audioTracks.length,
    trackLabel: audioTracks[0]?.label,
    trackEnabled: audioTracks[0]?.enabled,
    trackMuted: audioTracks[0]?.muted,
    trackReadyState: audioTracks[0]?.readyState,
    settings: audioTracks[0]?.getSettings()
  });

  audioContext = new AudioContext();
  
  // Resume audio context if suspended (browser autoplay policy)
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
    console.log('[Audio] AudioContext was suspended, now resumed');
  }
  
  const source = audioContext.createMediaStreamSource(stream);
  analyzer = audioContext.createAnalyser();
  analyzer.fftSize = 2048;
  analyzer.smoothingTimeConstant = 0.0;  // Disable smoothing for immediate response
  analyzer.minDecibels = -90;
  analyzer.maxDecibels = -10;
  source.connect(analyzer);
  
  // Also try connecting to destination to ensure audio is flowing
  // (Note: This won't play audio, just ensures the graph is active)
  const gainNode = audioContext.createGain();
  gainNode.gain.value = 0; // Silent
  source.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  dataArray = new Uint8Array(analyzer.frequencyBinCount);
  timeDomainArray = new Uint8Array(analyzer.fftSize);

  audioState.enabled = true;
  micBtn.textContent = 'Microphone: ON';
  console.log('[Audio] Microphone enabled successfully. Context state:', audioContext.state, 'Sample rate:', audioContext.sampleRate);
  
  // Test read to verify audio is working
  setTimeout(() => {
    analyzer.getByteFrequencyData(dataArray);
    analyzer.getByteTimeDomainData(timeDomainArray);
    
    const freqSum = dataArray.reduce((a, b) => a + b, 0);
    const freqMax = Math.max(...dataArray);
    
    // Time domain data should show variation even in silence (128 ± some variation)
    const timeMin = Math.min(...timeDomainArray);
    const timeMax = Math.max(...timeDomainArray);
    const timeVariation = timeMax - timeMin;
    
    console.log('[Audio] Test read after 500ms:');
    console.log('  Frequency - Sum:', freqSum, 'Max:', freqMax);
    console.log('  Time domain - Min:', timeMin, 'Max:', timeMax, 'Variation:', timeVariation);
    console.log('  Stream active:', micStream.active, 'Track enabled:', audioTracks[0]?.enabled);
    
    if (freqSum === 0 && timeVariation < 2) {
      console.error('[Audio] ❌ NO AUDIO DETECTED!');
      console.warn('[Audio] Possible issues:');
      console.warn('  1. Wrong microphone selected (check browser settings)');
      console.warn('  2. Microphone is hardware muted');
      console.warn('  3. System audio permissions issue');
      console.warn('  4. Try a different browser (Chrome/Edge recommended)');
      console.warn('  5. Check Windows Sound settings > Input devices');
    } else {
      console.log('[Audio] ✅ Audio signal detected!');
    }
  }, 500);
}

micBtn.addEventListener('click', async () => {
  if (audioState.enabled) return;
  try {
    console.log('[Audio] Requesting microphone access...');
    
    // List available audio input devices
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(d => d.kind === 'audioinput');
      console.log('[Audio] Available microphones:', audioInputs.map(d => ({
        label: d.label || 'Unknown',
        id: d.deviceId
      })));
    } catch (e) {
      console.warn('[Audio] Could not enumerate devices:', e);
    }
    
    await enableMic();
  } catch (err) {
    console.error('[Audio] Microphone access denied:', err);
    micBtn.textContent = 'Mic denied';
  }
});

function updateAudio() {
  if (!audioState.enabled || !analyzer) {
    audioState.rms *= 0.96;
    audioState.bass *= 0.95;
    audioState.mid *= 0.95;
    audioState.treble *= 0.95;
    audioState.energy *= 0.94;
    audioState.beatPulse *= 0.93;
    audioState.bpm *= 0.97;
    audioState.prevBass *= 0.95;
    return;
  }

  analyzer.getByteFrequencyData(dataArray);
  
  // Also get time domain data for debugging
  analyzer.getByteTimeDomainData(timeDomainArray);

  let sumSquares = 0;
  let weighted = 0;
  let total = 0;
  let bass = 0;
  let mid = 0;
  let treble = 0;

  const len = dataArray.length;
  const bassEnd = Math.floor(len * 0.08);
  const midEnd = Math.floor(len * 0.32);

  // Log first few frequency values to verify audio data
  if (Math.random() < 0.05) { // Log occasionally to avoid spam
    const maxVal = Math.max(...dataArray);
    const avgVal = dataArray.reduce((a, b) => a + b, 0) / len;
    const timeMin = Math.min(...timeDomainArray);
    const timeMax = Math.max(...timeDomainArray);
    console.log('[Audio] Sample data - Freq Max:', maxVal, 'Avg:', avgVal.toFixed(2), '| Time domain:', timeMin, '-', timeMax, '| Stream active:', micStream?.active);
  }

  for (let i = 0; i < len; i += 1) {
    const v = dataArray[i] / 255;
    sumSquares += v * v;
    weighted += v * i;
    total += v;
    if (i <= bassEnd) bass += v;
    else if (i <= midEnd) mid += v;
    else treble += v;
  }

  const rmsRaw = Math.sqrt(sumSquares / len);
  const bassRaw = bass / Math.max(1, bassEnd + 1);
  const midRaw = mid / Math.max(1, midEnd - bassEnd);
  const trebleRaw = treble / Math.max(1, len - midEnd - 1);
  const centroidRaw = total > 0 ? weighted / total / len : 0;

  // Exponential smoothing for less jitter.
  const blend = 0.22;
  audioState.rms = audioState.rms * (1 - blend) + rmsRaw * blend;
  audioState.bass = audioState.bass * (1 - blend) + bassRaw * blend;
  audioState.mid = audioState.mid * (1 - blend) + midRaw * blend;
  audioState.treble = audioState.treble * (1 - blend) + trebleRaw * blend;
  audioState.centroid = audioState.centroid * (1 - blend) + centroidRaw * blend;

  const energyRaw = Math.min(1, audioState.rms * 1.5 + audioState.bass * 0.65 + audioState.treble * 0.25);
  audioState.energy = audioState.energy * 0.85 + energyRaw * 0.15;

  // Log audio levels occasionally (5% of frames) to avoid console spam
  if (Math.random() < 0.05) {
    console.log('[Audio] Levels - Bass:', audioState.bass.toFixed(3), 'Mid:', audioState.mid.toFixed(3), 'Treble:', audioState.treble.toFixed(3), 'Energy:', audioState.energy.toFixed(3));
  }

  const now = performance.now();
  
  // Improved beat detection: check for bass spike (increase) and absolute threshold
  const bassIncrease = audioState.bass - audioState.prevBass;
  const beatThreshold = 0.15 + audioState.energy * 0.15;  // Lowered from 0.23 + 0.3
  const spikeThreshold = 0.02;  // Bass must increase by at least this much
  
  const isBeat = (
    audioState.bass > beatThreshold &&  // Absolute threshold
    bassIncrease > spikeThreshold &&     // Spike detection
    audioState.rms > 0.03 &&             // Lowered RMS from 0.06
    now - lastBeatAt > 220               // Debounce (min 220ms between beats)
  );
  
  // Log beat detection status occasionally
  if (Math.random() < 0.02) {
    console.log('[Audio] Beat check - Bass:', audioState.bass.toFixed(3), 'Spike:', bassIncrease.toFixed(3), 
                'Threshold:', beatThreshold.toFixed(3), 'Would trigger:', isBeat);
  }

  if (isBeat) {
    console.log('[Audio] 🎵 Beat detected! Bass:', audioState.bass.toFixed(3), 'Spike:', bassIncrease.toFixed(3), 'RMS:', audioState.rms.toFixed(3));
    lastBeatAt = now;
    beatTimes.push(now);
    while (beatTimes.length > 0 && now - beatTimes[0] > 12000) beatTimes.shift();

    if (beatTimes.length > 3) {
      const span = beatTimes[beatTimes.length - 1] - beatTimes[0];
      const avgInterval = span / (beatTimes.length - 1);
      const instantBpm = avgInterval > 0 ? 60000 / avgInterval : 0;
      const clamped = Math.min(220, Math.max(40, instantBpm));
      audioState.bpm = audioState.bpm * 0.82 + clamped * 0.18;
      console.log('[Audio] BPM updated:', Math.round(audioState.bpm), 'from', beatTimes.length, 'beats');
    }

    audioState.beatPulse = 1;
  } else {
    audioState.beatPulse *= 0.92;
  }
  
  // Update previous bass for next frame's spike detection
  audioState.prevBass = audioState.bass;
}

const atmosphereHistory = [];
const historySize = 22;

function classifyAtmosphereFrame() {
  if (!audioState.enabled) return 'ambient';
  if (audioState.rms < 0.045) return 'quiet';
  if (audioState.bass > 0.25 || audioState.energy > 0.34) return 'energetic';
  if (audioState.treble > 0.2 && audioState.centroid > 0.53) return 'bright';
  return 'calm';
}

function inferAtmosphereStable() {
  const label = classifyAtmosphereFrame();
  atmosphereHistory.push(label);
  if (atmosphereHistory.length > historySize) atmosphereHistory.shift();

  const tally = atmosphereHistory.reduce((acc, item) => {
    acc[item] = (acc[item] || 0) + 1;
    return acc;
  }, {});

  let best = label;
  let bestCount = 0;
  for (const [key, count] of Object.entries(tally)) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }

  return best;
}

const atmosphereToMode = {
  ambient: 'orbit',
  quiet: 'lattice',
  calm: 'orbit',
  bright: 'pulse',
  energetic: 'particles',
};

let autoAtmosphere = true;
autoBtn.addEventListener('click', () => {
  autoAtmosphere = !autoAtmosphere;
  autoBtn.textContent = `Auto atmosphere: ${autoAtmosphere ? 'ON' : 'OFF'}`;
});

const state = {
  currentMode: 'orbit',
  nextMode: null,
  transitionProgress: 0,
  transitionDuration: 1.8,
  lastSwitchAt: 0,
};

transitionSelect.addEventListener('change', () => {
  state.transitionDuration = Number(transitionSelect.value);
});

modeSelect.addEventListener('change', () => {
  switchMode(modeSelect.value);
});

function switchMode(mode) {
  if (mode === state.currentMode || mode === state.nextMode) return;
  state.nextMode = mode;
  state.transitionProgress = 0;
}

function renderBackground(width, height, t, atmosphere, energy) {
  const hueShift = {
    ambient: 220,
    quiet: 195,
    calm: 230,
    bright: 285,
    energetic: 335,
  }[atmosphere] || 220;

  const gradient = ctx.createRadialGradient(width * 0.5, height * 0.52, 40, width * 0.5, height * 0.5, width * 0.72);
  gradient.addColorStop(0, `hsl(${hueShift + Math.sin(t * 0.2) * 22} 90% ${13 + energy * 14}%)`);
  gradient.addColorStop(1, 'hsl(230 45% 4%)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function renderOrbit(target, width, height, t, energy) {
  target.save();
  target.translate(width / 2, height / 2);
  target.strokeStyle = `hsla(${200 + energy * 160}, 100%, 72%, 0.58)`;
  target.lineWidth = 1 + energy * 2.2;
  const rings = 22;
  for (let r = 1; r <= rings; r += 1) {
    target.beginPath();
    const radius = (Math.min(width, height) * 0.015) * r + Math.sin(t * 0.6 + r * 0.7) * 10 * (0.15 + energy);
    target.ellipse(0, 0, radius, radius * (0.58 + Math.sin(t * 1.1 + r) * 0.14), t * 0.18 + r * 0.07, 0, Math.PI * 2);
    target.stroke();
  }
  target.restore();
}

function renderParticles(target, width, height, t, energy) {
  const count = 220;
  for (let i = 0; i < count; i += 1) {
    const p = i / count;
    const angle = p * Math.PI * 2 + t * (0.25 + energy * 1.2);
    const radius = (0.2 + p * 0.72 + Math.sin(i * 0.7 + t) * 0.04) * Math.min(width, height) * 0.8;
    const x = width / 2 + Math.cos(angle * (1 + energy)) * radius;
    const y = height / 2 + Math.sin(angle * (1.4 + energy * 0.8)) * radius * 0.7;
    const size = 0.8 + (2.8 + energy * 2.2) * (0.5 + Math.sin(i + t * 2.4) * 0.5);

    target.fillStyle = `hsla(${250 + p * 130 + energy * 90}, 100%, 72%, ${0.16 + p * 0.55})`;
    target.beginPath();
    target.arc(x, y, size, 0, Math.PI * 2);
    target.fill();
  }
}

function renderLattice(target, width, height, t, energy) {
  const spacing = Math.max(20, 78 - energy * 42);
  const amp = 8 + energy * 42;
  target.strokeStyle = `hsla(${175 + energy * 100}, 100%, 79%, 0.36)`;
  target.lineWidth = 1.15;
  for (let y = 0; y <= height + spacing; y += spacing) {
    target.beginPath();
    for (let x = 0; x <= width; x += 7) {
      const wave = Math.sin((x / width) * 11 + t * 1.7 + y * 0.017) * amp;
      const drift = Math.cos(t * 0.8 + y * 0.008) * (4 + energy * 14);
      const yy = y + wave + drift;
      if (x === 0) target.moveTo(x, yy);
      else target.lineTo(x, yy);
    }
    target.stroke();
  }
}

function renderPulse(target, width, height, t, energy) {
  target.save();
  target.translate(width / 2, height / 2);
  const layers = 14;
  for (let i = 0; i < layers; i += 1) {
    const p = i / layers;
    const radius = Math.min(width, height) * (0.08 + p * 0.46 + energy * 0.06);
    const spikes = 5 + i;

    target.beginPath();
    for (let a = 0; a <= Math.PI * 2 + 0.001; a += Math.PI / 60) {
      const spike = 1 + Math.sin(a * spikes + t * (1.5 + p * 1.1)) * (0.08 + energy * 0.2);
      const rr = radius * spike;
      const x = Math.cos(a) * rr;
      const y = Math.sin(a) * rr;
      if (a === 0) target.moveTo(x, y);
      else target.lineTo(x, y);
    }
    target.closePath();
    target.strokeStyle = `hsla(${290 + p * 90 + energy * 40}, 100%, 76%, ${0.12 + p * 0.45})`;
    target.lineWidth = 1 + p * 1.8;
    target.stroke();
  }
  target.restore();
}

const renderers = {
  orbit: renderOrbit,
  particles: renderParticles,
  lattice: renderLattice,
  pulse: renderPulse,
};

let lastTime = performance.now();

function frame(now) {
  const dt = Math.min(0.08, (now - lastTime) / 1000);
  lastTime = now;
  const t = now / 1000;

  updateAudio();
  const atmosphere = inferAtmosphereStable();
  atmosphereLabel.textContent = `Atmosphere: ${atmosphere}`;
  audioLabel.textContent = `Energy: ${audioState.energy.toFixed(2)}`;

  bassBar.style.setProperty('--level', audioState.bass.toFixed(3));
  midBar.style.setProperty('--level', audioState.mid.toFixed(3));
  trebleBar.style.setProperty('--level', audioState.treble.toFixed(3));
  bpmLabel.textContent = audioState.bpm > 0 ? `BPM: ${Math.round(audioState.bpm)}` : 'BPM: --';

  if (autoAtmosphere && now - state.lastSwitchAt > 2800) {
    const desiredMode = atmosphereToMode[atmosphere] || 'orbit';
    if (desiredMode !== state.currentMode && desiredMode !== state.nextMode) {
      switchMode(desiredMode);
      modeSelect.value = desiredMode;
      state.lastSwitchAt = now;
    }
  }

  const width = canvas.width;
  const height = canvas.height;

  layerCtxA.clearRect(0, 0, width, height);
  layerCtxB.clearRect(0, 0, width, height);

  renderers[state.currentMode](layerCtxA, width, height, t, audioState.energy);

  if (state.nextMode) {
    renderers[state.nextMode](layerCtxB, width, height, t, audioState.energy);
    state.transitionProgress += dt / state.transitionDuration;
  }

  renderBackground(width, height, t, atmosphere, audioState.energy);

  if (state.nextMode) {
    const progress = Math.min(1, state.transitionProgress);
    const eased = progress * progress * (3 - 2 * progress);

    ctx.globalAlpha = 1;
    ctx.drawImage(layerA, 0, 0);
    ctx.globalAlpha = eased;
    ctx.drawImage(layerB, 0, 0);
    ctx.globalAlpha = 1;

    if (progress >= 1) {
      state.currentMode = state.nextMode;
      state.nextMode = null;
      state.transitionProgress = 0;
    }
  } else {
    ctx.drawImage(layerA, 0, 0);
  }

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
