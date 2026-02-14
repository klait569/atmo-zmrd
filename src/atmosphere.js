// Atmosphere classification
const atmosphereHistory = [];
const historySize = 22;

export function classifyAtmosphereFrame(audioState) {
  if (!audioState.enabled) return 'ambient';
  if (audioState.rms < 0.045) return 'quiet';
  if (audioState.bass > 0.25 || audioState.energy > 0.34) return 'energetic';
  if (audioState.treble > 0.2 && audioState.centroid > 0.53) return 'bright';
  return 'calm';
}

export function inferAtmosphereStable(audioState) {
  const label = classifyAtmosphereFrame(audioState);
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
