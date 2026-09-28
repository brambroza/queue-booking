/**
 * Capture marketing screenshots of the real product UI with Playwright.
 *
 * Usage: npm run screenshots [-- [--business <key>|all] <shot-name> ...]
 *
 * Without --business the shots use the demo shop's own catalog and land in
 * public/images/product/. With it, each business in catalogs.mts gets its own
 * set in public/images/product/<business>/.
 *
 * Reads SCREENSHOT_BASE_URL, SCREENSHOT_EMAIL, SCREENSHOT_PASSWORD and
 * SCREENSHOT_SHOP_KEY from the environment (.env or .env.local). The run is
 * read-only: every non-GET request to the app's /api is blocked, and the LIFF
 * member call (/me, which upserts a LINE user) is answered from a fixture.
 * Bookings, dashboard numbers and signage queues are sample data from
 * fixtures.mts, because the demo shop has none of its own.
 */
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page, type Route } from 'playwright';
import sharp from 'sharp';
import { BUSINESSES, findBusiness, sampleSlots, type BusinessCatalog } from './catalogs.mts';
import {
  bangkokToday,
  meFixture,
  overlayDashboard,
  overlayReport,
  overlaySignage,
  sampleBookings,
  sampleBookingsInRange,
  type ShopCatalog,
} from './fixtures.mts';
import { BUSINESS_SHOT_NAMES, SHOTS, type Shot } from './shots.mts';

const REQUIRED_ENV = ['SCREENSHOT_BASE_URL', 'SCREENSHOT_EMAIL', 'SCREENSHOT_PASSWORD', 'SCREENSHOT_SHOP_KEY'] as const;
const OUTPUT_DIR = path.resolve('public/images/product');
const MAX_OUTPUT_WIDTH = 2400;
const WEBP_QUALITY = 82;
const SETTLE_MS = 1200;
/** Filters reload on a short delay after a click; wait it out before settling. */
const CLICK_DEBOUNCE_MS = 600;
const DISPLAY_CONTROLS_MS = 3500;

type Env = Record<(typeof REQUIRED_ENV)[number], string>;

/**
 * Read the required variables, naming any that are missing without printing values.
 * @returns The validated environment.
 */
function readEnv(): Env {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    console.error(`Missing environment variables: ${missing.join(', ')}. Add them to .env or .env.local.`);
    process.exit(1);
  }
  const env = Object.fromEntries(REQUIRED_ENV.map((key) => [key, process.env[key]!.trim()])) as Env;
  env.SCREENSHOT_BASE_URL = env.SCREENSHOT_BASE_URL.replace(/\/+$/, '');
  return env;
}

/**
 * Load the demo shop's branches, services and resources from the public meta
 * endpoint, so the sample bookings use the shop's own names.
 * @param context Browser context whose request client is used.
 * @param env Validated environment.
 * @returns The shop catalog; empty lists when the request fails.
 */
async function loadCatalog(context: BrowserContext, env: Env): Promise<ShopCatalog> {
  const url = `${env.SCREENSHOT_BASE_URL}/api/public/shop/${encodeURIComponent(env.SCREENSHOT_SHOP_KEY)}/meta`;
  try {
    const res = await context.request.get(url);
    const json = (await res.json()) as { data?: Partial<ShopCatalog> };
    return { branches: json.data?.branches ?? [], services: json.data?.services ?? [], resources: json.data?.resources ?? [] };
  } catch {
    return { branches: [], services: [], resources: [] };
  }
}

/**
 * Serve a JSON body in place of the real response.
 * @param route Intercepted route.
 * @param body Body to serialise.
 */
async function fulfillJson(route: Route, body: unknown): Promise<void> {
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
}

/**
 * Guard the app's API for one context: block every write, answer `/me` from a
 * fixture, and put sample data on the read endpoints the screenshots show.
 * @param context Browser context to guard.
 * @param env Validated environment.
 * @param catalog Catalog the sample data is built from.
 * @param sample Business catalog served in place of the demo shop's own, if any.
 */
async function guardApi(context: BrowserContext, env: Env, catalog: ShopCatalog, sample?: BusinessCatalog): Promise<void> {
  const today = bangkokToday();
  const listBody = (rows: unknown[]) => ({ data: rows, pagination: { page: 1, page_size: rows.length, total: rows.length } });
  await context.route(`${env.SCREENSHOT_BASE_URL}/api/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const query = url.searchParams;

    if (/^\/api\/public\/shop\/[^/]+\/me$/.test(url.pathname)) {
      const onAccountPage = (request.headers().referer ?? '').includes('/member');
      return fulfillJson(route, meFixture(catalog, onAccountPage));
    }
    if (request.method() !== 'GET') {
      console.warn(`  blocked ${request.method()} ${url.pathname}`);
      return route.abort();
    }

    if (sample) {
      if (/^\/api\/public\/shop\/[^/]+\/meta$/.test(url.pathname)) {
        const real = (await (await route.fetch()).json()) as { data?: { shop?: object } };
        return fulfillJson(route, {
          ...real,
          data: {
            ...real.data,
            shop: { ...real.data?.shop, name: sample.shopName },
            branches: sample.branches,
            services: sample.services,
            resources: sample.resources,
          },
        });
      }
      if (/^\/api\/public\/shop\/[^/]+\/slots$/.test(url.pathname)) return fulfillJson(route, sampleSlots(query.get('date') ?? today));
      if (url.pathname === '/api/branches') return fulfillJson(route, listBody(sample.branches));
      if (url.pathname === '/api/services') return fulfillJson(route, listBody(sample.services));
      if (url.pathname === '/api/resources') return fulfillJson(route, listBody(sample.resources));
    }

    if (url.pathname === '/api/dashboard') {
      const real = await route.fetch();
      return fulfillJson(route, overlayDashboard(await real.json(), catalog));
    }
    if (url.pathname === '/api/reports' && query.get('mode') !== 'csv') {
      const real = await route.fetch();
      return fulfillJson(route, overlayReport(await real.json(), catalog, sample?.shopName));
    }
    if (/^\/api\/public\/shop\/[^/]+\/display$/.test(url.pathname)) {
      const real = await route.fetch();
      return fulfillJson(route, overlaySignage(await real.json(), catalog, sample));
    }
    if (url.pathname === '/api/bookings') {
      const date = query.get('date');
      const status = query.get('status');
      const all = date ? sampleBookings(catalog, date) : sampleBookings(catalog, today);
      const rows = status ? all.filter((r) => r.status === status) : all;
      const pageSize = Number(query.get('page_size') ?? rows.length) || rows.length;
      const page = Number(query.get('page') ?? 1) || 1;
      return fulfillJson(route, {
        data: rows.slice((page - 1) * pageSize, page * pageSize),
        pagination: { page, page_size: pageSize, total: rows.length },
      });
    }
    if (url.pathname === '/api/calendar') {
      const from = query.get('from') ?? today;
      const to = query.get('to') ?? today;
      return fulfillJson(route, { data: sampleBookingsInRange(catalog, from, to, today) });
    }
    return route.continue();
  });
}

/**
 * Pretend to be a logged-in LIFF client. `ensureLiffLoaded` returns an existing
 * `window.liff` without loading the SDK, so the real page renders unchanged.
 * @param context Browser context to stub.
 */
async function stubLiff(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    (window as unknown as { liff: unknown }).liff = {
      init: async () => undefined,
      isLoggedIn: () => true,
      isInClient: () => false,
      login: () => undefined,
      getOS: () => 'ios',
      getProfile: async () => ({ userId: 'Uscreenshot0000000000000000000000', displayName: 'มะลิ' }),
      getIDToken: () => null,
    };
  });
}

/**
 * Create a light-mode context at the given viewport.
 * @param browser Browser instance.
 * @param shot Shot that decides viewport and device type.
 * @param storageState Optional saved login.
 * @returns The new context.
 */
async function newContext(browser: Browser, shot: Shot, storageState?: string): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: shot.viewport,
    deviceScaleFactor: shot.kind === 'display' ? 1 : 2,
    colorScheme: 'light',
    locale: 'th-TH',
    timezoneId: 'Asia/Bangkok',
    isMobile: shot.kind === 'liff',
    hasTouch: shot.kind === 'liff',
    storageState,
  });
  await context.addInitScript(() => {
    try {
      window.localStorage.setItem('qb-color-mode', 'light');
      // Analytics stay off; this only keeps the consent banner out of the frame.
      // `version` mirrors CONSENT_VERSION in src/lib/consent/cookie-consent.ts.
      window.localStorage.setItem(
        'qb-cookie-consent',
        JSON.stringify({ necessary: true, analytics: false, marketing: false, version: 1, updatedAt: new Date().toISOString() }),
      );
    } catch {
      /* storage unavailable */
    }
    // The Next.js dev indicator floats over the bottom-left corner in `next dev`.
    const hideDevOverlay = () => {
      const style = document.createElement('style');
      style.textContent = 'nextjs-portal { display: none !important; }';
      document.head?.appendChild(style);
    };
    if (document.head) hideDevOverlay();
    else document.addEventListener('DOMContentLoaded', hideDevOverlay);
  });
  return context;
}

/**
 * Log in once through the real login form and save the session.
 * @param browser Browser instance.
 * @param env Validated environment.
 * @param statePath Where to write the storage state.
 */
async function login(browser: Browser, env: Env, statePath: string): Promise<void> {
  const context = await browser.newContext({ colorScheme: 'light', locale: 'th-TH' });
  const page = await context.newPage();
  await page.goto(`${env.SCREENSHOT_BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[name="email"]', env.SCREENSHOT_EMAIL);
  await page.fill('input[name="password"]', env.SCREENSHOT_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/portal/**', { timeout: 30_000 });
  await context.storageState({ path: statePath });
  await context.close();
}

/**
 * Wait until the page is visually stable: network idle, fonts loaded, no spinners.
 * @param page Page to settle.
 */
async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);
  await page.evaluate(() => document.fonts.ready);
  await page
    .waitForFunction(() => document.querySelectorAll('[role="progressbar"], .MuiSkeleton-root').length === 0, null, {
      timeout: 15_000,
    })
    .catch(() => undefined);
  await page.waitForTimeout(SETTLE_MS);
}

/**
 * Visible part of an element, as a screenshot clip.
 * @param page Page holding the element.
 * @param selector CSS selector of the element.
 * @param viewportHeight Height of the viewport, which bounds the clip.
 * @returns Clip rectangle, or undefined when the element is missing.
 */
async function clipTo(
  page: Page,
  selector: string,
  viewportHeight: number,
): Promise<{ x: number; y: number; width: number; height: number } | undefined> {
  await page.evaluate(() => window.scrollTo(0, 0));
  const box = await page.locator(selector).first().boundingBox();
  if (!box) return undefined;
  const y = Math.max(0, box.y);
  return { x: box.x, y, width: box.width, height: Math.min(box.height, viewportHeight - y) };
}

/**
 * Open one shot, capture it, and write a WebP.
 * @param browser Browser instance.
 * @param shot Shot to capture.
 * @param env Validated environment.
 * @param statePath Saved login used by portal shots.
 * @param sample Business catalog to show instead of the demo shop's own, if any.
 * @returns Output path and size in bytes.
 */
async function capture(
  browser: Browser,
  shot: Shot,
  env: Env,
  statePath: string,
  sample?: BusinessCatalog,
): Promise<{ file: string; bytes: number }> {
  const context = await newContext(browser, shot, shot.kind === 'portal' ? statePath : undefined);
  await guardApi(context, env, sample ?? (await loadCatalog(context, env)), sample);
  if (shot.kind === 'liff') await stubLiff(context);

  try {
    const page = await context.newPage();
    // The display page takes its theme from the query string ahead of the saved config.
    const themeQuery = sample && shot.kind === 'display' ? `?theme=${encodeURIComponent(sample.signageTheme)}` : '';
    const url =
      env.SCREENSHOT_BASE_URL + shot.path.replace('{shopKey}', encodeURIComponent(env.SCREENSHOT_SHOP_KEY)) + themeQuery;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await settle(page);
    for (const text of shot.clickTexts ?? []) {
      await page.getByText(text, { exact: false }).first().click();
      await page.waitForTimeout(CLICK_DEBOUNCE_MS);
      await settle(page);
    }
    if (shot.waitForSelector) {
      await page.locator(shot.waitForSelector).first().waitFor({ timeout: 30_000 });
      await settle(page);
    }
    if (shot.waitForText) await page.getByText(shot.waitForText).first().waitFor({ timeout: 15_000 });

    // The display's floating controls fade out after three idle seconds.
    if (shot.kind === 'display') await page.waitForTimeout(DISPLAY_CONTROLS_MS);
    // Moving to the next LIFF step scrolls the page; start every capture from the top.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
    // Business sets crop the portal shell away: its shop name and notification
    // count are server-rendered from the demo shop and cannot be replaced.
    const clip = sample && shot.clipSelector ? await clipTo(page, shot.clipSelector, shot.viewport.height) : undefined;
    const png = await page.screenshot({ fullPage: clip ? false : (shot.fullPage ?? false), clip, type: 'png' });
    const dir = sample ? path.join(OUTPUT_DIR, sample.key) : OUTPUT_DIR;
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, `${shot.name}.webp`);
    const info = await sharp(png)
      .resize({ width: MAX_OUTPUT_WIDTH, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toFile(file);
    return { file, bytes: info.size };
  } finally {
    // A poll still in flight when the context closes would reject inside the route handler.
    await context.unrouteAll({ behavior: 'ignoreErrors' });
    await context.close();
  }
}

/**
 * Entry point: log in, capture the requested shots, report each result.
 */
async function main(): Promise<void> {
  const env = readEnv();
  const args = process.argv.slice(2);
  const flag = args.indexOf('--business');
  const businessArg = flag >= 0 ? args[flag + 1] : undefined;
  const requested = args.filter((arg, i) => i !== flag && i !== flag + 1);

  let businesses: Array<BusinessCatalog | undefined> = [undefined];
  if (flag >= 0) {
    const found = businessArg === 'all' ? BUSINESSES : businessArg ? [findBusiness(businessArg)] : [];
    if (found.length === 0 || found.some((b) => !b)) {
      console.error(`Unknown business. Available: all, ${BUSINESSES.map((b) => b.key).join(', ')}`);
      process.exit(1);
    }
    businesses = found;
  }

  const pool = flag >= 0 ? SHOTS.filter((shot) => BUSINESS_SHOT_NAMES.includes(shot.name)) : SHOTS;
  const shots = requested.length > 0 ? pool.filter((shot) => requested.includes(shot.name)) : pool;
  if (shots.length === 0) {
    console.error(`No matching shots. Available: ${pool.map((shot) => shot.name).join(', ')}`);
    process.exit(1);
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  const statePath = path.join(process.env.TMPDIR ?? '/tmp', `queue-screenshot-state-${process.pid}.json`);
  const browser = await chromium.launch();
  let failed = 0;

  try {
    if (shots.some((shot) => shot.kind === 'portal')) await login(browser, env, statePath);
    for (const sample of businesses) {
      for (const shot of shots) {
        const label = sample ? `${sample.key}/${shot.name}` : shot.name;
        try {
          const { file, bytes } = await capture(browser, shot, env, statePath, sample);
          console.log(`ok   ${label} -> ${path.relative(process.cwd(), file)} (${Math.round(bytes / 1024)} KB)`);
        } catch (error) {
          failed += 1;
          console.error(`fail ${label}: ${error instanceof Error ? error.message.split('\n')[0] : 'unknown error'}`);
        }
      }
    }
  } finally {
    await browser.close();
    // The saved login holds a live session; never leave it on disk.
    await rm(statePath, { force: true });
  }

  if (failed > 0) process.exit(1);
}

await main();
