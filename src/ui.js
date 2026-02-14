// UI module
// Handles DOM element creation, event listeners, and UI updates

import { enableMic } from './audio.js';
import { setColorScheme } from './colorSchemes.js';
import { state, switchMode } from './state.js';

// Get app container
const app = document.getElementById('app');

// Create main canvas
export const canvas = document.createElement('canvas');
export const ctx = canvas.getContext('2d');
app.appendChild(canvas);

// Create HUD container
const hud = document.createElement('div');
hud.className = 'hud';

// Create buttons
export const micBtn = document.createElement('button');
micBtn.textContent = 'Enable microphone';

export const autoBtn = document.createElement('button');
autoBtn.textContent = 'Auto atmosphere: ON';

// Create mode selector
export const modeSelect = document.createElement('select');
['orbit', 'particles', 'lattice', 'pulse'].forEach((id) => {
  const option = document.createElement('option');
  option.value = id;
  option.textContent = `Mode: ${id}`;
  modeSelect.appendChild(option);
});

// Create transition speed selector
export const transitionSelect = document.createElement('select');
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

// Create color scheme selector
export const colorSchemeSelect = document.createElement('select');
[
  ['default', 'Colors: default'],
  ['hot', 'Colors: hot'],
  ['cold', 'Colors: cold'],
  ['gray', 'Colors: gray'],
  ['random', 'Colors: random'],
].forEach(([value, label]) => {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  colorSchemeSelect.appendChild(option);
});

// Create labels
export const atmosphereLabel = document.createElement('span');
atmosphereLabel.className = 'label';
atmosphereLabel.textContent = 'Atmosphere: unknown';

export const audioLabel = document.createElement('span');
audioLabel.className = 'label';
audioLabel.textContent = 'Energy: 0.00';

// Create audio level bars
const rightPanel = document.createElement('div');
rightPanel.className = 'hud-right';

const levels = document.createElement('div');
levels.className = 'levels';

export const bassBar = document.createElement('span');
bassBar.className = 'level level-bass';

export const midBar = document.createElement('span');
midBar.className = 'level level-mid';

export const trebleBar = document.createElement('span');
trebleBar.className = 'level level-treble';

levels.append(bassBar, midBar, trebleBar);

export const bpmLabel = document.createElement('span');
bpmLabel.className = 'label bpm';
bpmLabel.textContent = 'BPM: --';

rightPanel.append(levels, bpmLabel);

// Append all elements to HUD
hud.append(micBtn, autoBtn, modeSelect, transitionSelect, colorSchemeSelect, atmosphereLabel, audioLabel, rightPanel);
app.appendChild(hud);

// Auto-atmosphere state
let autoAtmosphere = true;

export function isAutoAtmosphere() {
  return autoAtmosphere;
}

// Set up event listeners
micBtn.addEventListener('click', async () => {
  if (micBtn.textContent.includes('ON')) return;
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
    micBtn.textContent = 'Microphone: ON';
  } catch (err) {
    console.error('[Audio] Microphone access denied:', err);
    micBtn.textContent = 'Mic denied';
  }
});

autoBtn.addEventListener('click', () => {
  autoAtmosphere = !autoAtmosphere;
  autoBtn.textContent = `Auto atmosphere: ${autoAtmosphere ? 'ON' : 'OFF'}`;
});

modeSelect.addEventListener('change', () => {
  switchMode(modeSelect.value);
});

transitionSelect.addEventListener('change', () => {
  state.transitionDuration = Number(transitionSelect.value);
});

colorSchemeSelect.addEventListener('change', () => {
  setColorScheme(colorSchemeSelect.value);
});

// Canvas sizing
function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
}
window.addEventListener('resize', resize);
resize();

// Layer canvases for transitions
export const layerA = document.createElement('canvas');
export const layerB = document.createElement('canvas');
export const layerCtxA = layerA.getContext('2d');
export const layerCtxB = layerB.getContext('2d');

function resizeLayers() {
  [layerA, layerB].forEach((layer) => {
    layer.width = canvas.width;
    layer.height = canvas.height;
  });
}
window.addEventListener('resize', resizeLayers);
resizeLayers();

// Update UI with audio state
export function updateAudioUI(audioState, atmosphere) {
  atmosphereLabel.textContent = `Atmosphere: ${atmosphere}`;
  audioLabel.textContent = `Energy: ${audioState.energy.toFixed(2)}`;

  bassBar.style.setProperty('--level', audioState.bass.toFixed(3));
  midBar.style.setProperty('--level', audioState.mid.toFixed(3));
  trebleBar.style.setProperty('--level', audioState.treble.toFixed(3));
  bpmLabel.textContent = audioState.bpm > 0 ? `BPM: ${Math.round(audioState.bpm)}` : 'BPM: --';
}

// Auto-enable microphone on page load
export async function autoEnableMic() {
  try {
    console.log('[Audio] Auto-enabling microphone on page load...');
    
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
    micBtn.textContent = 'Microphone: ON';
  } catch (err) {
    console.log('[Audio] Auto-enable failed (user interaction may be required):', err.message);
    micBtn.textContent = 'Enable microphone';
  }
}
