/**
 * Shared timeline for every aspect ratio (index.html = 9:16, index-16x9.html = 16:9).
 * The page supplies the layout (HTML + CSS) and window.PANS; timing lives here only,
 * so both videos stay in sync.
 *
 * window.PANS = { s8: { scale, from, to } }
 * Offsets must stay within (image size x scale - view size) or the view shows blank.
 */
const PANS = window.PANS;

/** Total video length in seconds. */
const DURATION = 46;
/** Cross-fade length between scenes in seconds. */
const FADE = 0.4;
/** Scene start times in seconds, in DOM order. */
const SCENES = [
  { id: 's1', start: 0 },
  { id: 's2', start: 4 },
  { id: 's3', start: 10 },
  { id: 's4', start: 16 },
  { id: 's5', start: 22 },
  { id: 's6', start: 27 },
  { id: 's7', start: 32 },
  { id: 's8', start: 37 },
  { id: 's9', start: 42 },
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

/** Rubber stamp slam: big, tilted, lands hard, then a tiny settle. */
function stamp(id, t, at, dur = 0.35) {
  const raw = prog(t, at, at + dur);
  const el = $(id);
  const s = 2.2 - 1.2 * easeOut(raw);
  const shake = raw >= 1 ? 0 : (1 - raw) * 6;
  el.style.opacity = raw > 0 ? 1 : 0;
  el.style.transform = `rotate(${-12 + shake}deg) scale(${s})`;
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
    // Headline on screen from the very first frame (thumbnail + muted autoplay)
    $('s1-h').style.opacity = 1;
    $('s1-h').style.transform = `scale(${1 + 0.03 * prog(t, 0, 4)})`;
    $('s1-h').style.transformOrigin = '0 50%';
    rise('s1-s', t, 0.5, 40);
    ['s1-t1', 's1-t2', 's1-t3', 's1-t4'].forEach((id, i) => rise(id, t, 1.1 + i * 0.5, 60, 0.45));
  },
  s2(t) {
    pop('s2-tag', t, 0.1);
    rise('s2-h', t, 0.1);
    rise('s2-b1', t, 0.8, 50);
    rise('s2-g', t, 1.9, 20, 0.6);
    rise('s2-b2', t, 2.9, 50);
    rise('s2-b3', t, 3.8, 50);
    rise('s2-a', t, 4.7, 40);
  },
  s3(t) {
    pop('s3-tag', t, 0.1);
    rise('s3-h', t, 0.1);
    rise('s3-c', t, 0.8, 60);
    stamp('s3-st', t, 1.9);
    rise('s3-r1', t, 2.7, 50);
    rise('s3-r2', t, 3.2, 50);
    rise('s3-a', t, 4.4, 40);
  },
  s4(t) {
    pop('s4-tag', t, 0.1);
    rise('s4-h', t, 0.1);
    rise('s4-c1', t, 0.8, 60);
    // Second card slides in from the right and lands overlapping the first
    const p = easeOut(prog(t, 1.6, 2.2));
    const c2 = $('s4-c2');
    c2.style.opacity = p;
    c2.style.transform = `translateX(${(1 - p) * 300}px)`;
    stamp('s4-st', t, 2.3);
    rise('s4-rv', t, 3.2, 60);
    rise('s4-a', t, 4.6, 40);
  },
  s5(t) {
    pop('s5-tag', t, 0.1);
    rise('s5-h', t, 0.1);
    pop('s5-b1', t, 0.8); $('s5-b1').style.transformOrigin = '0 100%';
    pop('s5-b2', t, 1.4); $('s5-b2').style.transformOrigin = '0 100%';
    pop('s5-b3', t, 2.0); $('s5-b3').style.transformOrigin = '100% 100%';
    pop('s5-b4', t, 2.6); $('s5-b4').style.transformOrigin = '0 100%';
    rise('s5-a', t, 3.6, 40);
  },
  s6(t) {
    rise('s6-h', t, 0.1);
    rise('s6-p', t, 0.3, 120, 0.7);
    slideScreens(['s6-i1', 's6-i2'], easeInOut(prog(t, 2.4, 3.0)));
    rise('s6-c1', t, 0.9, 40);
    rise('s6-c2', t, 1.8, 40);
    rise('s6-c3', t, 2.8, 40);
  },
  s7(t) {
    rise('s7-h', t, 0.1);
    rise('s7-p', t, 0.3, 120, 0.7);
    $('s7-r').style.opacity = easeOut(prog(t, 0.9, 1.3)) * (1 - prog(t, 2.2, 2.5));
    $('s7-i2').style.transform = `translateX(${(1 - easeInOut(prog(t, 2.3, 2.9))) * 100}%)`;
    rise('s7-c1', t, 1.0, 40);
    rise('s7-c2', t, 2.0, 40);
    rise('s7-c3', t, 3.0, 40);
  },
  s8(t) {
    rise('s8-h', t, 0.1);
    rise('s8-w', t, 0.3, 120, 0.7);
    pan('s8-i', easeInOut(prog(t, 0.6, 4.4)), PANS.s8);
    pop('s8-n', t, 2.0, 0.6);
    rise('s8-c1', t, 3.2, 40);
  },
  s9(t) {
    pop('s9-l', t, 0.2, 0.6);
    rise('s9-h', t, 0.5);
    rise('s9-s', t, 0.9, 40);
    pop('s9-p', t, 1.4);
    rise('s9-q', t, 1.9, 90, 0.7);
    rise('s9-w', t, 2.5, 40);
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
