// Audio processing module
// Handles microphone input, audio analysis, beat detection, and BPM calculation

export const audioState = {
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

export async function enableMic() {
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

export function updateAudio() {
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

// Get AudioContext for external use
export function getAudioContext() {
  return audioContext;
}

// Get microphone stream for external use
export function getMicStream() {
  return micStream;
}
