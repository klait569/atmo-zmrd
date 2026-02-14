// Atmo-ZMRD - Audio-reactive geometric visualizer
// Main entry point - orchestrates UI, audio processing, and rendering

import { audioState, updateAudio } from './audio.js';
import { getColorScheme } from './colorSchemes.js';
import { state, switchMode, atmosphereToMode } from './state.js';
import { inferAtmosphereStable } from './atmosphere.js';
import { 
  canvas, 
  ctx, 
  layerA, 
  layerB, 
  layerCtxA, 
  layerCtxB,
  modeSelect,
  updateAudioUI,
  autoEnableMic,
  isAutoAtmosphere
} from './ui.js';
import { 
  renderers, 
  renderBackground, 
  updateFloatingShapes 
} from './rendering.js';

// Animation loop
let lastTime = performance.now();

function frame(now) {
  const dt = Math.min(0.08, (now - lastTime) / 1000);
  lastTime = now;
  const t = now / 1000;

  // Update audio analysis
  updateAudio();
  const atmosphere = inferAtmosphereStable(audioState);
  
  // Update UI labels and bars
  updateAudioUI(audioState, atmosphere);

  // Auto-switch mode based on atmosphere detection
  if (isAutoAtmosphere() && now - state.lastSwitchAt > 2800) {
    const desiredMode = atmosphereToMode[atmosphere] || 'orbit';
    if (desiredMode !== state.currentMode && desiredMode !== state.nextMode) {
      switchMode(desiredMode);
      modeSelect.value = desiredMode;
      state.lastSwitchAt = now;
    }
  }

  const width = canvas.width;
  const height = canvas.height;

  // Update floating shapes for orbit and pulse modes
  if (state.currentMode === 'orbit' || state.currentMode === 'pulse') {
    updateFloatingShapes(dt, width, height, t, audioState.energy, state.currentMode);
  }
  if (state.nextMode === 'orbit' || state.nextMode === 'pulse') {
    updateFloatingShapes(dt, width, height, t, audioState.energy, state.nextMode);
  }

  // Clear layer canvases
  layerCtxA.clearRect(0, 0, width, height);
  layerCtxB.clearRect(0, 0, width, height);

  // Render current mode
  renderers[state.currentMode](layerCtxA, width, height, t, audioState.energy);

  // Render next mode if transitioning
  if (state.nextMode) {
    renderers[state.nextMode](layerCtxB, width, height, t, audioState.energy);
    state.transitionProgress += dt / state.transitionDuration;
  }

  // Render background
  renderBackground(ctx, width, height, t, atmosphere, audioState.energy, getColorScheme);

  // Composite layers with transition
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

// Start animation loop
requestAnimationFrame(frame);

// Auto-enable microphone on page load
autoEnableMic();
