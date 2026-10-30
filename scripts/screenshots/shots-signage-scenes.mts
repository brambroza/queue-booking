/**
 * Shots for the blog post on the illustrated signage templates: the real
 * `/display` page rendering sample feeds, one per template and business.
 *
 * Output: public/images/product/signage-scenes/. The browser clock is fixed at
 * 18:30 Bangkok time, so the timeline, the route and the board clock always
 * read the same. Every name below is fictional. The feed is answered here, nothing is written.
 */

import type { PatchContext, Shot, Viewport } from './shots.mts';

const DIR = 'signage-scenes';
const DISPLAY_FEED = '/api/public/shop/{shopKey}/display';
const TV: Viewport = { width: 1920, height: 1080 };
const TV_PORTRAIT: Viewport = { width: 1080, height: 1920 };

type Person = {
  id: string;
  queue_number: string;
  status: string;
  start_time: string;
  end_time: string;
  called_at: string | null;
  customer_name: string | null;
  service_name: string | null;
  resource_name: string | null;
};

type Scene = {
  shopName: string;
  branchName: string;
  template: string;
  theme: string;
  layout?: 'landscape' | 'portrait';
  announcement?: string;
  showQr?: boolean;
  serviceDone: number;
  resources: string[];
  calling: Person[];
  waiting: Person[];
  /** Bookings on the timeline that are neither called nor in line. */
  extraSchedule?: Person[];
};

/** Clock shown on every board, and the quarter hour the sample queues start from. */
const CAPTURE_TIME = '18:30:00';
const BASE_MINUTES = 18 * 60 + 30;

/**
 * Clock text a number of minutes after the base time.
 * @param offset Minutes from the base time, may be negative.
 * @returns 'HH:MM'.
 */
function clockAt(offset: number): string {
  const total = BASE_MINUTES + offset;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * One queue on the board.
 * @param queueNumber Queue number, also the id.
 * @param status Booking status.
 * @param startOffset Start, in minutes from the base time.
 * @param minutes Length of the booking.
 * @param name Customer nickname.
 * @param service Service name.
 * @param resource Service point name.
 * @returns Signage person.
 */
function person(queueNumber: string, status: string, startOffset: number, minutes: number, name: string | null, service: string, resource: string | null): Person {
  return {
    id: `sample-${queueNumber}`,
    queue_number: queueNumber,
    status,
    start_time: clockAt(startOffset),
    end_time: clockAt(startOffset + minutes),
    called_at: status === 'called' || status === 'serving' ? `2026-01-01T${clockAt(startOffset)}:00+07:00` : null,
    customer_name: name,
    service_name: service,
    resource_name: resource,
  };
}

/**
 * Body of the display feed for a scene.
 * @param scene Scene to show.
 * @returns Function building the body at capture time.
 */
function feed(scene: () => Scene) {
  return (ctx: PatchContext) => {
    const s = scene();
    const schedule = [...(s.extraSchedule ?? []), ...s.calling, ...s.waiting].sort((a, b) => a.start_time.localeCompare(b.start_time));
    return {
      data: {
        enabled: true,
        config: {
          enabled: true,
          template: s.template,
          theme: s.theme,
          layout: s.layout ?? 'landscape',
          customer_name_mode: 'full',
          show_logo: false,
          show_service_name: true,
          show_resource_name: true,
          show_clock: true,
          show_qr: s.showQr ?? false,
          announcement_text: s.announcement ?? null,
          next_queue_limit: 5,
          waiting_queue_limit: 10,
          refresh_seconds: 120,
        },
        signage: {
          date: ctx.today,
          generated_at: `${ctx.today}T${CAPTURE_TIME}+07:00`,
          shop: { name: s.shopName, logo_url: null, demo_mode_enabled: false },
          branch: { id: 'sample-branch', name: s.branchName },
          now_calling: s.calling,
          next_queue: s.waiting.slice(0, 5),
          waiting_queue: s.waiting.slice(5),
          totals: {
            waiting: s.waiting.length,
            calling: s.calling.length,
            served_today: s.serviceDone,
          },
          qr_url: s.showQr ? 'https://liff.line.me/2000000000-sample?shop_key=SAMPLE&tab=booking' : null,
          resources: s.resources.map((name, i) => ({ id: `sample-resource-${i}`, name })),
          schedule,
        },
      },
    };
  };
}

const BARBER_CHAIRS = ['เก้าอี้ 1', 'เก้าอี้ 2', 'เก้าอี้ 3'];
const CUT = 'ตัดผมชาย';

/** Barber line before A014 is called: chair 2 is free. */
const barberLine = (calledNext: boolean): Scene => {
  const a014 = calledNext
    ? person('A014', 'called', 0, 45, 'ภูมิ', CUT, 'เก้าอี้ 2')
    : person('A014', 'waiting', 0, 45, 'ภูมิ', CUT, 'เก้าอี้ 2');
  const rest = [
    person('A015', 'waiting', 15, 45, 'ฟ้า', CUT, null),
    person('A016', 'waiting', 30, 45, 'ต้น', 'ตัดผม + สระ', null),
    person('A017', 'waiting', 45, 45, 'ข้าว', CUT, null),
    person('A018', 'waiting', 60, 45, 'เจ', CUT, null),
    person('A019', 'waiting', 75, 45, 'นิว', 'โกนหนวด', null),
  ];
  return {
    shopName: 'บาร์เบอร์ตรอกข้าวสาร',
    branchName: 'สาขาเอกมัย',
    template: 'lane',
    theme: 'day_navy',
    serviceDone: 12,
    resources: BARBER_CHAIRS,
    calling: [...(calledNext ? [a014] : []), person('A013', 'serving', -30, 45, 'มะลิ', CUT, 'เก้าอี้ 1')],
    waiting: calledNext ? rest : [a014, ...rest],
  };
};

/** The same line in a restaurant, for the cover image. */
const restaurantLine = (): Scene => {
  const atTable = (p: Person): Person => ({ ...p, service_name: 'โต๊ะ 2 ที่นั่ง', resource_name: p.resource_name?.replace('เก้าอี้', 'โต๊ะ') ?? null });
  const line = barberLine(true);
  return {
    ...line,
    shopName: 'ครัวยายเพลิน',
    branchName: 'สาขาอารีย์',
    theme: 'day_chili',
    resources: ['โต๊ะ 1', 'โต๊ะ 2', 'โต๊ะ 3'],
    calling: line.calling.map(atTable),
    waiting: line.waiting.map(atTable),
  };
};

const COURT = 'เช่าคอร์ท 1 ชั่วโมง';

const courtTimeline = (layout: 'landscape' | 'portrait'): Scene => ({
  shopName: 'สนามแบดมินตันบ้านลูกขน',
  branchName: 'สาขารามคำแหง',
  template: 'timeline',
  theme: 'day_court',
  layout,
  serviceDone: 18,
  resources: ['คอร์ท 1', 'คอร์ท 2', 'คอร์ท 3', 'คอร์ท 4'],
  calling: [person('A021', 'called', 15, 60, 'ทีมภูมิ', COURT, 'คอร์ท 2'), person('A020', 'serving', -45, 60, 'ฟ้า', COURT, 'คอร์ท 1')],
  waiting: [
    person('A022', 'confirmed', 15, 60, 'ต้น', COURT, 'คอร์ท 1'),
    person('A023', 'confirmed', 60, 120, 'ก๊วนเย็น', COURT, 'คอร์ท 3'),
    person('A024', 'confirmed', 75, 60, 'ข้าว', COURT, 'คอร์ท 2'),
    person('A025', 'confirmed', 120, 60, 'เจ', COURT, 'คอร์ท 4'),
  ],
  extraSchedule: [person('A018', 'completed', -105, 60, 'นิว', COURT, 'คอร์ท 1'), person('A019', 'completed', -60, 60, 'มะลิ', COURT, 'คอร์ท 2')],
});

const restaurantRoute = (): Scene => ({
  shopName: 'ครัวยายเพลิน',
  branchName: 'สาขาอารีย์',
  template: 'route',
  theme: 'day_chili',
  announcement: 'วันนี้มีแกงส้มชะอมกุ้ง เมนูพิเศษถึงเย็นนี้',
  serviceDone: 26,
  resources: ['โต๊ะ 1', 'โต๊ะ 2', 'โต๊ะ 3', 'โต๊ะ 4'],
  calling: [person('B031', 'called', 0, 60, 'มะลิ', 'โต๊ะ 4 ที่นั่ง', 'โต๊ะ 3')],
  waiting: [
    person('B032', 'waiting', 15, 60, 'ภูมิ', 'โต๊ะ 2 ที่นั่ง', null),
    person('B033', 'waiting', 30, 60, 'ฟ้า', 'โต๊ะ 4 ที่นั่ง', null),
    person('B034', 'waiting', 30, 60, 'ต้น', 'โต๊ะ 2 ที่นั่ง', null),
    person('B035', 'waiting', 45, 60, 'ข้าว', 'โต๊ะ 6 ที่นั่ง', null),
    person('B036', 'waiting', 60, 60, 'เจ', 'โต๊ะ 2 ที่นั่ง', null),
    person('B037', 'waiting', 90, 60, 'นิว', 'โต๊ะ 4 ที่นั่ง', null),
  ],
});

const nailFloor = (): Scene => ({
  shopName: 'ลิตเติลเนล สตูดิโอ',
  branchName: 'สาขาทองหล่อ',
  template: 'floor',
  theme: 'day_rose',
  serviceDone: 9,
  resources: ['โต๊ะเล็บ 1', 'โต๊ะเล็บ 2', 'โต๊ะเล็บ 3', 'โต๊ะเล็บ 4', 'เตียงสปา 1', 'เตียงสปา 2', 'เตียงขนตา 1', 'เตียงขนตา 2'],
  calling: [
    person('A009', 'called', 0, 60, 'ฟ้า', 'ทาสีเจลมือ', 'เตียงสปา 1'),
    person('A006', 'serving', -30, 90, 'มะลิ', 'ต่อเล็บ PVC', 'โต๊ะเล็บ 1'),
    person('A007', 'serving', -15, 60, 'เจ', 'ทาสีเจลมือ', 'โต๊ะเล็บ 3'),
    person('A008', 'serving', -15, 120, 'ข้าว', 'ต่อขนตา', 'เตียงขนตา 2'),
  ],
  waiting: [
    person('A010', 'waiting', 15, 60, 'ภูมิ', 'สปาเท้า', null),
    person('A011', 'waiting', 30, 60, 'ต้น', 'ทาสีเจลมือ', null),
    person('A012', 'waiting', 45, 60, 'นิว', 'ต่อเล็บ PVC', null),
  ],
});

const invitePoster = (): Scene => ({
  shopName: 'คลินิกผิวใสสบายใจ',
  branchName: 'สาขาพระราม 9',
  template: 'invite',
  theme: 'day_teal',
  showQr: true,
  serviceDone: 7,
  resources: ['ห้องตรวจ 1', 'ห้องตรวจ 2'],
  calling: [],
  waiting: [],
});

const clinicFlap = (): Scene => ({
  shopName: 'คลินิกหมอใจดี',
  branchName: 'สาขาลาดพร้าว',
  template: 'flap',
  theme: 'midnight',
  serviceDone: 21,
  resources: ['ห้องตรวจ 1', 'ห้องตรวจ 2', 'ห้องตรวจ 3'],
  calling: [
    person('C042', 'called', 0, 30, 'มะลิ', 'ตรวจทั่วไป', 'ห้องตรวจ 2'),
    person('C041', 'serving', -15, 30, 'ภูมิ', 'ตรวจทั่วไป', 'ห้องตรวจ 1'),
    person('C040', 'serving', -15, 30, 'ฟ้า', 'ทำแผล', 'ห้องตรวจ 3'),
  ],
  waiting: [
    person('C043', 'waiting', 15, 30, 'ต้น', 'ตรวจทั่วไป', null),
    person('C044', 'waiting', 30, 30, 'ข้าว', 'ฉีดวัคซีน', null),
    person('C045', 'waiting', 45, 30, 'เจ', 'ตรวจทั่วไป', null),
    person('C046', 'waiting', 60, 30, 'นิว', 'ตรวจทั่วไป', null),
  ],
});

/**
 * One full-screen capture of the display page.
 * @param name Shot name.
 * @param scene Scene to show.
 * @param viewport Screen size.
 * @returns The shot.
 */
function display(name: string, scene: () => Scene, viewport: Viewport = TV): Shot {
  return { name, kind: 'display', path: '/display/{shopKey}', viewport, dir: DIR, fixedTime: CAPTURE_TIME, routes: { [DISPLAY_FEED]: feed(scene) } };
}

export const SIGNAGE_SCENES: Shot[] = [
  display('scene-cover', restaurantLine),
  display('scene-lane-before', () => barberLine(false)),
  display('scene-lane-after', () => barberLine(true)),
  display('scene-timeline', () => courtTimeline('landscape')),
  display('scene-route', restaurantRoute),
  display('scene-floor', nailFloor),
  display('scene-invite', invitePoster),
  display('scene-flap', clinicFlap),
  display('scene-timeline-portrait', () => courtTimeline('portrait'), TV_PORTRAIT),
];
