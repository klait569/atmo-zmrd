// Rendering module
// Handles all visualization rendering modes and floating shapes system

import { getHue } from './colorSchemes.js';

// Floating shapes state for orbit and pulse modes
export const floatingShapes = [];
let lastShapeSpawn = 0;

export function spawnFloatingShape(width, height, t, energy, type) {
  const angle = Math.random() * Math.PI * 2;
  // Spawn shapes around the periphery, outside the main central shape
  const distance = (0.5 + Math.random() * 0.45) * Math.min(width, height) * 0.5;
  const x = Math.cos(angle) * distance;
  const y = Math.sin(angle) * distance;
  
  const shapeVariant = Math.random();
  const isFilled = shapeVariant < 0.3; // 30% filled shapes
  const isStar = type === 'pulse' && shapeVariant > 0.7; // 30% stars for pulse
  
  floatingShapes.push({
    x,
    y,
    size: 0.3 + Math.random() * 0.7,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 2,
    lifetime: 2 + Math.random() * 3,
    age: 0,
    type,
    hueOffset: Math.random() * 60 - 30,
    rings: type === 'orbit' ? 3 + Math.floor(Math.random() * 5) : 0,
    spikes: type === 'pulse' ? 4 + Math.floor(Math.random() * 4) : 0,
    isFilled,
    isStar,
  });
}

export function updateFloatingShapes(dt, width, height, t, energy, type) {
  // Update existing shapes
  for (let i = floatingShapes.length - 1; i >= 0; i -= 1) {
    const shape = floatingShapes[i];
    if (shape.type !== type) continue;
    
    shape.age += dt;
    shape.rotation += shape.rotationSpeed * dt;
    
    if (shape.age > shape.lifetime) {
      floatingShapes.splice(i, 1);
    }
  }
  
  // Spawn new shapes based on energy
  const spawnInterval = Math.max(0.3, 1.2 - energy * 0.8);
  if (t - lastShapeSpawn > spawnInterval && floatingShapes.filter(s => s.type === type).length < 8) {
    spawnFloatingShape(width, height, t, energy, type);
    lastShapeSpawn = t;
  }
}

export function renderBackground(ctx, width, height, t, atmosphere, energy, colorScheme) {
  const scheme = colorScheme();
  const atmosphereIndex = { ambient: 0, quiet: 1, calm: 2, bright: 3, energetic: 4 }[atmosphere] || 0;
  const hueShift = scheme.background.variations[atmosphereIndex];
  const saturation = scheme.background.saturation !== undefined ? scheme.background.saturation : 90;

  const gradient = ctx.createRadialGradient(width * 0.5, height * 0.52, 40, width * 0.5, height * 0.5, width * 0.72);
  gradient.addColorStop(0, `hsl(${hueShift + Math.sin(t * 0.2) * 22} ${saturation}% ${13 + energy * 14}%`);
  gradient.addColorStop(1, `hsl(${hueShift} ${saturation * 0.5}% 4%`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

export function renderOrbit(target, width, height, t, energy) {
  target.save();
  target.translate(width / 2, height / 2);
  
  const { hue, saturation } = getHue('orbit', energy);
  
  // Main central orbit rings - scaled to fill window
  const baseSize = Math.min(width, height) * 0.5;
  target.strokeStyle = `hsla(${hue}, ${saturation}%, 72%, 0.58)`;
  target.lineWidth = 1 + energy * 2.2;
  const rings = 22;
  for (let r = 1; r <= rings; r += 1) {
    target.beginPath();
    const radius = (baseSize * 0.038) * r + Math.sin(t * 0.6 + r * 0.7) * 10 * (0.15 + energy);
    target.ellipse(0, 0, radius, radius * (0.58 + Math.sin(t * 1.1 + r) * 0.14), t * 0.18 + r * 0.07, 0, Math.PI * 2);
    target.stroke();
  }
  
  // Render floating orbital shapes
  const orbitShapes = floatingShapes.filter(s => s.type === 'orbit');
  for (const shape of orbitShapes) {
    const alpha = shape.age < 0.5 
      ? shape.age / 0.5 
      : shape.age > shape.lifetime - 0.5 
        ? (shape.lifetime - shape.age) / 0.5 
        : 1;
    
    if (alpha <= 0) continue;
    
    target.save();
    target.translate(shape.x, shape.y);
    target.rotate(shape.rotation);
    
    const baseSize = Math.min(width, height) * 0.04 * shape.size;
    const colorData = getHue('orbit', energy);
    const hue = colorData.hue + shape.hueOffset;
    const saturation = colorData.saturation;
    
    if (shape.isFilled) {
      // Render filled circle with glow
      const gradient = target.createRadialGradient(0, 0, 0, 0, 0, baseSize * 2);
      gradient.addColorStop(0, `hsla(${hue}, ${saturation}%, 72%, ${alpha * 0.6})`);
      gradient.addColorStop(0.5, `hsla(${hue}, ${saturation}%, 72%, ${alpha * 0.3})`);
      gradient.addColorStop(1, `hsla(${hue}, ${saturation}%, 72%, 0)`);
      target.fillStyle = gradient;
      target.beginPath();
      target.arc(0, 0, baseSize * 2, 0, Math.PI * 2);
      target.fill();
    } else {
      // Render concentric rings
      for (let r = 1; r <= shape.rings; r += 1) {
        target.beginPath();
        const radius = baseSize * r * 0.7 + Math.sin(t * 1.2 + r) * 3;
        const eccentricity = 0.5 + Math.sin(t * 0.8 + r * 0.5) * 0.2;
        target.strokeStyle = `hsla(${hue}, ${saturation}%, 72%, ${alpha * 0.4 * (1 - r / shape.rings)})`;
        target.lineWidth = 0.8 + energy;
        target.ellipse(0, 0, radius, radius * eccentricity, t * 0.3 + r * 0.5, 0, Math.PI * 2);
        target.stroke();
      }
    }
    
    target.restore();
  }
  
  target.restore();
}

export function renderParticles(target, width, height, t, energy) {
  const { hue: baseHue, saturation } = getHue('particles', energy);
  const count = 220;
  for (let i = 0; i < count; i += 1) {
    const p = i / count;
    const angle = p * Math.PI * 2 + t * (0.25 + energy * 1.2);
    const radius = (0.2 + p * 0.72 + Math.sin(i * 0.7 + t) * 0.04) * Math.min(width, height) * 0.8;
    const x = width / 2 + Math.cos(angle * (1 + energy)) * radius;
    const y = height / 2 + Math.sin(angle * (1.4 + energy * 0.8)) * radius * 0.7;
    const size = 0.8 + (2.8 + energy * 2.2) * (0.5 + Math.sin(i + t * 2.4) * 0.5);

    target.fillStyle = `hsla(${baseHue + p * 50}, ${saturation}%, 72%, ${0.16 + p * 0.55})`;
    target.beginPath();
    target.arc(x, y, size, 0, Math.PI * 2);
    target.fill();
  }
}

export function renderLattice(target, width, height, t, energy) {
  const { hue, saturation } = getHue('lattice', energy);
  const spacing = Math.max(20, 78 - energy * 42);
  const amp = 8 + energy * 42;
  target.strokeStyle = `hsla(${hue}, ${saturation}%, 79%, 0.36)`;
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

export function renderPulse(target, width, height, t, energy) {
  target.save();
  target.translate(width / 2, height / 2);
  
  const { hue: baseHue, saturation } = getHue('pulse', energy);
  
  // Main central pulse - scaled to fill window
  const baseSize = Math.min(width, height) * 0.5;
  const layers = 14;
  for (let i = 0; i < layers; i += 1) {
    const p = i / layers;
    const radius = baseSize * (0.15 + p * 0.75 + energy * 0.10);
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
    target.strokeStyle = `hsla(${baseHue + p * 40}, ${saturation}%, 76%, ${0.12 + p * 0.45})`;
    target.lineWidth = 1 + p * 1.8;
    target.stroke();
  }
  
  // Render floating pulse shapes
  const pulseShapes = floatingShapes.filter(s => s.type === 'pulse');
  for (const shape of pulseShapes) {
    const alpha = shape.age < 0.5 
      ? shape.age / 0.5 
      : shape.age > shape.lifetime - 0.5 
        ? (shape.lifetime - shape.age) / 0.5 
        : 1;
    
    if (alpha <= 0) continue;
    
    target.save();
    target.translate(shape.x, shape.y);
    target.rotate(shape.rotation);
    
    const baseSize = Math.min(width, height) * 0.06 * shape.size;
    const colorData = getHue('pulse', energy);
    const hue = colorData.hue + shape.hueOffset;
    const saturation = colorData.saturation;
    const pulsePhase = (t * 2 + shape.age) % 1;
    const pulseFactor = 1 + Math.sin(pulsePhase * Math.PI * 2) * 0.2;
    
    if (shape.isFilled) {
      // Render filled pulsing circle with glow
      const gradient = target.createRadialGradient(0, 0, 0, 0, 0, baseSize * pulseFactor * 1.5);
      gradient.addColorStop(0, `hsla(${hue}, ${saturation}%, 76%, ${alpha * 0.7})`);
      gradient.addColorStop(0.6, `hsla(${hue}, ${saturation}%, 76%, ${alpha * 0.3})`);
      gradient.addColorStop(1, `hsla(${hue}, ${saturation}%, 76%, 0)`);
      target.fillStyle = gradient;
      target.beginPath();
      target.arc(0, 0, baseSize * pulseFactor * 1.5, 0, Math.PI * 2);
      target.fill();
    } else if (shape.isStar) {
      // Render star shape
      target.beginPath();
      for (let i = 0; i < shape.spikes * 2; i += 1) {
        const angle = (i * Math.PI) / shape.spikes;
        const radius = i % 2 === 0 ? baseSize * pulseFactor : baseSize * 0.5 * pulseFactor;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (i === 0) target.moveTo(x, y);
        else target.lineTo(x, y);
      }
      target.closePath();
      target.fillStyle = `hsla(${hue}, ${saturation}%, 76%, ${alpha * 0.5})`;
      target.fill();
      target.strokeStyle = `hsla(${hue}, ${saturation}%, 76%, ${alpha * 0.7})`;
      target.lineWidth = 1.5;
      target.stroke();
    } else {
      // Render spikey pulse layers
      for (let layer = 0; layer < 4; layer += 1) {
        const lp = layer / 4;
        const radius = baseSize * (0.5 + lp * 0.8) * pulseFactor;
        
        target.beginPath();
        for (let a = 0; a <= Math.PI * 2 + 0.001; a += Math.PI / 30) {
          const spike = 1 + Math.sin(a * shape.spikes + t * 2) * (0.15 + energy * 0.15);
          const rr = radius * spike;
          const x = Math.cos(a) * rr;
          const y = Math.sin(a) * rr;
          if (a === 0) target.moveTo(x, y);
          else target.lineTo(x, y);
        }
        target.closePath();
        target.strokeStyle = `hsla(${hue}, ${saturation}%, 76%, ${alpha * 0.35 * (1 - lp * 0.5)})`;
        target.lineWidth = 1 + lp;
        target.stroke();
      }
    }
    
    target.restore();
  }
  
  target.restore();
}

export const renderers = {
  orbit: renderOrbit,
  particles: renderParticles,
  lattice: renderLattice,
  pulse: renderPulse,
};
