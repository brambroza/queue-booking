/**
 * Shared timeline for every aspect ratio (index.html = 9:16, index-16x9.html = 16:9).
 * The page supplies the layout (HTML + CSS) and window.PANS; timing lives here only,
 * so both videos stay in sync.
 *
 * window.PANS = { s4: { scale, from, to }, s6: { scale, from, to } }
 * Offsets must stay within (image size x scale - view size) or the view shows blank.
 */
const PANS = window.PANS;

/** Total video length in seconds. */
const DURATION = 40;
/** Cross-fade length between scenes in seconds. */
const FADE = 0.4;
/** Scene start times in seconds, in DOM order. */
const SCENES = [
  { id: 's1', start: 0 },
  { id: 's2', start: 4 },
  { id: 's3', start: 10 },
  { id: 's4', start: 15 },
  { id: 's5', start: 20 },
  { id: 's6', start: 25 },
  { id: 's7', start: 30 },
  { id: 's8', start: 34 },
];

const $ = (id) => document.getElementById(id);
const clamp = (x) => Math.min(1, Math.max(0, x));
/** Linear progress 0..1 of t between a and b. */
const prog = (t, a, b) => clamp((t - a) / (b - a));
const easeOut = (p) => 1 - Math.pow(1 - p, 3);
const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
/** Overshoot ease for "pop" entrances. */
const easeBack = (p) => { const c = 1.70158; const q = p - 1; return 1 + (c + 1) * q * q * q + c * q * q; };

/** Fade + rise entrance. */
function rise(id, t, at, dist = 70, dur = 0.55) {
  const p = easeOut(prog(t, at, at + dur));
  const el = $(id);
  el.style.opacity = p;
  el.style.transform = `translateY(${(1 - p) * dist}px)`;
}

/** Scale pop entrance. */
function pop(id, t, at, dur = 0.5) {
  const raw = prog(t, at, at + dur);
  const el = $(id);
  el.style.opacity = clamp(raw * 3);
  el.style.transform = `scale(${0.6 + 0.4 * easeBack(raw)})`;
}

/** Horizontal slide of stacked phone screens: index may be fractional. */
function slideScreens(ids, index) {
  ids.forEach((id, i) => { $(id).style.transform = `translateX(${(i - index) * 100}%)`; });
}

/**
 * Pan a 2400px wide screenshot inside a .view.
 * @param {string} id image element id
 * @param {number} p progress 0..1
 * @param {{ scale: number, from: {x: number, y: number}, to: {x: number, y: number} }} move
 */
function pan(id, p, { scale, from, to }) {
  const x = from.x + (to.x - from.x) * p;
  const y = from.y + (to.y - from.y) * p;
  const el = $(id);
  el.style.width = `${2400 * scale}px`;
  el.style.transform = `translate(${-x}px, ${-y}px)`;
}

const RENDER = {
  s1(t) {
    // Headline is on screen from the very first frame (thumbnail + muted autoplay)
    $('s1-h').style.opacity = 1;
    $('s1-h').style.transform = `scale(${1 + 0.03 * prog(t, 0, 4)})`;
    $('s1-h').style.transformOrigin = '0 50%';
    pop('s1-b1', t, 0.3); $('s1-b1').style.transformOrigin = '0 100%';
    pop('s1-b2', t, 0.8); $('s1-b2').style.transformOrigin = '0 100%';
    pop('s1-b3', t, 1.3); $('s1-b3').style.transformOrigin = '100% 100%';
    pop('s1-b4', t, 1.8); $('s1-b4').style.transformOrigin = '0 100%';
    rise('s1-a', t, 2.5);
  },
  s2(t) {
    rise('s2-h', t, 0.1);
    rise('s2-p', t, 0.3, 120, 0.7);
    const index = easeInOut(prog(t, 2.0, 2.6)) + easeInOut(prog(t, 4.0, 4.6));
    slideScreens(['s2-i1', 's2-i2', 's2-i3'], index);
    rise('s2-c1', t, 0.9, 40);
    rise('s2-c2', t, 2.4, 40);
    rise('s2-c3', t, 4.4, 40);
  },
  s3(t) {
    rise('s3-h', t, 0.1);
    rise('s3-p', t, 0.3, 120, 0.7);
    // Highlight the payment options at the bottom of the booking screen
    $('s3-r').style.opacity = easeOut(prog(t, 1.0, 1.4)) * (1 - prog(t, 2.6, 2.9));
    $('s3-i2').style.transform = `translateX(${(1 - easeInOut(prog(t, 2.7, 3.3))) * 100}%)`;
    rise('s3-c1', t, 1.2, 40);
    rise('s3-c2', t, 3.4, 40);
  },
  s4(t) {
    rise('s4-h', t, 0.1);
    rise('s4-w', t, 0.3, 120, 0.7);
    pan('s4-i', easeInOut(prog(t, 0.6, 4.6)), PANS.s4);
    pop('s4-n', t, 2.2, 0.6);
  },
  s5(t) {
    rise('s5-h', t, 0.1);
    const p = easeOut(prog(t, 0.3, 1.1));
    $('s5-tv').style.opacity = p;
    $('s5-tv').style.transform = `scale(${0.9 + 0.1 * p + 0.02 * prog(t, 1, 5)})`;
    $('s5-st').style.opacity = p;
    rise('s5-t1', t, 1.8, 60);
    rise('s5-t2', t, 2.1, 60);
    rise('s5-t3', t, 2.4, 60);
  },
  s6(t) {
    rise('s6-h', t, 0.1);
    rise('s6-w', t, 0.3, 120, 0.7);
    // KPI row first, then down to the hourly chart
    pan('s6-i', easeInOut(prog(t, 1.0, 4.2)), PANS.s6);
    rise('s6-c1', t, 1.6, 40);
    rise('s6-c2', t, 2.4, 40);
  },
  s7(t) {
    rise('s7-h', t, 0.1);
    ['s7-f1', 's7-f2', 's7-f3', 's7-f4', 's7-f5', 's7-f6'].forEach((id, i) => pop(id, t, 0.4 + i * 0.22));
    rise('s7-s', t, 2.0, 40);
  },
  s8(t) {
    pop('s8-l', t, 0.2, 0.6);
    rise('s8-h', t, 0.5);
    rise('s8-s', t, 0.9, 40);
    pop('s8-p', t, 1.4);
    rise('s8-q', t, 1.9, 90, 0.7);
    rise('s8-w', t, 2.5, 40);
  },
};

/**
 * Draw the frame for a given time.
 * @param {number} seconds Time on the timeline, 0..DURATION.
 */
window.renderAt = function renderAt(seconds) {
  const t = Math.min(DURATION, Math.max(0, seconds));
  SCENES.forEach((scene, i) => {
    const end = i + 1 < SCENES.length ? SCENES[i + 1].start : DURATION;
    const el = $(scene.id);
    const visible = t >= scene.start && t < end + FADE;
    el.style.zIndex = i + 1;
    el.style.opacity = visible ? (i === 0 ? 1 : prog(t, scene.start, scene.start + FADE)) : 0;
    if (visible) RENDER[scene.id](t - scene.start);
  });
};
window.VIDEO_DURATION = DURATION;

// Browser preview: ?t=12 freezes a frame, otherwise loop in real time.
const fixed = new URLSearchParams(location.search).get('t');
if (fixed !== null) {
  window.renderAt(Number(fixed));
} else if (!navigator.webdriver) {
  const began = performance.now();
  const loop = (now) => { window.renderAt(((now - began) / 1000) % DURATION); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
} else {
  window.renderAt(0);
}
