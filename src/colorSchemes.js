// Color scheme definitions
export const colorSchemes = {
  default: {
    orbit: { base: 200, range: 160 },
    particles: { base: 250, range: 130 },
    lattice: { base: 175, range: 100 },
    pulse: { base: 290, range: 90 },
    background: { base: 220, variations: [220, 195, 230, 285, 335] }
  },
  hot: {
    orbit: { base: 0, range: 40 },
    particles: { base: 10, range: 50 },
    lattice: { base: 25, range: 35 },
    pulse: { base: 340, range: 40 },
    background: { base: 15, variations: [0, 20, 30, 350, 15] }
  },
  cold: {
    orbit: { base: 200, range: 40 },
    particles: { base: 210, range: 50 },
    lattice: { base: 190, range: 40 },
    pulse: { base: 220, range: 40 },
    background: { base: 210, variations: [200, 220, 195, 210, 230] }
  },
  gray: {
    orbit: { base: 0, range: 0, saturation: 0 },
    particles: { base: 0, range: 0, saturation: 0 },
    lattice: { base: 0, range: 0, saturation: 0 },
    pulse: { base: 0, range: 0, saturation: 0 },
    background: { base: 0, variations: [0, 0, 0, 0, 0], saturation: 0 }
  },
  random: null // Will be generated on selection
};

let currentColorScheme = 'default';
let randomScheme = null;

export function generateRandomScheme() {
  const randomHue = () => Math.floor(Math.random() * 360);
  return {
    orbit: { base: randomHue(), range: 40 + Math.random() * 120 },
    particles: { base: randomHue(), range: 40 + Math.random() * 120 },
    lattice: { base: randomHue(), range: 40 + Math.random() * 100 },
    pulse: { base: randomHue(), range: 40 + Math.random() * 100 },
    background: { 
      base: randomHue(), 
      variations: [randomHue(), randomHue(), randomHue(), randomHue(), randomHue()] 
    }
  };
}

export function getColorScheme() {
  if (currentColorScheme === 'random') {
    if (!randomScheme) randomScheme = generateRandomScheme();
    return randomScheme;
  }
  return colorSchemes[currentColorScheme];
}

export function getHue(mode, energy) {
  const scheme = getColorScheme();
  const modeScheme = scheme[mode];
  const saturation = modeScheme.saturation !== undefined ? modeScheme.saturation : 100;
  return {
    hue: modeScheme.base + energy * modeScheme.range,
    saturation
  };
}

export function setColorScheme(scheme) {
  currentColorScheme = scheme;
  if (scheme === 'random') {
    randomScheme = generateRandomScheme();
  }
  console.log('[Colors] Switched to scheme:', currentColorScheme);
}
