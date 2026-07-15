// Measures the distortion AND the level change the effect chain's waveshaper
// actually applies, as a function of the `drive` gain. Read-only, no deps.
//
// Why this exists: the lofi preset shipped with drive 2.2 picked by feel and
// sounded like a fuzz pedal. THD is the number that settles it.
//
// MODELS THE REAL CHAIN, which is easy to get wrong:
//   ... -> lowpass -> driveGain(x drive) -> shaper(FIXED curve) -> fxGain(x level)
// The WaveShaper curve is FIXED at tanh(FX_CURVE_DRIVE * x)/tanh(FX_CURVE_DRIVE)
// (it can't be automated), and `drive` is a GAIN NODE IN FRONT of it. So the
// transfer is tanh(3 * drive * x)/tanh(3) — NOT a per-drive normalized tanh.
// Modelling it the second way flatters every number.
//
//   node scripts/thd-experiment.mjs

const SR = 48000;
const F0 = 440;
const FX_CURVE_DRIVE = 3; // must match lib/audio/remix.ts

function saturationCurve(drive) {
  const samples = 1024;
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i += 1) {
    const x = (i / (samples - 1)) * 2 - 1;
    curve[i] = Math.tanh(drive * x) / Math.tanh(drive);
  }
  return curve;
}

const CURVE = saturationCurve(FX_CURVE_DRIVE);

// WaveShaperNode maps input [-1,1] across the curve, clamping outside.
function shape(x) {
  const n = CURVE.length;
  const t = ((Math.max(-1, Math.min(1, x)) + 1) / 2) * (n - 1);
  const i = Math.floor(t);
  const f = t - i;
  return CURVE[i] + (CURVE[Math.min(i + 1, n - 1)] - CURVE[i]) * f;
}

// Goertzel: exact energy at one frequency.
function magnitudeAt(sig, freq) {
  const w = (2 * Math.PI * freq) / SR;
  const cw = Math.cos(w), sw = Math.sin(w);
  const coeff = 2 * cw;
  let s0 = 0, s1 = 0, s2 = 0;
  for (let i = 0; i < sig.length; i += 1) {
    s0 = sig[i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return (2 * Math.hypot(s1 - s2 * cw, s2 * sw)) / sig.length;
}

/** THD (%) and the fundamental's gain (dB) for a sine at `amp` through `drive`. */
function measure(drive, amp) {
  const n = SR;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const x = amp * Math.sin((2 * Math.PI * F0 * i) / SR);
    out[i] = shape(drive * x); // drive is a GAIN before the fixed curve
  }
  const fund = magnitudeAt(out, F0);
  let harm = 0;
  for (let h = 2; h <= 12; h += 1) {
    const f = F0 * h;
    if (f > SR / 2) break;
    harm += magnitudeAt(out, f) ** 2;
  }
  return { thd: (Math.sqrt(harm) / fund) * 100, gainDb: 20 * Math.log10(fund / amp) };
}

const DRIVES = [0.1, 0.2, 0.3, 0.4, 0.6, 0.8, 1.0, 1.5, 2.2];
const TYPICAL = 0.25; // -12 dBFS, realistic average for mixed music
const PEAK = 0.71;    // -3 dBFS

console.log("Effect waveshaper: tanh(3 * drive * x) / tanh(3)  [the REAL chain]\n");
console.log(
  "drive".padEnd(7) + "THD@-12dB".padStart(11) + "THD@-3dB".padStart(11) +
  "gain@-12dB".padStart(12) + "   unity level   verdict",
);
for (const d of DRIVES) {
  const t = measure(d, TYPICAL);
  const p = measure(d, PEAK);
  // fxGain that would bring in-band content back to source level.
  const unity = 1 / 10 ** (t.gainDb / 20);
  const verdict = p.thd < 1 ? "clean" : p.thd < 3 ? "subtle warmth" : p.thd < 8 ? "audible" : "DISTORTED";
  const tag = d === 2.2 ? "  <- lofi shipped" : d === 1.5 ? "  <- phone" : d === 1 ? "  <- none/underwater" : "";
  console.log(
    String(d).padEnd(7) +
      `${t.thd.toFixed(2)}%`.padStart(11) +
      `${p.thd.toFixed(2)}%`.padStart(11) +
      `${t.gainDb >= 0 ? "+" : ""}${t.gainDb.toFixed(1)}dB`.padStart(12) +
      `   ${unity.toFixed(3)}`.padEnd(15) + verdict + tag,
  );
}
