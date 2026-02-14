// Application state
export const state = {
  currentMode: 'orbit',
  nextMode: null,
  transitionProgress: 0,
  transitionDuration: 1.8,
  lastSwitchAt: 0,
};

export let autoAtmosphere = true;

export function setAutoAtmosphere(value) {
  autoAtmosphere = value;
}

export function switchMode(mode) {
  if (mode === state.currentMode || mode === state.nextMode) return;
  state.nextMode = mode;
  state.transitionProgress = 0;
}

export const atmosphereToMode = {
  ambient: 'orbit',
  quiet: 'lattice',
  calm: 'orbit',
  bright: 'pulse',
  energetic: 'particles',
};
