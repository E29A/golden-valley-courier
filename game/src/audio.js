// Sound, synthesised in WebAudio — no audio files, nothing over the network.
// Engine hum follows RPM, wind follows speed, and rings, touchdowns and stall
// warnings are short blips. Mute with M; audio starts on the first user gesture.
export function createAudio() {
  let ctx = null; let engine = null; let engineGain = null; let wind = null; let windGain = null; let muted = false;
  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    engine = ctx.createOscillator(); engine.type = 'sawtooth'; engine.frequency.value = 60;
    const engineFilter = ctx.createBiquadFilter(); engineFilter.type = 'lowpass'; engineFilter.frequency.value = 420;
    engineGain = ctx.createGain(); engineGain.gain.value = 0;
    engine.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(ctx.destination);
    engine.start();
    // Wind: looped noise through a band-pass filter.
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    wind = ctx.createBufferSource(); wind.buffer = buf; wind.loop = true;
    const windFilter = ctx.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.frequency.value = 700; windFilter.Q.value = 0.6;
    windGain = ctx.createGain(); windGain.gain.value = 0;
    wind.connect(windFilter); windFilter.connect(windGain); windGain.connect(ctx.destination);
    wind.start();
  }
  function blip(freq, dur, vol, type = 'sine') {
    if (!ctx || muted) return;
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + dur);
  }
  return {
    ensure,
    toggleMute() { muted = !muted; return muted; },
    update(flight) {
      if (!ctx || muted) return;
      const rpm = 40 + (flight.throttle / 100) * 90 + flight.speed * 0.4;
      engine.frequency.setTargetAtTime(rpm, ctx.currentTime, 0.1);
      engineGain.gain.setTargetAtTime(flight.onGround && flight.speed < 2 ? 0.015 : 0.05, ctx.currentTime, 0.2);
      windGain.gain.setTargetAtTime(Math.min(0.09, flight.speed * 0.0011), ctx.currentTime, 0.2);
    },
    ring(centre) { blip(880, 0.18, 0.18); setTimeout(() => blip(centre ? 1320 : 1108, 0.25, 0.18), 90); },
    touchdown(soft) { blip(soft ? 220 : 110, 0.25, soft ? 0.12 : 0.25, 'triangle'); },
    crash() { blip(70, 0.6, 0.3, 'sawtooth'); },
    stall() { blip(620, 0.12, 0.12, 'square'); },
    click() { blip(520, 0.06, 0.1); },
  };
}
