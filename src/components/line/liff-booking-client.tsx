'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Divider,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { formatThaiPhone, isCompleteThaiPhone, normalizeThaiPhoneDigits } from '@/lib/utils/thai-phone';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import HowToRegRoundedIcon from '@mui/icons-material/HowToRegRounded';
import MapRoundedIcon from '@mui/icons-material/MapRounded';
import HourglassTopRoundedIcon from '@mui/icons-material/HourglassTopRounded';
import EventBusyRoundedIcon from '@mui/icons-material/EventBusyRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import PhoneRoundedIcon from '@mui/icons-material/PhoneRounded';
import TagFacesRoundedIcon from '@mui/icons-material/TagFacesRounded';
import { useToast } from '@/components/ui/toast';
import { StatusChip } from '@/components/shared/status-chip';
import { formatDateDMY, getTodayISOInBangkok } from '@/lib/utils/date-format';
import { isPersonResourceType, resourceTypeIcon, resourceTypeLabel } from '@/lib/booking/resource-types';
import { filterResourcesForService } from '@/lib/booking/resource-service-link';
import { resourceHistoryBadge, sortResourcesByHistory, summarizeResourceHistory } from '@/lib/booking/resource-history';
import { NICKNAME_MAX } from '@/lib/booking/customer-label';
import { buildBookingEchoText } from '@/lib/line/booking-echo';
import { CUSTOMER_CANCELLABLE_STATUSES, checkInEligibility } from '@/lib/booking/status-flow';
import { FNB_ORDERABLE_BOOKING_STATUSES } from '@/lib/fnb/schemas';
import { LiffFnbOrderSheet } from '@/components/line/liff-fnb-order-sheet';
import { DAILY_LIMIT_CODE, dailyLimitMessage, findSameDayBooking } from '@/lib/booking/daily-limit';
import { BOOKING_WINDOW_CODE } from '@/lib/booking/booking-window';
import { firstBookableDay, isDayBookable, type BookableDayRules } from '@/lib/booking/bookable-days';
import { LiffDateCalendar } from '@/components/line/liff-date-calendar';
import { bangkokTimeOf, isoToBangkokLocalDate, isReleased, NOT_RELEASED_CODE, releaseCountdown, releaseJitterMs } from '@/lib/booking/booking-release';
import { fetchJsonWithBusyRetry } from '@/lib/line/liff-fetch';
import { SLOT_FULL_CODE } from '@/lib/booking/slot-capacity';
import { MAX_SLOTS_PER_ORDER, MULTI_PICK_INVALID_CODE, MULTI_SLOT_UNAVAILABLE_CODE, toggleSlotPick } from '@/lib/booking/multi-slot';
import { LiffPaymentPanel, openBankDeeplink } from '@/components/line/liff-payment-panel';
import { paymentResumeKind, pickLinkedPaymentTarget, readLinkedBookingId } from '@/lib/line/liff-payment-link';
import {
  KeyValueList,
  LiffEmpty,
  LiffLabel,
  LiffSection,
  LiffShell,
  LiffSkeleton,
  LiffStepper,
  LiffGalleryDialog,
  OptionCard,
  SlotButton,
  brandGradient,
  brandSoft,
} from '@/components/line/liff-ui';
import type { PaymentMethod } from '@/types/db';
import { BankGrid } from '@/components/line/bank-grid';
import { isBankAppMethod, isMobileBankingAmountOk } from '@/lib/payments/mobile-banking/banks';
import { isAwaitingPayment } from '@/lib/payments/payment-hold';

/** Idempotency key for one press of "ยืนยันจอง". */
function newAttemptKey(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    // fall through
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

type Branch = {
  id: string;
  branch_name: string;
  /** Venue map, so the customer can see where each court / room sits. */
  layout_image_url?: string | null;
  /** Last bookable date of this branch (server-resolved, Bangkok); null = unlimited. */
  max_booking_date?: string | null;
  /** First bookable date when later than today (server-resolved, Bangkok); null = from today. */
  min_booking_date?: string | null;
  /** Moment booking opens (waiting room before it); null = always open. */
  booking_release_at?: string | null;
};
type Service = {
  id: string;
  service_name: string;
  duration_minutes: number;
  price?: number | null;
  image_url?: string | null;
  /** `flexible_duration` lets the customer book several consecutive slots (see multi-slot.ts). */
  booking_mode?: string | null;
  min_duration_minutes?: number | null;
  max_duration_minutes?: number | null;
};
type Resource = {
  id: string;
  branch_id?: string | null;
  resource_name: string;
  resource_code?: string | null;
  resource_type?: string | null;
  capacity?: number | null;
  unit_price?: number | null;
  /** Services this resource serves; empty / null = every service. */
  service_ids?: string[] | null;
  /** Photos, first = cover. */
  image_urls?: string[] | null;
  floor?: string | null;
  zone?: string | null;
  description?: string | null;
};
type Slot = {
  slot_time: string;
  /** Seats the slot can take; 0 remaining = full but still listed. */
  capacity: number;
  booked_count: number;
  remaining_capacity: number;
  /** Already started (server clock, Bangkok); greyed out as "ผ่านแล้ว". */
  is_past?: boolean;
};
type SlotMeta = {
  reason: 'ok' | 'holiday' | 'closed' | 'full' | 'beyond_window' | 'before_window';
  hint?: string;
  /** First bookable date of the branch when later than today; floors the date picker. */
  min_date?: string | null;
  /** Last bookable date of the branch; caps the date picker. */
  max_date?: string | null;
  /** Slots with room left and not yet started; 0 with a non-empty grid = nothing bookable. */
  open_slots?: number;
  /** Bangkok date from the server; floors the date picker. */
  today?: string;
};
type ShopMeta = {
  id: string;
  name: string;
  shop_key: string;
  liff_id?: string | null;
  liff_id_login_shop?: string | null;
  /** Off when the shop does not want an echo message in the customer's chat. */
  booking_echo_enabled?: boolean;
  /** Off when the shop hides service duration from customers. */
  show_service_duration?: boolean;
  /** On when the shop allows each customer one booking per day (any service). */
  one_booking_per_day?: boolean;
  /** On when the shop allows several consecutive slots in one booking (default off). */
  multi_slot_enabled?: boolean;
  /** On when the shop lets checked-in customers order food and drinks (plan + owner switch). */
  fnb_enabled?: boolean;
};
type MyBooking = {
  id: string;
  queue_number: string;
  booking_date: string;
  start_time: string;
  status: string;
  note?: string | null;
  resource_id?: string | null;
  resource_name?: string | null;
  branches?: { branch_name?: string } | null;
  services?: { service_name?: string } | null;
  payment_status?: string | null;
  payment_method?: string | null;
  payment_amount?: number | null;
  bank_provider?: string | null;
  change_notified_at?: string | null;
  change_acknowledged_at?: string | null;
  checked_in_at?: string | null;
  called_at?: string | null;
};

/** True while the shop changed this booking and the customer has not tapped "รับทราบ" yet. */
function isChangeAckPending(b: MyBooking): boolean {
  if (!b.change_notified_at) return false;
  if (!b.change_acknowledged_at) return true;
  return new Date(b.change_acknowledged_at).getTime() < new Date(b.change_notified_at).getTime();
}

type ShopPaymentMeta = {
  methods: PaymentMethod[];
  promptpay_display_name: string | null;
  promptpay_masked: string | null;
  /** Banks offered for in-app payment; one picker button each. */
  deeplink_banks?: Array<{ provider: string; display_name: string }>;
  /** Bank apps offered through Omise Mobile Banking; shown as a grid under one picker card. */
  mobile_banking_banks?: Array<{ code: string; name: string }>;
};

/** One button in the payment method picker. */
type PaymentOption = {
  key: string;
  method: PaymentMethod;
  bank?: string;
  label: string;
};

/** Result of a completed booking, kept so the success screen can host payment. */
type BookingResult = {
  booking_id: string;
  queue_number: string;
  payment_method: string | null;
  /** `pending_approval` when the service needs the shop to confirm first, or while the order waits for payment. */
  status?: string | null;
  /** True when the queue is held until paid and lapses at the payment deadline. */
  awaiting_payment?: boolean;
};

/** Methods where the customer still has something to do after booking. */
const ON_SCREEN_PAYMENT_METHODS = new Set(['bank_transfer', 'bank_deeplink', 'omise_mobile_banking']);

/** localStorage key holding a booking whose payment is still unfinished. */
const pendingPaymentKey = (shopKey: string) => `queue.pendingPayment.${shopKey}`;
const PENDING_PAYMENT_TTL_MS = 48 * 3600 * 1000;

type ServiceKind = 'barber' | 'nail' | 'clinic' | 'buffet' | 'meeting' | 'default';
type ServiceCardMeta = { icon: string; subtitle: string };

type LiffProfile = { userId: string; displayName: string; pictureUrl?: string };

/** What `/api/public/shop/[shopKey]/me` returns under `data`. */
type MePayload = {
  customer?: { id: string; full_name?: string | null; phone?: string | null; nickname?: string | null } | null;
  /** True when this call created the customer record — first visit to the shop. */
  was_registered?: boolean;
  today?: string;
  upcoming?: MyBooking[];
  history?: MyBooking[];
};

type LiffApi = {
  init: (x: { liffId: string }) => Promise<void>;
  isLoggedIn: () => boolean;
  isInClient?: () => boolean;
  login: () => void;
  closeWindow?: () => void;
  /** `external: true` hands the URL to the system browser — needed for bank app schemes. */
  openWindow?: (params: { url: string; external?: boolean }) => void;
  getOS?: () => 'ios' | 'android' | 'web';
  sendMessages?: (messages: object[]) => Promise<void>;
  getProfile: () => Promise<LiffProfile>;
  getIDToken?: () => string | null;
};

function normalizeLiffId(input?: string | null): string {
  if (!input) return '';
  const raw = input.trim();
  const m = raw.match(/liff\.line\.me\/([^/?#]+)/);
  return m?.[1] ?? raw;
}

function isLikelyLiffId(v: string) {
  return /^[0-9]{6,}-[A-Za-z0-9_-]{4,}$/.test(v.trim());
}

function resolveLiffId(shopLiffId?: string | null) {
  const fromShop = normalizeLiffId(shopLiffId);
  if (isLikelyLiffId(fromShop)) return fromShop;
  const fromEnv = normalizeLiffId(process.env.NEXT_PUBLIC_LIFF_ID);
  if (isLikelyLiffId(fromEnv)) return fromEnv;
  return '';
}

function buildLiffOpenUrl(liffId: string, shopKey: string, tab: 'booking' | 'account', bookingId?: string | null) {
  const params = new URLSearchParams({ shop_key: shopKey, tab });
  if (bookingId) params.set('booking_id', bookingId);
  return `https://liff.line.me/${encodeURIComponent(liffId)}?${params.toString()}`;
}

function formatPrice(value?: number | null) {
  const n = Number(value ?? 0);
  return n > 0 ? `${n.toLocaleString('th-TH')} บาท` : '';
}

function getLiffCandidates(shopLiffId?: string | null, shopLoginLiffId?: string | null, initialTab: 'booking' | 'account' = 'booking') {
  const fromShop = normalizeLiffId(shopLiffId);
  const fromShopLogin = normalizeLiffId(shopLoginLiffId);
  const fromEnv = normalizeLiffId(process.env.NEXT_PUBLIC_LIFF_ID);
  const fromMemberEnv = normalizeLiffId(process.env.NEXT_PUBLIC_LIFF_MEMBER_ID);
  const fromBookingEnv = normalizeLiffId(process.env.NEXT_PUBLIC_LIFF_BOOKING_ID);

  const ordered =
    initialTab === 'account'
      ? [fromShopLogin, fromShop, fromMemberEnv, fromEnv, fromBookingEnv]
      : [fromShop, fromShopLogin, fromBookingEnv, fromEnv, fromMemberEnv];

  const all = ordered.filter((v) => isLikelyLiffId(v));
  return Array.from(new Set(all));
}

async function ensureLiffLoaded(): Promise<LiffApi | null> {
  const w = window as Window & { liff?: LiffApi };
  if (w.liff) return w.liff;

  const existed = document.querySelector('script[data-liff-sdk="1"]') as HTMLScriptElement | null;
  if (!existed) {
    const s = document.createElement('script');
    s.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js';
    s.async = true;
    s.dataset.liffSdk = '1';
    document.head.appendChild(s);
    await new Promise<void>((resolve, reject) => {
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Unable to load LIFF SDK'));
    });
  } else if (!(window as Window & { liff?: LiffApi }).liff) {
    await new Promise((r) => setTimeout(r, 300));
  }

  return (window as Window & { liff?: LiffApi }).liff ?? null;
}

/**
 * "A1 - ช่างเอก" when the shop set a code; just the name when the code is empty
 * or merely repeats the type label (some shops type "เทรนเนอร์" into the code field).
 */
function resourceDisplayName(r: Resource): string {
  const code = (r.resource_code ?? '').trim();
  if (!code || code === resourceTypeLabel(r.resource_type) || code === r.resource_name.trim()) return r.resource_name;
  return `${code} - ${r.resource_name}`;
}

/** Leading tile for a payment option: bank initials for deeplinks, an emoji otherwise. */
function paymentOptionIcon(option: PaymentOption): React.ReactNode {
  if (option.method === 'bank_deeplink') {
    const short = (option.bank ?? '').replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase() || 'BK';
    return <Box component="span" sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.02em' }}>{short}</Box>;
  }
  if (option.method === 'omise_mobile_banking') return '🏦';
  if (option.method === 'bank_transfer') return '🧾';
  return '📱';
}

/** Second line of a payment option, describing how it gets confirmed. */
function paymentOptionSubtitle(option: PaymentOption) {
  if (option.method === 'bank_deeplink') return 'เปิดแอปธนาคาร ยืนยันอัตโนมัติ';
  if (option.method === 'omise_mobile_banking') return 'เลือกธนาคาร เปิดแอป ยอดล็อกไว้ ยืนยันอัตโนมัติ';
  if (option.method === 'bank_transfer') return 'สแกน QR แล้วอัปโหลดสลิป';
  return 'ชำระผ่าน QR ยืนยันอัตโนมัติ';
}

function detectServiceKind(serviceName?: string): ServiceKind {
  const name = (serviceName || '').toLowerCase();
  if (name.includes('ตัดผม') || name.includes('สระ') || name.includes('barber')) return 'barber';
  if (name.includes('เล็บ') || name.includes('nail')) return 'nail';
  if (name.includes('คลินิก') || name.includes('แพทย์') || name.includes('ตรวจ')) return 'clinic';
  if (name.includes('บุฟเฟ่ต์') || name.includes('walk-in') || name.includes('โต๊ะ')) return 'buffet';
  if (name.includes('ห้องประชุม') || name.includes('meeting')) return 'meeting';
  return 'default';
}

function serviceMeta(s: Service): ServiceCardMeta {
  const kind = detectServiceKind(s.service_name);
  if (kind === 'barber') return { icon: '💈', subtitle: 'จองตามเวลาที่เลือกเอง' };
  if (kind === 'nail') return { icon: '💅', subtitle: 'เวลาบริการยืดหยุ่น' };
  if (kind === 'clinic') return { icon: '🩺', subtitle: 'จองตามเวลาที่นัดหมาย' };
  if (kind === 'buffet') return { icon: '🍽️', subtitle: s.service_name.toLowerCase().includes('walk') ? 'Walk-in' : 'รับจำนวนตามรอบ' };
  if (kind === 'meeting') return { icon: '🏢', subtitle: 'จองรายชั่วโมง/ครึ่งวัน' };
  return { icon: '📌', subtitle: 'เลือกบริการที่ต้องการ' };
}

/**
 * What to call the resource picker. The resource's own type is the reliable
 * answer ("เทรนเนอร์", "ห้องประชุม"); the service name is only a fallback for
 * shops that never set a meaningful type.
 */
/** "ชั้น 2 • โซน Outdoor" — where the resource is, or '' when the shop left both blank. */
function resourceLocationText(r: Pick<Resource, 'floor' | 'zone'>): string {
  return [r.floor ? `ชั้น ${r.floor}` : '', r.zone ? `โซน ${r.zone}` : ''].filter(Boolean).join(' • ');
}

function resourcePickerLabel(resourceType?: string | null, serviceName?: string) {
  if (resourceType) return `เลือก${resourceTypeLabel(resourceType)}`;
  const kind = detectServiceKind(serviceName);
  if (kind === 'barber' || kind === 'nail') return 'เลือกช่าง';
  if (kind === 'meeting') return 'เลือกห้อง';
  if (kind === 'buffet') return 'เลือกโต๊ะ';
  return 'เลือกผู้ให้บริการ';
}

export function LiffBookingClient({ shopKey, initialTab = 'booking' }: { shopKey: string; initialTab?: 'booking' | 'account' }) {
  const { push } = useToast();
  const theme = useTheme();

  const [shop, setShop] = useState<ShopMeta | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [branchId, setBranchId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [selectedResourceId, setSelectedResourceId] = useState('');
  /** Resource whose photos are open in the gallery; '' = closed. */
  const [galleryResourceId, setGalleryResourceId] = useState('');
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [date, setDate] = useState(getTodayISOInBangkok());
  /** Server clock minus device clock, so the release countdown ignores a wrong phone clock. */
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  /** False during the random pause right after release (spreads the crowd's first load). */
  const [releaseJitterDone, setReleaseJitterDone] = useState(true);
  /** One per press of "ยืนยันจอง"; reused by automatic retries so a retry never books twice. */
  const bookAttemptKey = useRef('');
  /** Which days the calendar may show for the chosen branch; null until loaded. */
  const [dayRules, setDayRules] = useState<BookableDayRules | null>(null);
  /** Rules failed to load — the native date input takes over so booking still works. */
  const [dayRulesFailed, setDayRulesFailed] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotHint, setSlotHint] = useState('');
  const [slotMeta, setSlotMeta] = useState<SlotMeta>({ reason: 'ok' });
  const [selectedTime, setSelectedTime] = useState('');
  /**
   * Further start times picked with `selectedTime` (sorted, `selectedTime` is
   * always the earliest). One queue per time; only when the shop allows it.
   */
  const [extraTimes, setExtraTimes] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerNickname, setCustomerNickname] = useState('');
  const [lineUserId, setLineUserId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [pictureUrl, setPictureUrl] = useState('');
  const [liffIdToken, setLiffIdToken] = useState('');
  const [queueNo, setQueueNo] = useState('');
  const [bookingResult, setBookingResult] = useState<BookingResult | null>(null);
  const [shopPayment, setShopPayment] = useState<ShopPaymentMeta | null>(null);
  const [chosenMethod, setChosenMethod] = useState<PaymentMethod | ''>('');
  const [chosenBank, setChosenBank] = useState('');
  // Bank apps only exist on phones; assume mobile until the browser says otherwise
  // so the first paint in LINE does not flash without the bank buttons.
  const [isMobileLike, setIsMobileLike] = useState(true);
  const [resumeBooking, setResumeBooking] = useState<BookingResult | null>(null);
  const [loading, setLoading] = useState(false);
  /** Only the booking submit, so a slot reload (or its busy retries) never reads as "กำลังบันทึก". */
  const [submitting, setSubmitting] = useState(false);
  const [memberReady, setMemberReady] = useState(false);
  const [memberStatus, setMemberStatus] = useState<'idle' | 'checking' | 'ready' | 'error'>('idle');
  const [memberError, setMemberError] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [tab, setTab] = useState<'booking' | 'account'>(initialTab);
  const [upcoming, setUpcoming] = useState<MyBooking[]>([]);
  const [history, setHistory] = useState<MyBooking[]>([]);
  const [accountLoading, setAccountLoading] = useState(false);
  /** Bangkok date from the server; the check-in button only shows on the booking day. */
  const [todayIso, setTodayIso] = useState('');
  const [checkingIn, setCheckingIn] = useState('');
  /** Booking whose food-order sheet is open; '' = closed. */
  const [orderingFor, setOrderingFor] = useState('');
  /** Why the last `/me` call failed, so the member-check error can say it instead of a generic line. */
  const meErrorRef = useRef('');
  const [liffOpenUrl, setLiffOpenUrl] = useState('');
  const [resolvedLiffId, setResolvedLiffId] = useState('');
  const [shopMetaError, setShopMetaError] = useState('');

  // Duration drives slot generation but is internal for some shops — they turn
  // it off in the portal Services page. Unset means visible.
  const showDuration = shop?.show_service_duration !== false;

  /**
   * Booking this customer already holds on the chosen day when the shop limits
   * customers to one per day. `upcoming` only has live statuses, `history` has
   * the completed ones — the rule counts both. The server enforces it too; this
   * only greys the button early so the customer is not surprised at the end.
   */
  const sameDayBooking = useMemo(
    () => (shop?.one_booking_per_day && date ? findSameDayBooking([...upcoming, ...history], date) : null),
    [shop?.one_booking_per_day, date, upcoming, history],
  );

  const releaseAt = branches.find((b) => b.id === branchId)?.booking_release_at ?? null;
  const waitingForRelease = Boolean(releaseAt) && !isReleased(releaseAt, nowMs + clockOffsetMs);
  /** Closed before the branch's release time: nothing is loaded or booked. */
  const bookingGateOpen = !waitingForRelease && releaseJitterDone;
  const canLoadSlots = branchId && serviceId && date && bookingGateOpen;
  const canBook =
    bookingGateOpen &&
    memberReady && !sameDayBooking && branchId && serviceId && date && selectedTime && customerName.trim().length >= 1 && isCompleteThaiPhone(customerPhone);

  /**
   * Why step 1 cannot be left yet, or '' when it can. A silently dead button
   * gave the customer nothing to act on and support nothing to go on.
   * While the member check is running or failed, `memberBlock` already says
   * so at the top of the step — repeating it here showed the same
   * "กำลังตรวจสอบสมาชิก" twice on one screen, so those states stay silent.
   */
  const nextBlockedReason =
    memberStatus === 'checking' || memberStatus === 'error'
      ? ''
      : memberStatus !== 'ready'
        ? 'กำลังตรวจสอบสมาชิกของร้าน กรุณารอสักครู่'
        : !customerName.trim()
          ? 'กรุณากรอกชื่อผู้จอง'
          : !isCompleteThaiPhone(customerPhone)
            ? 'กรุณากรอกเบอร์โทร 10 หลัก'
            : '';
  const nextBlocked = memberStatus !== 'ready' || Boolean(nextBlockedReason);

  /**
   * The LIFF ID token the server verifies to know who is calling. Read live
   * from the SDK (it refreshes the cached token) and fall back to the copy
   * taken at init. '' outside LINE.
   */
  function currentIdToken(): string {
    try {
      const liff = (window as Window & { liff?: LiffApi }).liff;
      return liff?.getIDToken?.() || liffIdToken || '';
    } catch {
      return liffIdToken || '';
    }
  }

  /**
   * Fetch (or save) the customer's record and queues. `profile` lets the LIFF
   * init call this straight after `liff.getProfile()`, before the ids have
   * landed in state — otherwise the call reads the ids from state.
   * @returns The `/me` payload, or `null` when the request failed (already toasted).
   */
  async function loadMe(opts?: { mode?: 'view' | 'update'; profile?: LiffProfile }): Promise<MePayload | null> {
    const userId = opts?.profile?.userId ?? lineUserId;
    if (!userId) return null;
    setAccountLoading(true);
    const res = await fetch(`/api/public/shop/${shopKey}/me`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        line_user_id: userId,
        id_token: currentIdToken() || undefined,
        display_name: (opts?.profile?.displayName ?? displayName) || undefined,
        picture_url: (opts?.profile?.pictureUrl ?? pictureUrl) || undefined,
        full_name: customerName || undefined,
        phone: customerPhone || undefined,
        // Sent only on save: '' means the customer cleared it on purpose.
        nickname: opts?.mode === 'update' ? customerNickname : undefined,
        mode: opts?.mode ?? 'view',
      }),
    });
    const json = await res.json().catch(() => ({}));
    setAccountLoading(false);
    if (!res.ok) {
      meErrorRef.current = `${json.error ?? 'โหลดข้อมูลสมาชิกไม่สำเร็จ'} (รหัส ${res.status})`;
      push(json.error ?? 'โหลดข้อมูลสมาชิกไม่สำเร็จ', 'error');
      return null;
    }
    meErrorRef.current = '';
    // A plain view must never overwrite what the customer is typing — this runs
    // after booking and on the account tab, so a late response would otherwise
    // clobber the form. On an explicit save the server's copy is the truth.
    const isUpdate = (opts?.mode ?? 'view') === 'update';
    if (json.data?.customer?.full_name) {
      setCustomerName((prev) => (!isUpdate && prev.trim() ? prev : json.data.customer.full_name));
    }
    if (json.data?.customer?.phone) {
      setCustomerPhone((prev) => (!isUpdate && prev.trim() ? prev : normalizeThaiPhoneDigits(json.data.customer.phone ?? '')));
    }
    if (typeof json.data?.customer?.nickname === 'string' || isUpdate) {
      setCustomerNickname((prev) => (!isUpdate && prev.trim() ? prev : json.data?.customer?.nickname ?? ''));
    }
    setUpcoming(json.data?.upcoming ?? []);
    setHistory(json.data?.history ?? []);
    if (typeof json.data?.today === 'string') setTodayIso(json.data.today);
    return (json.data ?? null) as MePayload | null;
  }

  useEffect(() => {
    void (async () => {
      setShopMetaError('');
      try {
        const res = await fetch(`/api/public/shop/${encodeURIComponent(shopKey)}/meta`, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) {
          const msg = json.error ?? 'โหลดข้อมูลร้านไม่สำเร็จ';
          setShopMetaError(msg);
          return push(msg, 'error');
        }
        setShop(json.data.shop ?? null);
        setBranches(json.data.branches ?? []);
        setServices(json.data.services ?? []);
        setResources(json.data.resources ?? []);
        setShopPayment((json.data.payment ?? null) as ShopPaymentMeta | null);
        if (json.data.branches?.[0]) setBranchId(json.data.branches[0].id);
        if (json.data.services?.[0]) setServiceId(json.data.services[0].id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Network error';
        setShopMetaError(msg);
        push(`โหลดข้อมูลร้านไม่สำเร็จ: ${msg}`, 'error');
      }
    })();
  }, [shopKey, push]);

  useEffect(() => {
    if (!shop) return;

    void (async () => {
      setMemberStatus('checking');
      setMemberError('');
      try {
        const liffCandidates = getLiffCandidates(shop.liff_id, shop.liff_id_login_shop, initialTab);
        setResolvedLiffId(liffCandidates[0] ?? '');
        if (!liffCandidates.length) {
          push('LIFF ID ไม่ถูกต้องหรือยังไม่ได้ตั้งค่าในร้าน/ENV', 'error');
          setMemberStatus('error');
          setMemberError('LIFF ID ไม่ถูกต้องหรือยังไม่ได้ตั้งค่าในร้าน/ENV');
          return;
        }

        const liff = await ensureLiffLoaded();
        if (!liff) {
          push('โหลด LIFF SDK ไม่สำเร็จ', 'error');
          setMemberStatus('error');
          setMemberError('โหลด LIFF SDK ไม่สำเร็จ');
          return;
        }

        let activeLiffId = '';
        let lastInitError: Error | null = null;
        for (const candidate of liffCandidates) {
          try {
            await Promise.race([
              liff.init({ liffId: candidate }),
              new Promise((_, reject) => setTimeout(() => reject(new Error('LIFF init timeout')), 12000)),
            ]);
            activeLiffId = candidate;
            setResolvedLiffId(candidate);
            lastInitError = null;
            break;
          } catch (e) {
            lastInitError = e instanceof Error ? e : new Error('LIFF init failed');
          }
        }
        if (!activeLiffId) throw (lastInitError ?? new Error('invalid liff id'));

        if (!liff.isLoggedIn()) {
          const openUrl = buildLiffOpenUrl(activeLiffId, shopKey, initialTab, readLinkedBookingId(window.location.search));
          setLiffOpenUrl(openUrl);
          setMemberStatus('error');
          setMemberError('กรุณาเปิดหน้านี้ผ่าน LINE LIFF');
          if (typeof window !== 'undefined' && liff.isInClient?.()) {
            liff.login();
          } else if (typeof window !== 'undefined') {
            // Opened as a plain web link (old Flex buttons used `${APP_URL}/liff/...`),
            // e.g. LINE's in-app browser: hand over to liff.line.me so LINE opens
            // the real LIFF app. Once per tab session so a failed login cannot loop.
            const guardKey = `liff-reopen:${shopKey}:${initialTab}`;
            let alreadyTried = true;
            try {
              alreadyTried = window.sessionStorage.getItem(guardKey) === '1';
              if (!alreadyTried) window.sessionStorage.setItem(guardKey, '1');
            } catch { /* storage blocked — keep the manual "เปิดผ่าน LINE" button */ }
            if (!alreadyTried) window.location.replace(openUrl);
          }
          return;
        }

        const profile = await liff.getProfile();
        try { setLiffIdToken(liff.getIDToken?.() ?? ''); } catch { /* token unavailable outside LINE */ }
        setLineUserId(profile.userId);
        setDisplayName(profile.displayName);
        setPictureUrl(profile.pictureUrl ?? '');

        // One round trip registers the member and brings back their record and
        // queues. It used to be member-context followed by /me, which wrote the
        // LINE user twice and repainted the form and queue list twice.
        const me = await loadMe({ profile });
        if (!me) {
          setMemberStatus('error');
          setMemberError(meErrorRef.current ? `ตรวจสอบสมาชิกไม่สำเร็จ: ${meErrorRef.current}` : 'ตรวจสอบสมาชิกไม่สำเร็จ');
          return;
        }

        // Prefill only into an empty name: what the customer already typed
        // wins, then the name they saved with the shop, then the LINE name.
        // Phone and nickname are prefilled by loadMe under the same rule.
        setCustomerName((prev) => (prev.trim() ? prev : me.customer?.full_name || profile.displayName));
        if (me.was_registered) push('สมัครสมาชิกกับร้านสำเร็จแล้ว กรุณายืนยันข้อมูลก่อนจองคิว', 'success');

        // Arrived from a payment Flex button ("อัปโหลดสลิป"): open that queue's
        // payment panel straight away — only when it is the caller's own queue
        // (from /me) and still owes a slip / bank-app payment; otherwise the
        // normal queue list shows. The id is dropped from the URL so a reload
        // after paying does not reopen it.
        const linkedId = readLinkedBookingId(window.location.search);
        if (linkedId) {
          const target = pickLinkedPaymentTarget(linkedId, me.upcoming ?? []);
          if (target) {
            setTab('account');
            setResumeBooking(target);
          }
          try {
            const url = new URL(window.location.href);
            url.searchParams.delete('booking_id');
            window.history.replaceState(window.history.state, '', url.toString());
          } catch { /* keep the URL as is */ }
        }
        setMemberReady(true);
        setMemberStatus('ready');
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'LIFF init failed';
        push(msg, 'error');
        setMemberStatus('error');
        setMemberError(msg);
      }
    })();
    // customerName must stay out of this list: with it, every keystroke in the
    // name field re-ran LIFF init and /me, and the late response overwrote
    // what was being typed — including after the customer had already moved
    // to step 2, where the name field is not on screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop, push, shopKey, initialTab]);

  function retryMemberCheck() {
    setMemberReady(false);
    setMemberStatus('idle');
    setMemberError('');
    // trigger by cloning object reference
    setShop((prev) => (prev ? { ...prev } : prev));
  }

  async function loadSlots() {
    if (!canLoadSlots) return;
    setLoading(true);
    setSlotHint('');
    setSlotMeta({ reason: 'ok' });
    setSelectedTime('');
    setExtraTimes([]);
    const params = new URLSearchParams({
      branch_id: branchId,
      service_id: serviceId, 
      date,
    });
    if (selectedResourceId) params.set('resource_id', selectedResourceId);
    const url = `/api/public/shop/${shopKey}/slots?${params.toString()}`;
    try {
      // Busy (429/503) waits and retries here — a page refresh would cost more.
      const { res, json } = await fetchJsonWithBusyRetry(url, undefined, {
        onWait: (seconds) => setSlotHint(`มีผู้ใช้งานจำนวนมาก กำลังลองใหม่ใน ${seconds} วินาที ไม่ต้องรีเฟรช`),
      });
      setLoading(false);
      if (!res.ok) {
        const msg = typeof json.error === 'string' ? json.error : 'โหลดคิวว่างไม่สำเร็จ';
        // Opened a moment early (device clock ahead): the countdown takes over.
        if (json.code === NOT_RELEASED_CODE) {
          setSlots([]);
          setSlotHint(msg);
          return;
        }
        setSlots([]);
        setSlotHint(msg);
        return push(msg, 'error');
      }
      const nextSlots = (json.data ?? []) as Slot[];
      setSlots(nextSlots);
      const nextMeta = (json.meta ?? { reason: 'ok' }) as SlotMeta;
      setSlotMeta(nextMeta);
      if (typeof nextMeta.today === 'string') setTodayIso(nextMeta.today);
      // A day where every slot is full still renders the grid (all greyed);
      // the "คิวเต็ม" alert from slotMeta carries the message, not a hint.
      if (nextSlots.length === 0 && nextMeta.reason === 'ok') {
        setSlotHint(nextMeta.hint || 'ไม่พบเวลาว่างในวันที่เลือก');
      }
    } catch {
      setLoading(false);
      setSlots([]);
      setSlotHint('โหลดคิวว่างไม่สำเร็จ กรุณาลองใหม่');
      setSlotMeta({ reason: 'full' });
    }
  }

  useEffect(() => {
    setSlots([]);
    setSelectedTime('');
    setExtraTimes([]);
    setSlotHint('');
    setSlotMeta({ reason: 'ok' });
  }, [branchId, serviceId, date, selectedResourceId]);

  // Days the calendar may show for this branch. A stale response (the customer
  // switched branch meanwhile) is dropped.
  useEffect(() => {
    if (!branchId) return;
    let cancelled = false;
    setDayRules(null);
    setDayRulesFailed(false);
    void (async () => {
      try {
        const res = await fetch(`/api/public/shop/${encodeURIComponent(shopKey)}/bookable-days?branch_id=${encodeURIComponent(branchId)}`, { cache: 'no-store' });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok || !json.data) return setDayRulesFailed(true);
        const rules: BookableDayRules = {
          today: String(json.data.today),
          minDate: json.data.min_date ?? null,
          maxDate: json.data.max_date ?? null,
          openWeekdays: json.data.open_weekdays ?? [],
          holidays: json.data.holidays ?? [],
        };
        setDayRules(rules);
        setTodayIso(rules.today);
        // Never leave a day selected that the calendar does not show.
        setDate((prev) => (isDayBookable(prev, rules) ? prev : firstBookableDay(rules) ?? ''));
      } catch {
        if (!cancelled) setDayRulesFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shopKey, branchId]);

  useEffect(() => {
    if (step !== 2 || !canLoadSlots) return;
    // Wait for the calendar rules: until then `date` may still be a day the
    // branch is closed, and its "ปิดทำการ" notice would flash on screen.
    if (!dayRules && !dayRulesFailed) return;
    void loadSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, branchId, serviceId, date, dayRules, dayRulesFailed, bookingGateOpen]);

  // A different order is a different attempt — never replay the previous one.
  useEffect(() => {
    bookAttemptKey.current = '';
  }, [branchId, serviceId, date, selectedTime, extraTimes, selectedResourceId]);

  // Server clock, once, when any branch still has a release ahead.
  const hasPendingRelease = branches.some((b) => b.booking_release_at && !isReleased(b.booking_release_at, Date.now()));
  useEffect(() => {
    if (!hasPendingRelease) return;
    let cancelled = false;
    void (async () => {
      try {
        const sentAt = Date.now();
        const res = await fetch('/api/public/time', { cache: 'no-store' });
        const json = (await res.json()) as { now?: number };
        const receivedAt = Date.now();
        if (!cancelled && typeof json.now === 'number') setClockOffsetMs(json.now + (receivedAt - sentAt) / 2 - receivedAt);
      } catch {
        // Device clock it is; the server still refuses early requests.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasPendingRelease]);

  // Countdown tick while the chosen branch waits for its release, then a short
  // random pause so every phone in the crowd does not load slots in the same second.
  useEffect(() => {
    if (!releaseAt || isReleased(releaseAt, Date.now() + clockOffsetMs)) {
      setReleaseJitterDone(true);
      return;
    }
    setReleaseJitterDone(false);
    let jitterTimer: ReturnType<typeof setTimeout> | undefined;
    const tick = setInterval(() => {
      const now = Date.now();
      setNowMs(now);
      if (isReleased(releaseAt, now + clockOffsetMs)) {
        clearInterval(tick);
        jitterTimer = setTimeout(() => setReleaseJitterDone(true), releaseJitterMs());
      }
    }, 1000);
    setNowMs(Date.now());
    return () => {
      clearInterval(tick);
      if (jitterTimer) clearTimeout(jitterTimer);
    };
  }, [releaseAt, clockOffsetMs]);

  // Restore an unfinished payment after a reload. Anything older than the TTL is
  // dropped rather than shown, since the invoice has almost certainly lapsed.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(pendingPaymentKey(shopKey));
      if (!raw) return;
      const saved = JSON.parse(raw) as BookingResult & { ts?: number };
      if (!saved.booking_id || Date.now() - (saved.ts ?? 0) > PENDING_PAYMENT_TTL_MS) {
        localStorage.removeItem(pendingPaymentKey(shopKey));
        return;
      }
      setResumeBooking({ booking_id: saved.booking_id, queue_number: saved.queue_number, payment_method: saved.payment_method ?? 'bank_transfer' });
    } catch {
      // ignore unreadable storage
    }
  }, [shopKey]);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    setIsMobileLike(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
  }, []);

  /** Clear the resume marker once the booking no longer owes money. */
  function clearPendingPayment() {
    try { localStorage.removeItem(pendingPaymentKey(shopKey)); } catch { /* ignore */ }
    setResumeBooking(null);
  }

  /**
   * The customer may tap several free slots (one queue each, any times) when
   * the shop turned on multi-slot booking — never with "one booking per day".
   */
  const multiPickEnabled = Boolean(shop?.multi_slot_enabled && !shop?.one_booking_per_day);
  /** Every picked start time, earliest first. */
  const pickedTimes = useMemo(() => (selectedTime ? [selectedTime, ...extraTimes] : []), [selectedTime, extraTimes]);

  /** Price the customer would pay, used to decide whether to show the method picker. */
  const effectivePrice = useMemo(() => {
    const resourcePrice = Number(selectedResourceId ? resources.find((r) => r.id === selectedResourceId)?.unit_price ?? 0 : 0);
    const servicePrice = Number(services.find((s) => s.id === serviceId)?.price ?? 0);
    // Price is per queue; a multi-pick order pays for all of them at once.
    return (resourcePrice > 0 ? resourcePrice : servicePrice) * Math.max(pickedTimes.length, 1);
  }, [selectedResourceId, resources, services, serviceId, pickedTimes.length]);

  /** Bank apps behind the Omise Mobile Banking card; the first is the default when the card is chosen. */
  const mobileBanks = useMemo(() => shopPayment?.mobile_banking_banks ?? [], [shopPayment]);

  /**
   * Picker buttons: `bank_deeplink` expands into one button per bank, and both
   * bank-app methods are dropped entirely on desktop where no bank app can
   * open. `omise_mobile_banking` is one card with a bank grid underneath, and
   * disappears when the price is outside Omise's limits.
   */
  const paymentOptions = useMemo<PaymentOption[]>(() => {
    const methods = shopPayment?.methods ?? [];
    const options: PaymentOption[] = [];
    for (const m of methods) {
      if (m === 'bank_deeplink') {
        if (!isMobileLike) continue;
        for (const bank of shopPayment?.deeplink_banks ?? []) {
          options.push({ key: `deeplink:${bank.provider}`, method: m, bank: bank.provider, label: `จ่ายผ่านแอป ${bank.display_name}` });
        }
      } else if (m === 'omise_mobile_banking') {
        if (!isMobileLike || mobileBanks.length === 0 || !isMobileBankingAmountOk(effectivePrice)) continue;
        options.push({ key: m, method: m, label: 'จ่ายผ่านแอปธนาคาร' });
      } else if (m === 'bank_transfer') {
        options.push({ key: m, method: m, label: 'โอนเงิน + แนบสลิป' });
      } else {
        options.push({ key: m, method: m, label: 'สแกน QR ชำระอัตโนมัติ' });
      }
    }
    return options;
  }, [shopPayment, isMobileLike, mobileBanks, effectivePrice]);
  const showMethodPicker = effectivePrice > 0 && paymentOptions.length > 1;
  const chosenOptionKey = chosenMethod === 'bank_deeplink' ? `deeplink:${chosenBank}` : chosenMethod;

  // With exactly one option there is nothing to choose — send it explicitly so
  // the server does not have to fall back. Also drop a choice that is no longer
  // offered (e.g. the bank buttons disappeared after mobile detection).
  useEffect(() => {
    if (paymentOptions.length === 1) {
      const only = paymentOptions[0];
      setChosenMethod(only.method);
      setChosenBank(only.bank ?? (only.method === 'omise_mobile_banking' ? mobileBanks[0]?.code ?? '' : ''));
      return;
    }
    if (paymentOptions.length === 0) {
      setChosenMethod('');
      setChosenBank('');
      return;
    }
    setChosenMethod((current) => {
      if (!current) return current;
      const stillOffered = paymentOptions.some((o) => o.method === current && (current !== 'bank_deeplink' || o.bank === chosenBank));
      return stillOffered ? current : '';
    });
  }, [paymentOptions, chosenBank, mobileBanks]);

  function chooseOption(option: PaymentOption) {
    setChosenMethod(option.method);
    if (option.method === 'omise_mobile_banking') {
      // Keep a bank the customer already picked from the grid; otherwise default to the first.
      setChosenBank((current) => (mobileBanks.some((b) => b.code === current) ? current : mobileBanks[0]?.code ?? ''));
      return;
    }
    setChosenBank(option.bank ?? '');
  }

  async function bookNow() {
    if (!canBook || loading) return;
    setLoading(true);
    setSubmitting(true);
    if (!bookAttemptKey.current) bookAttemptKey.current = newAttemptKey();
    let res: Response;
    let json: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    try {
      ({ res, json } = await fetchJsonWithBusyRetry(`/api/public/shop/${shopKey}/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branch_id: branchId,
        service_id: serviceId,
        booking_date: date,
        start_time: `${selectedTime}:00`,
        resource_id: selectedResourceId || undefined,
        start_times: pickedTimes.length > 1 ? pickedTimes.map((t) => `${t}:00`) : undefined,
        customer_name: customerName,
        customer_phone: customerPhone,
        nickname: customerNickname.trim() || undefined,
        line_user_id: lineUserId || undefined,
        id_token: lineUserId ? currentIdToken() || undefined : undefined,
        payment_method: chosenMethod || undefined,
        bank_provider: isBankAppMethod(chosenMethod) && chosenBank ? chosenBank : undefined,
        idempotency_key: bookAttemptKey.current,
      }),
      }, {
        // `busy` 409 = this same press is still being saved (an earlier retry).
        retryCodes: ['busy'],
        onWait: (seconds) => push(`มีผู้จองพร้อมกันจำนวนมาก กำลังลองใหม่ใน ${seconds} วินาที ไม่ต้องรีเฟรช`, 'info'),
      }));
    } catch {
      setLoading(false);
      setSubmitting(false);
      return push('เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', 'error');
    }
    setLoading(false);
    setSubmitting(false);
    // A final answer either way: the next press is a new attempt.
    bookAttemptKey.current = '';
    if (!res.ok) {
      // The grid was left open past the slot's start — refresh it so the
      // customer sees which slots are still bookable.
      if (json.code === 'slot_past') void loadSlots();
      // Someone took the last seat after the grid was drawn — redraw it so the
      // slot shows as full and the customer picks another.
      if (json.code === SLOT_FULL_CODE) void loadSlots();
      // Booked from another device meanwhile — pull the list so the warning
      // under the date picker matches what the server just refused.
      if (json.code === DAILY_LIMIT_CODE) void loadMe();
      // The branch's booking window moved (or the page sat open overnight) —
      // reload so the date picker's maximum matches the server.
      if (json.code === BOOKING_WINDOW_CODE) void loadSlots();
      // A later slot of the run was taken meanwhile — redraw the grid.
      if (json.code === MULTI_SLOT_UNAVAILABLE_CODE || json.code === MULTI_PICK_INVALID_CODE) void loadSlots();
      return push(json.error ?? 'จองคิวไม่สำเร็จ', 'error');
    }
    // A multi-pick order shows every queue number it created.
    const createdQueues = Array.isArray(json.data?.bookings) ? (json.data.bookings as Array<{ queue_number: string }>) : [];
    setQueueNo(createdQueues.length > 1 ? createdQueues.map((b) => b.queue_number).join(', ') : json.data.queue_number);

    const paymentMethod: string | null = json.data?.payment?.method ?? null;
    // The booking is saved even when Omise refused the charge (e.g. a bank the
    // shop has not activated yet) — tell the customer so they can pick another.
    if (chosenMethod && !paymentMethod && effectivePrice > 0) {
      push(
        chosenMethod === 'omise_mobile_banking'
          ? 'จองคิวแล้ว แต่เปิดชำระผ่านธนาคารนี้ไม่สำเร็จ ดูคิวของฉันเพื่อเลือกธนาคารอื่น'
          : 'จองคิวแล้ว แต่ตั้งค่าการชำระเงินไม่สำเร็จ กรุณาติดต่อร้าน',
        'error',
      );
    }
    const result: BookingResult = {
      booking_id: json.data?.booking_id ?? '',
      queue_number: json.data?.queue_number ?? '',
      payment_method: paymentMethod,
      status: json.data?.status ?? null,
      awaiting_payment: json.data?.awaiting_payment === true,
    };
    setBookingResult(result);
    setResumeBooking(null);
    // Remember an unfinished payment so a reload does not strand the customer.
    if (paymentMethod && ON_SCREEN_PAYMENT_METHODS.has(paymentMethod) && result.booking_id) {
      try {
        localStorage.setItem(pendingPaymentKey(shopKey), JSON.stringify({ ...result, ts: Date.now() }));
      } catch {
        // storage unavailable (private mode) — the account tab is still the durable path
      }
    }
    // Hand off to the bank app right away, while the tap that confirmed the
    // booking still counts as a user gesture for the browser.
    const deeplinkUrl: string | undefined = json.data?.payment?.deeplink?.deeplink_url;
    if (isBankAppMethod(paymentMethod) && deeplinkUrl) {
      try { openBankDeeplink(deeplinkUrl); } catch { /* the panel still offers the button */ }
    }
    // Wake up the shop. The Flex confirmation the server pushed is outbound, so
    // it never raises an unread badge in LINE OA Chat — only a message from the
    // customer does. Send one on their behalf; the webhook recognises it and
    // stays silent so the bot does not reply on top of the confirmation.
    // Shops that would rather keep the customer's chat clean turn this off in
    // LINE Settings.
    try {
      const liff = shop?.booking_echo_enabled === false ? null : await ensureLiffLoaded();
      if (liff?.isInClient?.() && liff.sendMessages) {
        const text = buildBookingEchoText({
          queueNumber: json.data?.queue_number ?? '',
          branch: json.data?.branch_name ?? selectedBranch?.branch_name ?? '',
          service: json.data?.service_name ?? selectedService?.service_name ?? '',
          dateLabel: formatDateDMY(json.data?.booking_date ?? date),
          time: json.data?.booking_time ?? selectedTime,
        });
        await liff.sendMessages([{ type: 'text', text }]);
      }
    } catch {
      // Booking already succeeded — a failed echo must stay invisible to the
      // customer. The shop still sees it in the portal notification bell.
    }

    push(result.awaiting_payment ? 'จองคิวแล้ว กรุณาชำระเงินเพื่อยืนยันคิว' : result.status === 'pending_approval' ? 'ส่งคำขอจองแล้ว รอร้านยืนยัน' : 'จองคิวสำเร็จ');
    void loadMe();
    // Never auto-close while a payment panel is on screen — it would close the
    // only place the customer can upload their slip or reopen the bank app.
    if (paymentMethod && ON_SCREEN_PAYMENT_METHODS.has(paymentMethod)) return;
    try {
      const liff = await ensureLiffLoaded();
      if (liff?.isInClient?.() && liff?.closeWindow) {
        setTimeout(() => liff.closeWindow?.(), 600);
      }
    } catch {
      // no-op
    }
  }

  const selectedBranch = useMemo(() => branches.find((b) => b.id === branchId), [branches, branchId]);

  const countdown = releaseAt ? releaseCountdown(releaseAt, nowMs + clockOffsetMs) : null;
  /** Waiting room card: shown until the branch opens, then for the short jitter pause. */
  const releaseNotice = !bookingGateOpen && releaseAt && countdown ? (
    <Alert severity="info" icon={<HourglassTopRoundedIcon fontSize="inherit" />}>
      {waitingForRelease ? (
        <Stack spacing={0.5}>
          <Typography variant="subtitle2" fontWeight={700}>
            เปิดให้จอง {formatDateDMY(isoToBangkokLocalDate(releaseAt))} เวลา {bangkokTimeOf(releaseAt)} น.
          </Typography>
          <Typography variant="h5" fontWeight={800} sx={{ fontVariantNumeric: 'tabular-nums' }}>
            {countdown.days > 0 ? `${countdown.days} วัน ` : ''}
            {String(countdown.hours).padStart(2, '0')}:{String(countdown.minutes).padStart(2, '0')}:{String(countdown.seconds).padStart(2, '0')}
          </Typography>
          <Typography variant="caption">ไม่ต้องกดรีเฟรช เมื่อถึงเวลาหน้านี้จะเปิดให้เลือกคิวเอง</Typography>
        </Stack>
      ) : (
        'กำลังเปิดให้จอง…'
      )}
    </Alert>
  ) : null;
  // /slots carries the freshest value; /meta covers the time before the first load.
  const maxBookingDate = slotMeta.max_date ?? selectedBranch?.max_booking_date ?? '';
  const minBookingDate = slotMeta.min_date ?? dayRules?.minDate ?? selectedBranch?.min_booking_date ?? '';
  const selectedService = useMemo(() => services.find((s) => s.id === serviceId), [services, serviceId]);
  /** Every picked slot, highlighted together in the grid. */
  const pickedSlots = useMemo(() => new Set(pickedTimes), [pickedTimes]);

  /**
   * Tap on a grid slot. Normally picks that one slot. With multi-pick on, a
   * tap adds the slot (any free time, up to MAX_SLOTS_PER_ORDER) or removes it
   * when already picked; the earliest becomes `selectedTime`.
   */
  function onSlotTap(time: string) {
    if (!multiPickEnabled) {
      setSelectedTime(time);
      setExtraTimes([]);
      return;
    }
    const next = toggleSlotPick(pickedTimes, time, MAX_SLOTS_PER_ORDER);
    if (next.limitHit) push(`เลือกได้สูงสุด ${MAX_SLOTS_PER_ORDER} ช่องต่อการจอง`, 'error');
    setSelectedTime(next.picks[0] ?? '');
    setExtraTimes(next.picks.slice(1));
  }
  // Branch first, then service: a yoga teacher linked to "คลาสโยคะ" must not
  // appear when the customer picked "พิลาทิส". Unlinked resources always show.
  // Courts the customer booked before float to the top with a badge, so a
  // favourite is easy to find again. Order only — nothing is ever pre-selected.
  const resourceHistory = useMemo(() => summarizeResourceHistory([...upcoming, ...history]), [upcoming, history]);
  const filteredResources = useMemo(
    () =>
      sortResourcesByHistory(
        filterResourcesForService(resources.filter((r) => !r.branch_id || r.branch_id === branchId), serviceId),
        resourceHistory,
      ),
    [resources, branchId, serviceId, resourceHistory],
  );
  const selectedResource = useMemo(
    () => filteredResources.find((r) => r.id === selectedResourceId),
    [filteredResources, selectedResourceId],
  );
  const galleryResource = useMemo(
    () => filteredResources.find((r) => r.id === galleryResourceId),
    [filteredResources, galleryResourceId],
  );
  const resourceType = selectedResource?.resource_type || filteredResources[0]?.resource_type;
  const pickerLabel = useMemo(
    () => resourcePickerLabel(resourceType, selectedService?.service_name),
    [resourceType, selectedService?.service_name],
  );
  /** Label for a booking's assigned resource, resolved from the shop's resource list. */
  const bookingResourceLabel = (bookingResourceId?: string | null) =>
    resourceTypeLabel(resources.find((r) => r.id === bookingResourceId)?.resource_type);
  const skipResourceLabel = useMemo(
    () => (resourceType ? `ไม่ระบุ${resourceTypeLabel(resourceType)}` : 'ไม่ระบุผู้ให้บริการ'),
    [resourceType],
  );

  // Picking a resource is optional — never auto-select one, or a customer who
  // just wants a time slot silently books a specific trainer.
  useEffect(() => {
    if (selectedResourceId && !filteredResources.some((r) => r.id === selectedResourceId)) {
      setSelectedResourceId('');
    }
  }, [filteredResources, selectedResourceId]);

  async function cancelBooking(bookingId: string) {
    if (!lineUserId) return;
    const ok = window.confirm('ยืนยันยกเลิกคิวนี้?');
    if (!ok) return;
    const res = await fetch(`/api/public/shop/${shopKey}/cancel-booking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ line_user_id: lineUserId, id_token: currentIdToken() || undefined, booking_id: bookingId }),
    });
    const json = await res.json();
    if (!res.ok) return push(json.error ?? 'ยกเลิกคิวไม่สำเร็จ', 'error');
    push('ยกเลิกคิวแล้ว');
    void loadMe();
  }

  async function acknowledgeChange(bookingId: string) {
    if (!lineUserId) return;
    const res = await fetch(`/api/public/shop/${shopKey}/acknowledge-booking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ line_user_id: lineUserId, id_token: currentIdToken() || undefined, booking_id: bookingId }),
    });
    const json = await res.json();
    if (!res.ok) return push(json.error ?? 'บันทึกไม่สำเร็จ', 'error');
    push('รับทราบแล้ว ขอบคุณค่ะ');
    void loadMe();
  }

  /** "ฉันมาถึงแล้ว" — tells the shop the customer is on site so staff can call them. */
  async function checkIn(bookingId: string) {
    if (!lineUserId || checkingIn) return;
    setCheckingIn(bookingId);
    try {
      const res = await fetch(`/api/public/shop/${shopKey}/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line_user_id: lineUserId, id_token: currentIdToken() || undefined, booking_id: bookingId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return push(json.error ?? 'เช็คอินไม่สำเร็จ', 'error');
      push(json.data?.already ? 'เช็คอินไว้แล้วค่ะ' : 'เช็คอินแล้ว ร้านจะเรียกคิวคุณเร็ว ๆ นี้');
      void loadMe();
    } finally {
      setCheckingIn('');
    }
  }

  async function closeLiffOrBack() {
    try {
      const liff = await ensureLiffLoaded();
      if (liff?.isInClient?.() && liff?.closeWindow) return liff.closeWindow();
    } catch {
      // no-op
    }
    if (typeof window !== 'undefined') window.history.back();
  }

  /** Leave the success screen for the account tab. */
  function goToMyQueues() {
    setQueueNo('');
    setBookingResult(null);
    setTab('account');
  }

  const shellProps = { shopName: shop?.name, branchName: selectedBranch?.branch_name };
  // Full slots are excluded so a day with one open slot left still compares
  // against the open ones, not against zero.
  const maxSlotCapacity = slots.reduce((max, s) => (!s.is_past && s.remaining_capacity > 0 ? Math.max(max, s.remaining_capacity) : max), 0);

  if (queueNo) {
    const awaitingApproval = bookingResult?.status === 'pending_approval';
    const awaitingPayment = bookingResult?.awaiting_payment === true;
    const summaryRows = [
      { label: 'บริการ', value: selectedService?.service_name ?? '-' },
      { label: 'วันที่', value: formatDateDMY(date) },
      { label: 'เวลา', value: pickedTimes.length > 1 ? `${pickedTimes.join(', ')} น. (${pickedTimes.length} คิว)` : `${selectedTime} น.` },
      { label: 'สาขา', value: selectedBranch?.branch_name ?? '-' },
      ...(filteredResources.length > 0
        ? [{
            label: resourceTypeLabel(resourceType),
            value: selectedResource
              ? resourceDisplayName(selectedResource)
              : 'ทางร้านจัดให้ตามคิว',
          }]
        : []),
    ];
    return (
      <LiffShell {...shellProps} title={awaitingPayment ? 'รอชำระเงิน' : awaitingApproval ? 'รอร้านยืนยัน' : 'จองคิวสำเร็จ'}>
        <Card>
          <Stack alignItems="center" sx={{ px: 2, pt: 2.75, pb: 2.25, textAlign: 'center' }}>
            <Box
              sx={{
                width: 56,
                height: 56,
                mb: 1.25,
                borderRadius: '16px',
                display: 'grid',
                placeItems: 'center',
                bgcolor: awaitingApproval ? 'warning.light' : brandSoft,
                color: awaitingApproval ? 'warning.dark' : 'primary.main',
              }}
            >
              {awaitingApproval ? <HourglassTopRoundedIcon sx={{ fontSize: 30 }} /> : <CheckRoundedIcon sx={{ fontSize: 30 }} />}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.02em' }}>
              เลขคิวของคุณ
            </Typography>
            <Typography
              variant="h3"
              sx={{ fontWeight: 800, color: awaitingApproval ? 'warning.dark' : 'primary.main', letterSpacing: '-0.02em', lineHeight: 1.05, fontVariantNumeric: 'tabular-nums', my: 0.5 }}
            >
              {queueNo}
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{awaitingPayment ? 'จองคิวแล้ว รอชำระเงิน' : awaitingApproval ? 'ส่งคำขอจองแล้ว' : 'จองคิวสำเร็จ'}</Typography>
          </Stack>
          <Divider />
          <Stack spacing={1.25} sx={{ p: 1.75 }}>
            <KeyValueList rows={summaryRows} />
            {awaitingPayment ? (
              <Alert severity="warning">คิวจะได้รับการยืนยันเมื่อชำระเงินเรียบร้อย หากไม่ชำระภายในเวลาที่กำหนด ระบบจะยกเลิกคิวให้อัตโนมัติ</Alert>
            ) : awaitingApproval ? (
              <Alert severity="warning">คิวนี้รอร้านตรวจสอบและยืนยัน ร้านจะแจ้งผลผ่าน LINE อีกครั้ง</Alert>
            ) : (
              <Typography variant="caption" color="text.secondary">กรุณามาก่อนเวลาประมาณ 10 นาที</Typography>
            )}
          </Stack>
        </Card>

        {bookingResult?.payment_method && ON_SCREEN_PAYMENT_METHODS.has(bookingResult.payment_method) && bookingResult.booking_id && lineUserId && (
          <LiffPaymentPanel
            shopKey={shopKey}
            bookingId={bookingResult.booking_id}
            lineUserId={lineUserId}
            idToken={liffIdToken}
            onPaid={clearPendingPayment}
          />
        )}

        <Stack spacing={1}>
          <Button variant="contained" size="large" fullWidth onClick={goToMyQueues}>ดูคิวของฉัน</Button>
          <Button variant="outlined" size="large" fullWidth onClick={() => { setQueueNo(''); setBookingResult(null); }}>จองคิวอีกครั้ง</Button>
          <Button variant="text" color="inherit" size="large" fullWidth sx={{ color: 'text.secondary' }} onClick={() => void closeLiffOrBack()}>ปิดหน้าต่าง</Button>
        </Stack>
      </LiffShell>
    );
  }

  // Reload landed here with an unfinished transfer — reopen the payment panel.
  if (resumeBooking && lineUserId) {
    return (
      <LiffShell {...shellProps} title="ชำระเงินต่อ">
        <Alert severity="warning">
          <Typography variant="body2" sx={{ fontWeight: 700 }}>ยังชำระเงินไม่เสร็จ</Typography>
          <Typography variant="caption">เลขคิว {resumeBooking.queue_number}</Typography>
        </Alert>
        <LiffPaymentPanel
          shopKey={shopKey}
          bookingId={resumeBooking.booking_id}
          lineUserId={lineUserId}
          idToken={liffIdToken}
          onPaid={clearPendingPayment}
        />
        <Button variant="text" color="inherit" size="large" fullWidth sx={{ color: 'text.secondary' }} onClick={clearPendingPayment}>ข้ามไปก่อน</Button>
      </LiffShell>
    );
  }

  const memberBlock =
    memberStatus === 'checking' ? (
      <Alert severity="info" icon={<CircularProgress size={16} color="inherit" />}>
        กำลังตรวจสอบสมาชิกของร้าน...
      </Alert>
    ) : memberStatus === 'error' ? (
      <Alert severity="error">
        <Stack spacing={1} alignItems="flex-start">
          <span>{memberError || 'ตรวจสอบสมาชิกไม่สำเร็จ'}</span>
          {resolvedLiffId ? (
            <Typography variant="caption" sx={{ fontFamily: 'ui-monospace, monospace' }}>LIFF ID: {resolvedLiffId}</Typography>
          ) : null}
          <Stack direction="row" spacing={1}>
            {liffOpenUrl ? <Button size="small" variant="outlined" color="inherit" href={liffOpenUrl}>เปิดผ่าน LINE</Button> : null}
            <Button size="small" variant="contained" color="error" onClick={retryMemberCheck}>ลองใหม่</Button>
          </Stack>
        </Stack>
      </Alert>
    ) : null;

  const nameField = (
    <TextField
      label="ชื่อผู้จอง"
      value={customerName}
      onChange={(e) => setCustomerName(e.target.value)}
      autoComplete="name"
      fullWidth
      slotProps={{
        input: { startAdornment: <InputAdornment position="start"><PersonRoundedIcon fontSize="small" /></InputAdornment> },
      }}
    />
  );
  const phoneField = (
    <TextField
      label="เบอร์โทร"
      value={formatThaiPhone(customerPhone)}
      onChange={(e) => setCustomerPhone(normalizeThaiPhoneDigits(e.target.value))}
      placeholder="xxx-xxx-xxxxx"
      autoComplete="tel"
      fullWidth
      slotProps={{
        htmlInput: { inputMode: 'numeric', maxLength: 12 },
        input: { startAdornment: <InputAdornment position="start"><PhoneRoundedIcon fontSize="small" /></InputAdornment> },
      }}
    />
  );

  const nicknameField = (
    <TextField
      label="ชื่อเล่น (ไม่บังคับ)"
      value={customerNickname}
      onChange={(e) => setCustomerNickname(e.target.value)}
      autoComplete="nickname"
      helperText="ใช้เรียกคิวและแสดงบนจอคิว"
      fullWidth
      slotProps={{
        htmlInput: { maxLength: NICKNAME_MAX },
        input: { startAdornment: <InputAdornment position="start"><TagFacesRoundedIcon fontSize="small" /></InputAdornment> },
      }}
    />
  );

  /** Cover photo of a booking's resource, looked up live — bookings never snapshot a URL. */
  const bookingResourceImage = (bookingResourceId?: string | null) =>
    (bookingResourceId && resources.find((r) => r.id === bookingResourceId)?.image_urls?.[0]) || null;

  const renderBookingCard = (b: MyBooking, opts: { active: boolean }) => {
    const resourceImage = bookingResourceImage(b.resource_id);
    const rows = [
      { label: 'เวลา', value: `${formatDateDMY(b.booking_date)} • ${String(b.start_time).slice(0, 5)}` },
      { label: 'สาขา', value: b.branches?.branch_name ?? '-' },
      { label: 'บริการ', value: b.services?.service_name ?? '-' },
      ...(b.resource_name ? [{ label: bookingResourceLabel(b.resource_id), value: b.resource_name }] : []),
    ];
    if (!opts.active) {
      return (
        <Stack key={b.id} direction="row" spacing={1.25} alignItems="center" sx={{ border: 1, borderColor: 'divider', borderRadius: '16px', p: 1.5 }}>
          {resourceImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={resourceImage} alt="" loading="lazy" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
          ) : null}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 0.5 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>{b.queue_number}</Typography>
              <StatusChip status={String(b.status)} />
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {formatDateDMY(b.booking_date)} • {String(b.start_time).slice(0, 5)} ·{' '}
              {[b.branches?.branch_name ?? '-', b.services?.service_name ?? '-', b.resource_name ?? ''].filter(Boolean).join(' • ')}
            </Typography>
          </Box>
        </Stack>
      );
    }
    const resumeKind = paymentResumeKind(b);
    const canResumeSlip = resumeKind === 'slip';
    const canResumeDeeplink = resumeKind === 'bank_app';
    const canCancel = (CUSTOMER_CANCELLABLE_STATUSES as readonly string[]).includes(b.status);
    // Same rule as the API: only on the booking day and while still waiting.
    const canCheckIn = Boolean(todayIso) && checkInEligibility({ status: b.status, booking_date: b.booking_date }, todayIso).ok;
    const isCalled = b.status === 'called';
    // Same rule as the API: on site today and the shop has F&B on.
    const canOrderFood = Boolean(shop?.fnb_enabled) && Boolean(todayIso) && b.booking_date === todayIso && FNB_ORDERABLE_BOOKING_STATUSES.includes(b.status);
    return (
      <Box
        key={b.id}
        sx={{
          border: isCalled ? 2 : 1,
          borderColor: isCalled ? 'info.main' : 'divider',
          borderRadius: '16px',
          p: 1.5,
          bgcolor: 'background.paper',
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>{b.queue_number}</Typography>
          <StatusChip status={String(b.status)} />
        </Stack>
        {resourceImage ? (
          // Upcoming booking: a wide photo so the customer can find the court on arrival.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resourceImage}
            alt={b.resource_name ?? ''}
            loading="lazy"
            style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 12, marginBottom: 8, display: 'block' }}
          />
        ) : null}
        <KeyValueList rows={rows} dense />
        {isCalled ? (
          <Alert severity="info" icon={<CampaignRoundedIcon fontSize="inherit" />} sx={{ mt: 1.25 }}>
            ถึงคิวของคุณแล้ว กรุณามาที่จุดบริการ{b.resource_name ? ` (${b.resource_name})` : ''}
          </Alert>
        ) : null}
        {isAwaitingPayment(b.status, b.payment_status) ? (
          <Alert severity="warning" sx={{ mt: 1.25 }}>รอชำระเงิน — คิวจะยืนยันเมื่อชำระเรียบร้อย หากเลยเวลาชำระ คิวอาจถูกยกเลิก</Alert>
        ) : b.status === 'pending_approval' ? (
          <Alert severity="warning" sx={{ mt: 1.25 }}>รอร้านตรวจสอบและยืนยันคิว — ร้านจะแจ้งผลผ่าน LINE</Alert>
        ) : null}
        {b.status === 'checked_in' ? (
          <Alert severity="success" icon={<HowToRegRoundedIcon fontSize="inherit" />} sx={{ mt: 1.25 }}>
            เช็คอินแล้ว รอร้านเรียกคิว — จะมีข้อความ LINE แจ้งเมื่อถึงคิวคุณ
          </Alert>
        ) : null}
        {isChangeAckPending(b) ? (
          <Alert
            severity="warning"
            sx={{ mt: 1.25 }}
            action={<Button color="inherit" size="small" onClick={() => void acknowledgeChange(b.id)}>รับทราบ</Button>}
          >
            ร้านเปลี่ยนแปลงคิวของคุณ กรุณาตรวจสอบวัน เวลา และผู้ให้บริการใหม่
          </Alert>
        ) : null}
        {b.payment_method === 'bank_transfer' && b.payment_status === 'awaiting_verification' ? (
          <Alert severity="warning" sx={{ mt: 1.25 }}>รอร้านตรวจสอบสลิป — ร้านจะแจ้งผลผ่าน LINE</Alert>
        ) : null}
        {canResumeSlip || canResumeDeeplink || canCancel || canCheckIn || canOrderFood ? (
          <Stack spacing={1} sx={{ mt: 1.25 }}>
            {canOrderFood ? (
              <Button variant="contained" color="warning" fullWidth onClick={() => setOrderingFor(b.id)}>
                สั่งอาหาร / เครื่องดื่ม
              </Button>
            ) : null}
            {canCheckIn ? (
              <Button
                variant="contained"
                fullWidth
                startIcon={<HowToRegRoundedIcon />}
                disabled={checkingIn === b.id}
                onClick={() => void checkIn(b.id)}
              >
                {checkingIn === b.id ? 'กำลังเช็คอิน…' : 'ฉันมาถึงแล้ว'}
              </Button>
            ) : null}
            {canResumeSlip ? (
              <Button
                variant="contained"
                fullWidth
                onClick={() => setResumeBooking({ booking_id: b.id, queue_number: b.queue_number, payment_method: 'bank_transfer' })}
              >
                {b.payment_status === 'rejected' ? 'อัปโหลดสลิปใหม่' : 'ชำระเงิน / อัปโหลดสลิป'}
              </Button>
            ) : null}
            {canResumeDeeplink ? (
              <Button
                variant="contained"
                fullWidth
                onClick={() => setResumeBooking({ booking_id: b.id, queue_number: b.queue_number, payment_method: b.payment_method ?? 'bank_deeplink' })}
              >
                {b.payment_status === 'failed' ? 'ชำระเงินใหม่ผ่านแอปธนาคาร' : 'ชำระเงินผ่านแอปธนาคาร'}
              </Button>
            ) : null}
            {canCancel ? (
              <Button variant="outlined" color="inherit" fullWidth onClick={() => void cancelBooking(b.id)}>ยกเลิกคิว</Button>
            ) : null}
          </Stack>
        ) : null}
      </Box>
    );
  };

  const slotAlert = sameDayBooking ? (
    <Alert
      severity="warning"
      icon={<EventBusyRoundedIcon fontSize="inherit" />}
      action={
        <Button color="inherit" size="small" onClick={() => setTab('account')}>
          ดูคิว
        </Button>
      }
    >
      {dailyLimitMessage(date)}
    </Alert>
  ) : slotMeta.reason === 'holiday' ? (
      <Alert severity="info" icon={<EventBusyRoundedIcon fontSize="inherit" />}>วันหยุด</Alert>
    ) : slotMeta.reason === 'closed' ? (
      <Alert severity="info" icon={<EventBusyRoundedIcon fontSize="inherit" />}>ปิดทำการ</Alert>
    ) : slotMeta.reason === 'beyond_window' ? (
      <Alert severity="info" icon={<EventBusyRoundedIcon fontSize="inherit" />}>{slotMeta.hint || 'ยังไม่เปิดจองวันที่เลือก'}</Alert>
    ) : slotMeta.reason === 'before_window' ? (
      <Alert severity="info" icon={<EventBusyRoundedIcon fontSize="inherit" />}>{slotMeta.hint || 'ยังไม่เปิดจองวันที่เลือก'}</Alert>
    ) : slotMeta.reason === 'full' ? (
      <Alert severity="warning">{slotMeta.hint || 'คิวเต็ม'}</Alert>
    ) : null;

  return (
    <LiffShell {...shellProps} title={tab === 'booking' ? 'จองคิว' : 'คิวของฉัน'}>
      {shopMetaError ? <Alert severity="error">โหลดข้อมูลร้านไม่สำเร็จ: {shopMetaError}</Alert> : null}

      {tab === 'booking' ? (
        <>
          <LiffStepper step={step} />
          {step === 1 ? (
            <>
              {memberBlock}

              <LiffSection title="ข้อมูลผู้จอง">
                {nameField}
                {phoneField}
                {nicknameField}
              </LiffSection>

              <Stack spacing={1}>
                <LiffLabel>เลือกบริการที่ต้องการ</LiffLabel>
                {!shop && !shopMetaError ? <LiffSkeleton rows={3} /> : null}
                {shop && services.length === 0 ? <LiffEmpty icon={<EventBusyRoundedIcon />} text="ร้านยังไม่ได้เปิดบริการให้จอง" /> : null}
                {services.map((s) => {
                  const meta = serviceMeta(s);
                  return (
                    <OptionCard
                      key={`preset-${s.id}`}
                      icon={meta.icon}
                      imageUrl={s.image_url}
                      title={s.service_name}
                      subtitle={[showDuration ? `${s.duration_minutes} นาที` : '', meta.subtitle].filter(Boolean).join(' • ')}
                      trailing={formatPrice(s.price) || undefined}
                      selected={serviceId === s.id}
                      onClick={() => setServiceId(s.id)}
                    />
                  );
                })}
              </Stack>

              {filteredResources.length > 0 ? (
                <Stack spacing={1}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                    <LiffLabel hint="(เลือกหรือไม่เลือกก็ได้)">{pickerLabel}</LiffLabel>
                    {selectedBranch?.layout_image_url ? (
                      <Button size="small" variant="text" startIcon={<MapRoundedIcon />} onClick={() => setLayoutOpen(true)}>
                        ดูผัง
                      </Button>
                    ) : null}
                  </Stack>
                  {filteredResources.map((r) => {
                    const isPerson = isPersonResourceType(r.resource_type);
                    return (
                      <OptionCard
                        key={`resource-${r.id}`}
                        icon={resourceTypeIcon(r.resource_type)}
                        imageUrl={r.image_urls?.[0]}
                        badge={resourceHistoryBadge(r.id, resourceHistory)}
                        onPreview={() => setGalleryResourceId(r.id)}
                        title={resourceDisplayName(r)}
                        subtitle={[
                          resourceTypeLabel(r.resource_type),
                          !isPerson && r.capacity ? `${r.capacity} ที่นั่ง` : '',
                          resourceLocationText(r),
                        ]
                          .filter(Boolean)
                          .join(' • ')}
                        trailing={formatPrice(r.unit_price) || undefined}
                        selected={selectedResourceId === r.id}
                        onClick={() => setSelectedResourceId(r.id)}
                      />
                    );
                  })}
                  <OptionCard
                    icon="🙋"
                    title={skipResourceLabel}
                    subtitle="ทางร้านจัดให้ตามคิว"
                    selected={selectedResourceId === ''}
                    onClick={() => setSelectedResourceId('')}
                  />
                </Stack>
              ) : null}

              <Stack spacing={1}>
                <Button
                  variant="contained"
                  size="large"
                  fullWidth
                  endIcon={<ArrowForwardRoundedIcon />}
                  disabled={nextBlocked}
                  onClick={() => setStep(2)}
                >
                  ถัดไป: เลือกคิว
                </Button>
                {nextBlockedReason ? (
                  <Typography variant="caption" sx={{ color: 'warning.dark', textAlign: 'center' }}>{nextBlockedReason}</Typography>
                ) : null}
                {releaseNotice}
                <Button variant="text" color="inherit" size="large" fullWidth sx={{ color: 'text.secondary' }} onClick={() => void closeLiffOrBack()}>
                  ยกเลิก
                </Button>
              </Stack>
            </>
          ) : (
            <>
              <LiffSection muted>
                <Stack direction="row" alignItems="center" spacing={1.25}>
                  <Box
                    sx={{
                      width: 38,
                      height: 38,
                      borderRadius: '10px',
                      flexShrink: 0,
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 19,
                      overflow: 'hidden',
                      bgcolor: 'background.paper',
                      border: 1,
                      borderColor: 'divider',
                    }}
                  >
                    {selectedResource?.image_urls?.[0] || selectedService?.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selectedResource?.image_urls?.[0] || selectedService?.image_url || ''}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    ) : selectedService ? (
                      serviceMeta(selectedService).icon
                    ) : (
                      '📌'
                    )}
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{selectedService?.service_name ?? '-'}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {[
                        `สาขา ${selectedBranch?.branch_name ?? '-'}`,
                        showDuration ? `ระยะเวลา ${selectedService?.duration_minutes ?? '-'} นาที` : '',
                        selectedResource
                          ? `${resourceTypeLabel(selectedResource.resource_type)} ${resourceDisplayName(selectedResource)}`
                          : filteredResources.length > 0
                            ? skipResourceLabel
                            : '',
                      ].filter(Boolean).join(' • ')}
                    </Typography>
                  </Box>
                  {effectivePrice > 0 ? (
                    <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                      {effectivePrice.toLocaleString('th-TH')} บาท
                    </Typography>
                  ) : null}
                </Stack>
              </LiffSection>

              <LiffSection>
                <TextField select label="สาขา" value={branchId} onChange={(e) => setBranchId(e.target.value)} fullWidth>
                  {branches.map((b) => <MenuItem key={b.id} value={b.id}>{b.branch_name}</MenuItem>)}
                </TextField>
                <TextField select label="บริการ" value={serviceId} onChange={(e) => setServiceId(e.target.value)} fullWidth>
                  {services.map((s) => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.service_name}{showDuration ? ` (${s.duration_minutes} นาที)` : ''}
                    </MenuItem>
                  ))}
                </TextField>
                {dayRulesFailed ? (
                  // Calendar rules unavailable — fall back to the device's own
                  // picker so the customer can still book; the server checks the day.
                  <TextField
                    label="วันที่"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    fullWidth
                    slotProps={{
                      inputLabel: { shrink: true },
                      input: { startAdornment: <InputAdornment position="start"><CalendarMonthRoundedIcon fontSize="small" /></InputAdornment> },
                      htmlInput: { min: minBookingDate || todayIso || undefined, max: maxBookingDate || undefined },
                    }}
                  />
                ) : !dayRules ? (
                  <LiffSkeleton rows={3} />
                ) : firstBookableDay(dayRules) === null ? (
                  <Alert severity="info" icon={<EventBusyRoundedIcon fontSize="inherit" />}>สาขานี้ยังไม่เปิดให้จองในขณะนี้</Alert>
                ) : (
                  <Stack spacing={0.5}>
                    <LiffLabel>เลือกวันที่</LiffLabel>
                    <LiffDateCalendar value={date} rules={dayRules} onChange={setDate} />
                    {minBookingDate && maxBookingDate ? (
                      <Typography variant="caption" color="text.secondary">
                        เปิดจองวันที่ {formatDateDMY(minBookingDate)} ถึง {formatDateDMY(maxBookingDate)}
                      </Typography>
                    ) : minBookingDate ? (
                      <Typography variant="caption" color="text.secondary">
                        เปิดจองตั้งแต่วันที่ {formatDateDMY(minBookingDate)}
                      </Typography>
                    ) : maxBookingDate ? (
                      <Typography variant="caption" color="text.secondary">
                        จองล่วงหน้าได้ถึง {formatDateDMY(maxBookingDate)}
                      </Typography>
                    ) : null}
                  </Stack>
                )}
                <Button variant="outlined" size="large" fullWidth onClick={() => void loadSlots()} disabled={!canLoadSlots || loading}>
                  {loading ? 'กำลังโหลด...' : 'ดูเวลาว่าง'}
                </Button>
              </LiffSection>

              <Stack spacing={1}>
                <LiffLabel>{date ? `เวลาว่าง · ${formatDateDMY(date)}` : 'เวลาว่าง'}</LiffLabel>
                {releaseNotice}
                {slotAlert}
                {slotHint ? <Typography variant="caption" sx={{ color: 'warning.dark' }}>{slotHint}</Typography> : null}
                {loading ? <LiffSkeleton rows={2} /> : null}
                {!loading && slots.length > 0 ? (
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
                    {slots.map((s) => {
                      const t = s.slot_time.slice(0, 5);
                      // "เหลือ N" only marks slots that are scarcer than the rest of the
                      // day — a shop with capacity 1 everywhere would otherwise label every slot.
                      const past = s.is_past === true;
                      const full = s.remaining_capacity <= 0;
                      const scarce = !past && !full && s.remaining_capacity < maxSlotCapacity;
                      return (
                        <SlotButton
                          key={s.slot_time}
                          label={t}
                          selected={pickedSlots.has(t)}
                          disabled={past || full}
                          disabledReason={past ? 'past' : full ? 'full' : undefined}
                          booked={s.booked_count}
                          capacity={s.capacity}
                          remaining={scarce ? s.remaining_capacity : undefined}
                          onClick={() => onSlotTap(t)}
                        />
                      );
                    })}
                  </Box>
                ) : null}
                {!loading && multiPickEnabled && slots.length > 0 ? (
                  <Alert severity="info" icon={false} sx={{ py: 0.5 }}>
                    {pickedTimes.length > 0 ? (
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        เลือกแล้ว {pickedTimes.length} ช่อง: {pickedTimes.join(', ')} น.
                      </Typography>
                    ) : null}
                    <Typography variant="caption" color="text.secondary">
                      แตะเลือกได้หลายช่อง สูงสุด {MAX_SLOTS_PER_ORDER} ช่อง (ได้ 1 คิวต่อช่อง) · แตะช่องที่เลือกแล้วเพื่อเอาออก
                    </Typography>
                  </Alert>
                ) : null}
                {bookingGateOpen && !loading && slots.length === 0 && !slotHint && slotMeta.reason === 'ok' ? (
                  <LiffEmpty icon={<CalendarMonthRoundedIcon />} text="กดดูเวลาว่างเพื่อเลือกคิว" />
                ) : null}
              </Stack>

              {showMethodPicker && (
                <LiffSection
                  title="วิธีชำระเงิน"
                  action={
                    <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {effectivePrice.toLocaleString('th-TH')} บาท
                    </Typography>
                  }
                >
                  {paymentOptions.map((option) => (
                    <Stack key={option.key} spacing={1}>
                      <OptionCard
                        icon={paymentOptionIcon(option)}
                        title={option.label}
                        subtitle={paymentOptionSubtitle(option)}
                        selected={chosenOptionKey === option.key}
                        onClick={() => chooseOption(option)}
                      />
                      {option.method === 'omise_mobile_banking' && chosenMethod === 'omise_mobile_banking' ? (
                        <Box sx={{ pl: 0.5 }}>
                          <LiffLabel>เลือกธนาคาร</LiffLabel>
                          <BankGrid banks={mobileBanks} value={chosenBank} onChange={setChosenBank} />
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                            ยอดเงินและผู้รับถูกตั้งไว้ในแอปธนาคาร ผู้รับจะแสดงเป็นชื่อร้านผ่าน Omise
                          </Typography>
                        </Box>
                      ) : null}
                    </Stack>
                  ))}
                </LiffSection>
              )}

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                <Button variant="outlined" size="large" onClick={() => setStep(1)}>ย้อนกลับ</Button>
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => void bookNow()}
                  disabled={!canBook || loading || (showMethodPicker && !chosenMethod)}
                  startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : undefined}
                >
                  {submitting ? 'กำลังบันทึก...' : 'ยืนยันจองคิว'}
                </Button>
              </Box>
            </>
          )}
        </>
      ) : (
        <>
          <LiffSection>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Avatar
                src={pictureUrl || undefined}
                alt={displayName || customerName}
                sx={{
                  width: 48,
                  height: 48,
                  fontWeight: 800,
                  fontSize: 18,
                  color: 'primary.contrastText',
                  background: pictureUrl ? undefined : brandGradient(theme.palette.primary.light, theme.palette.primary.dark),
                }}
              >
                {(displayName || customerName || 'U').slice(0, 1).toUpperCase()}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.3 }} noWrap>{displayName || customerName || 'LINE User'}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {customerNickname.trim() ? `ชื่อเล่น ${customerNickname.trim()} · ` : ''}สมาชิก LINE
                </Typography>
              </Box>
            </Stack>
            {memberBlock}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
              {nameField}
              {phoneField}
            </Box>
            {nicknameField}
            <Button variant="outlined" fullWidth disabled={accountLoading} onClick={() => void loadMe({ mode: 'update' })}>
              {accountLoading ? 'กำลังบันทึก...' : 'บันทึกข้อมูลส่วนตัว'}
            </Button>
          </LiffSection>

          <LiffSection
            title="คิวที่จองอยู่"
            action={upcoming.length > 0 ? <Chip size="small" variant="outlined" label={`${upcoming.length} คิว`} /> : undefined}
          >
            {accountLoading && upcoming.length === 0 ? <LiffSkeleton rows={1} /> : null}
            {!accountLoading && upcoming.length === 0 ? (
              <>
                <LiffEmpty icon={<CalendarMonthRoundedIcon />} text="ไม่มีคิวที่กำลังใช้งาน" />
                <Button variant="contained" fullWidth onClick={() => setTab('booking')}>จองคิวใหม่</Button>
              </>
            ) : null}
            {upcoming.map((b) => renderBookingCard(b, { active: true }))}
          </LiffSection>

          <LiffSection title="ประวัติการจอง">
            {history.length === 0 ? <LiffEmpty icon={<EventBusyRoundedIcon />} text="ยังไม่มีประวัติ" /> : null}
            {history.map((b) => renderBookingCard(b, { active: false }))}
          </LiffSection>
        </>
      )}

      <LiffGalleryDialog
        open={Boolean(galleryResource)}
        onClose={() => setGalleryResourceId('')}
        title={galleryResource ? resourceDisplayName(galleryResource) : ''}
        subtitle={galleryResource ? resourceLocationText(galleryResource) : undefined}
        description={galleryResource?.description}
        images={galleryResource?.image_urls ?? []}
        actions={
          galleryResource ? (
            <Stack direction="row" spacing={1}>
              {selectedBranch?.layout_image_url ? (
                <Button
                  variant="outlined"
                  color="inherit"
                  fullWidth
                  startIcon={<MapRoundedIcon />}
                  onClick={() => {
                    setGalleryResourceId('');
                    setLayoutOpen(true);
                  }}
                >
                  ดูผัง
                </Button>
              ) : null}
              <Button
                variant="contained"
                fullWidth
                onClick={() => {
                  setSelectedResourceId(galleryResource.id);
                  setGalleryResourceId('');
                }}
              >
                เลือก{resourceTypeLabel(galleryResource.resource_type)}นี้
              </Button>
            </Stack>
          ) : undefined
        }
      />
      <LiffGalleryDialog
        open={layoutOpen && Boolean(selectedBranch?.layout_image_url)}
        onClose={() => setLayoutOpen(false)}
        title={`ผัง${selectedBranch?.branch_name ? ` • ${selectedBranch.branch_name}` : ''}`}
        images={selectedBranch?.layout_image_url ? [selectedBranch.layout_image_url] : []}
      />
      {orderingFor && lineUserId ? (
        <LiffFnbOrderSheet
          open
          onClose={() => setOrderingFor('')}
          shopKey={shopKey}
          bookingId={orderingFor}
          placeLabel={upcoming.find((x) => x.id === orderingFor)?.resource_name || upcoming.find((x) => x.id === orderingFor)?.queue_number || 'ที่นั่งของคุณ'}
          lineUserId={lineUserId}
          getIdToken={currentIdToken}
        />
      ) : null}
    </LiffShell>
  );
}
