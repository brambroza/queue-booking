/**
 * Render the promo page to an .mp4 for Facebook (30 fps).
 *
 *   node render.mjs                     9:16 -> out/queuebooking-facebook-9x16.mp4
 *   node render.mjs --format 16x9       16:9 -> out/queuebooking-facebook-16x9.mp4
 *   node render.mjs --sample            one PNG per scene -> <frames dir>/<format>/sample-*.png (no video)
 *
 * Env:
 *   PLAYWRIGHT_CORE  path to a playwright-core package (default: newest one in the npx cache)
 *   FRAMES_DIR       where temporary PNG frames go (default: OS temp dir)
 *   FFMPEG           ffmpeg binary (default: ffmpeg on PATH)
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(HERE, '../../..');
const PAGE_DIR = '/docs/marketing/facebook-video';
/** Supported aspect ratios: page to open and output size. */
const FORMATS = {
  '9x16': { page: 'index.html', size: { width: 1080, height: 1920 } },
  '16x9': { page: 'index-16x9.html', size: { width: 1920, height: 1080 } },
};
const FORMAT = readFormat(process.argv);
const PAGE_PATH = `${PAGE_DIR}/${FORMATS[FORMAT].page}`;
const SIZE = FORMATS[FORMAT].size;
const OUT_FILE = join(HERE, 'out', `queuebooking-facebook-${FORMAT}.mp4`);
// Frames are kept per format so the two renders never mix
const FRAMES_DIR = join(process.env.FRAMES_DIR || join(tmpdir(), 'queuebooking-facebook-frames'), FORMAT);
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const FPS = 30;
/** One representative moment per scene, used by --sample. */
const SAMPLE_TIMES = [0, 3.5, 5.5, 7.5, 9.5, 12, 14.5, 18.5, 23.5, 27, 29.5, 33, 38.5];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.ttf': 'font/ttf',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

/**
 * Read `--format <name>` from the command line.
 * @param {string[]} argv
 * @returns {keyof typeof FORMATS}
 */
function readFormat(argv) {
  const at = argv.indexOf('--format');
  const value = at === -1 ? '9x16' : argv[at + 1];
  if (!Object.hasOwn(FORMATS, value ?? '')) {
    console.error(`Unknown --format "${value}". Use one of: ${Object.keys(FORMATS).join(', ')}`);
    process.exit(1);
  }
  return value;
}

/**
 * Locate playwright-core: explicit env path first, then the newest copy in the npx cache.
 * @returns {string} absolute path to the package directory
 */
function findPlaywrightCore() {
  if (process.env.PLAYWRIGHT_CORE) return process.env.PLAYWRIGHT_CORE;
  const cache = join(homedir(), '.npm', '_npx');
  const found = (existsSync(cache) ? readdirSync(cache) : [])
    .map((dir) => join(cache, dir, 'node_modules', 'playwright-core'))
    .filter((dir) => existsSync(join(dir, 'package.json')))
    .map((dir) => ({ dir, version: JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version }))
    .sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
  if (found.length === 0) {
    throw new Error('playwright-core not found. Run `npx playwright --version` once, or set PLAYWRIGHT_CORE.');
  }
  return found[0].dir;
}

/**
 * Launch Chromium, falling back to the installed Google Chrome when the bundled browser is missing.
 * @param {{ launch: Function }} chromium
 */
async function launchBrowser(chromium) {
  try {
    return await chromium.launch();
  } catch (error) {
    console.warn(`Bundled Chromium unavailable (${String(error).split('\n')[0]}), using Google Chrome`);
    return chromium.launch({ channel: 'chrome' });
  }
}

/**
 * Read-only static server limited to files the page needs (this folder and public/).
 * Serving over http avoids file:// font restrictions.
 * @returns {Promise<{ url: string, close: () => void }>}
 */
function startServer() {
  const allowed = [join(PROJECT_ROOT, 'public') + sep, HERE + sep];
  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
    const file = normalize(join(PROJECT_ROOT, pathname));
    const ok = allowed.some((root) => file.startsWith(root)) && existsSync(file) && statSync(file).isFile();
    if (!ok) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise((done) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      done({ url: `http://127.0.0.1:${port}`, close: () => server.close() });
    });
  });
}

/**
 * Open the page and wait until fonts and every image are ready.
 * @param {import('playwright-core').Browser} browser
 * @param {string} baseUrl
 */
async function openPage(browser, baseUrl) {
  const page = await browser.newPage({ viewport: SIZE, deviceScaleFactor: 1 });
  const failed = [];
  page.on('requestfailed', (request) => failed.push(request.url()));
  page.on('response', (response) => { if (response.status() >= 400) failed.push(response.url()); });
  await page.goto(`${baseUrl}${PAGE_PATH}?t=0`, { waitUntil: 'load' });
  await page.evaluate(async () => {
    await document.fonts.load('700 40px Kanit', 'ก');
    await document.fonts.load('400 40px Kanit', 'ก');
    await document.fonts.ready;
    await Promise.all([...document.images].map((img) => img.decode()));
  });
  if (failed.length > 0) throw new Error(`Assets failed to load:\n${failed.join('\n')}`);
  const kanit = await page.evaluate(() => document.fonts.check('700 40px Kanit', 'ก'));
  if (!kanit) throw new Error('Kanit font did not load');
  return page;
}

/**
 * Draw one frame and save it.
 * @param {import('playwright-core').Page} page
 * @param {number} seconds
 * @param {string} file
 */
async function capture(page, seconds, file) {
  await page.evaluate((t) => new Promise((done) => {
    window.renderAt(t);
    requestAnimationFrame(() => requestAnimationFrame(done));
  }), seconds);
  await page.screenshot({ path: file, type: 'png' });
}

/** Encode PNG frames into the final mp4 with a silent audio track. */
function encode() {
  mkdirSync(dirname(OUT_FILE), { recursive: true });
  const args = [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-framerate', String(FPS), '-i', join(FRAMES_DIR, 'f-%05d.png'),
    '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-shortest',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart',
    OUT_FILE,
  ];
  const result = spawnSync(FFMPEG, args, { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`ffmpeg exited with ${result.status}`);
}

async function main() {
  const sampleOnly = process.argv.includes('--sample');
  const require = createRequire(import.meta.url);
  const { chromium } = require(findPlaywrightCore());

  mkdirSync(FRAMES_DIR, { recursive: true });
  const server = await startServer();
  const browser = await launchBrowser(chromium);
  try {
    const page = await openPage(browser, server.url);
    const duration = await page.evaluate(() => window.VIDEO_DURATION);

    if (sampleOnly) {
      for (const seconds of SAMPLE_TIMES) {
        const file = join(FRAMES_DIR, `sample-${String(seconds).padStart(4, '0')}.png`);
        await capture(page, seconds, file);
        console.log(file);
      }
      return;
    }

    // Drop frames from an earlier run so a shorter timeline cannot leave a stale tail
    for (const name of readdirSync(FRAMES_DIR)) {
      if (/^f-\d{5}\.png$/.test(name)) rmSync(join(FRAMES_DIR, name));
    }
    const total = Math.round(duration * FPS);
    for (let frame = 0; frame < total; frame += 1) {
      await capture(page, frame / FPS, join(FRAMES_DIR, `f-${String(frame).padStart(5, '0')}.png`));
      if (frame % 150 === 0) console.log(`frame ${frame}/${total}`);
    }
    encode();
    console.log(`done: ${OUT_FILE}`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
