// Tiny WebAudio feedback layer — no external audio assets required.
const Sounds = (() => {
  let audioContext = null;

  function enabled() { return localStorage.getItem("mv_sound") !== "off"; }
  function ctx() {
    if (!enabled()) return null;
    try { audioContext ||= new (window.AudioContext || window.webkitAudioContext)(); return audioContext; } catch { return null; }
  }

  function tone(frequency, duration = 0.07, type = "sine", gain = 0.035, delay = 0) {
    const ac = ctx();
    if (!ac) return;
    const start = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const amp = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(amp).connect(ac.destination);
    osc.start(start);
    osc.stop(start + duration + 0.01);
  }

  function playExecute() { tone(520, .06, "square", .025); tone(780, .09, "sine", .022, .055); }
  function playReject() { tone(180, .11, "sawtooth", .025); tone(120, .13, "sawtooth", .02, .07); }
  function playLevelUp() { tone(440, .1, "triangle", .03); tone(660, .1, "triangle", .03, .11); tone(880, .18, "triangle", .035, .22); }

  return { playExecute, playReject, playLevelUp };
})();
