// Load test for a booking rush ("เปิดจอง 19:00"). Run against STAGING only:
//   k6 run -e BASE_URL=https://staging.example.com -e SHOP_KEY=SHOP-XXXX \
//     -e BRANCH_ID=<uuid> -e SERVICE_ID=<uuid> -e DATE=2026-10-25 scripts/load/liff-rush.k6.js
//
// Simulates customers refreshing the LIFF page (meta + bookable-days + slots)
// every ~2s. Bookings are not created (they need real LIFF ID tokens).
// One load machine = one IP, so `liffRead` (120/min per IP) sheds most of it as
// 429; that is the limiter working. To measure the cache path, raise the limit
// on staging or run k6 from several hosts.
// Pass: p95 < 1.5s, error rate < 1%, and Supabase CPU < 60% on its dashboard.
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL;
const SHOP = __ENV.SHOP_KEY;
const BRANCH = __ENV.BRANCH_ID;
const SERVICE = __ENV.SERVICE_ID;
const DATE = __ENV.DATE;

export const options = {
  scenarios: {
    rush: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 1000 },
        { duration: '3m', target: 5000 },
        { duration: '1m', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const responses = http.batch([
    ['GET', `${BASE}/api/public/shop/${SHOP}/meta`],
    ['GET', `${BASE}/api/public/shop/${SHOP}/bookable-days?branch_id=${BRANCH}`],
    ['GET', `${BASE}/api/public/shop/${SHOP}/slots?branch_id=${BRANCH}&service_id=${SERVICE}&date=${DATE}`],
  ]);
  for (const res of responses) {
    // 429 = limiter doing its job, 400 not_released = waiting room.
    check(res, { 'served or shed': (r) => r.status === 200 || r.status === 429 || r.status === 400 });
  }
  sleep(1.5 + Math.random());
}
