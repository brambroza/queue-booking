# Marketing screenshots

Captures the real product UI (portal, LIFF, signage) for the landing page, use-case
pages and blog. Output goes to `public/images/product/*.webp`.

## Setup

Add these to `.env.local` (gitignored):

```
SCREENSHOT_BASE_URL=http://localhost:3000
SCREENSHOT_EMAIL=
SCREENSHOT_PASSWORD=
SCREENSHOT_SHOP_KEY=
```

Use a demo shop account. Every customer name visible in that shop must be fictional,
because the portal screenshots show the shop's real rows.

Install the browser once:

```bash
npx playwright install chromium
```

## Run

```bash
npm run dev                          # in another terminal, if the base URL is localhost
npm run screenshots                  # all shots
npm run screenshots -- liff-services # one or more by name
```

Requires Node 22.18+ (the script is TypeScript run by Node's type stripping).

## What the script does and does not do

- Logs in through the real `/login` form, once, and reuses the session.
- Forces light mode, Thai locale and Bangkok time.
- **Blocks every non-GET request to `/api`.** It never creates, moves, calls or cancels
  a booking. Blocked requests are printed as `blocked POST /api/...`.
- LIFF pages run outside LINE with a stubbed `window.liff`. `POST /me` upserts a LINE
  user, so it is answered from a fixture instead of reaching the server. The customer
  name and the queue on the "my queue" shot therefore come from the fixture in
  `capture.mts`; services, resources and slots come from the demo shop.
- LINE chat, Flex messages and bank apps are not web pages of this app and cannot be
  captured here. Those images need a manual capture from a phone.

## Adding a shot

Add an entry to `SHOTS` in `shots.mts`. `clickTexts` may only walk through UI
navigation (tabs, option cards, "next"); never a button that saves.

## Before using a new image

Open it and check: no real names or phone numbers, no loading state, light mode,
Kanit font rendered.

## Setup-guide screenshots (`guide-*`)

The shots named `guide-*` feed `docs/guides/line-setup-guide.html` (built into
`public/docs/line-setup-guide.pdf` by `docs/guides/build.sh`, which is also the file
attached to the "setup guide" onboarding email). They write to
`public/images/product/guide/` and use three per-shot options:

- `dir` — sub-folder under `public/images/product/`.
- `routes` — JSON served for read endpoints, so a page shows a state the demo shop is
  not in (the dashboard checklist at 3 of 5). Writes stay blocked.
- `showBaseUrlAs` — text swap of `SCREENSHOT_BASE_URL` for the public origin, so webhook
  and LIFF URLs captured from localhost read as `https://queuebooking.com`.

LINE OA Manager / Developers Console screens cannot be captured here; the list of
hand-made captures the guide expects is in `docs/guides/line-screenshots-needed.md`.

```bash
npm run screenshots -- guide-dashboard-checklist guide-branches guide-services guide-working-hours guide-line-settings guide-line-setup
./docs/guides/build.sh
```
