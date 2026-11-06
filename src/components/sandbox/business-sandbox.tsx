'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type RefObject } from 'react';
import Link from 'next/link';
import { Alert, Box, Button, Chip, IconButton, Stack, Tab, Tabs, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import TipsAndUpdatesRoundedIcon from '@mui/icons-material/TipsAndUpdatesRounded';
import TourRoundedIcon from '@mui/icons-material/TourRounded';
import { LiffThemeScope } from '@/components/line/liff-theme-scope';
import type { BusinessScenario } from '@/lib/demo/scenarios/types';
import { nextHint } from '@/lib/demo/sandbox-sim/hints';
import { resolveMenuTap } from '@/lib/demo/sandbox-sim/menu';
import { createInitialState, reducerFor } from '@/lib/demo/sandbox-sim/reducer';
import { bangkokStamp } from '@/lib/demo/sandbox-sim/time';
import { tourStep, type LiffProgress, type TourContext, type TourHistory, type TourStep } from '@/lib/demo/sandbox-sim/tour';
import type { RichMenuButton } from '@/lib/line/rich-menu/schema';
import { LiffSim } from './liff-sim';
import { LineChat } from './line-chat';
import { SandboxSetup } from './sandbox-setup';
import { StaffBoard } from './staff-board';
import { ROLE_META, RolePanel } from './role-panel';
import { SandboxTour } from './sandbox-tour';
import { TvView } from './tv-view';

/** Bangkok clock that refreshes every 30 s so "ผ่านแล้ว" slots stay current. */
function useBangkokNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => bangkokStamp(new Date()));
  useEffect(() => {
    const id = window.setInterval(() => setNow(bangkokStamp(new Date())), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** localStorage key: the visitor closed the tour, do not open it again on the next visit. */
const TOUR_OFF_KEY = 'qb-sandbox-tour-off';

/**
 * Tour on/off. On by default for a first visit; closing it is remembered in
 * localStorage (read after mount, so the server render never depends on it).
 */
function useTourSwitch() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(TOUR_OFF_KEY) === '1') setOn(false);
    } catch {
      // storage blocked: keep the tour on
    }
  }, []);
  const set = useCallback((next: boolean) => {
    setOn(next);
    try {
      if (next) window.localStorage.removeItem(TOUR_OFF_KEY);
      else window.localStorage.setItem(TOUR_OFF_KEY, '1');
    } catch {
      // storage blocked: the switch still works for this visit
    }
  }, []);
  return [on, set] as const;
}

/**
 * What the tour remembers for the whole visit (across "เริ่มใหม่" and mode
 * changes): which explain sequences are done and where we are in the current one.
 */
function useTourMemory() {
  const [explained, setExplained] = useState<ReadonlySet<string>>(() => new Set());
  const [pos, setPos] = useState<{ key: string; index: number }>({
    key: '',
    index: 0,
  });

  const finish = useCallback((key: string) => {
    setExplained((prev) => new Set(prev).add(key));
    setPos({ key: '', index: 0 });
  }, []);

  /** Advance the explain sequence of `step`, finishing it after its last part. */
  const next = useCallback(
    (step: TourStep) => {
      if (!step.explainKey || !step.explainPos) return;
      const { index, count } = step.explainPos;
      if (index + 1 >= count) finish(step.explainKey);
      else setPos({ key: step.explainKey, index: index + 1 });
    },
    [finish],
  );

  const skip = useCallback(
    (step: TourStep) => {
      if (step.explainKey) finish(step.explainKey);
    },
    [finish],
  );

  const restart = useCallback(() => {
    setExplained(new Set());
    setPos({ key: '', index: 0 });
  }, []);

  /** Index to use for an explain key: only the remembered one if it is the same sequence. */
  const indexFor = useCallback((key: string | undefined) => (key && pos.key === key ? pos.index : 0), [pos]);

  return { explained, pos, next, skip, restart, indexFor };
}

export type TourMemory = ReturnType<typeof useTourMemory>;

/**
 * Build a tour step, resolving the explain index for whichever sequence applies.
 * The first pass finds the sequence key; the second applies its remembered index.
 */
function stepFor(ctx: Omit<TourContext, 'explainIndex'>, memory: TourMemory): TourStep {
  const probe = tourStep({ ...ctx, explainIndex: 0 });
  const index = memory.indexFor(probe.explainKey);
  return index === 0 ? probe : tourStep({ ...ctx, explainIndex: index });
}

/** Which role each mobile tab shows. */
const TAB_ROLE = { customer: 'customer', staff: 'shop', tv: 'display' } as const;

const NO_HISTORY: TourHistory = { servicesBooked: [], methodsUsed: [] };

/**
 * Public, no-login, in-memory sandbox of the real product for one business
 * type: customer LINE chat + LIFF booking, shop queue board and queue TV, all
 * driven by one reducer so every action shows up in the other views.
 *
 * Renders only the setup step on the server; the play area mounts after the
 * visitor presses "เริ่มทดลอง", so nothing time- or canvas-dependent is SSR'd.
 *
 * @param scenario - Business scenario from `BUSINESS_SCENARIOS`.
 */
export function BusinessSandbox({ scenario }: { scenario: BusinessScenario }) {
  const [session, setSession] = useState<{
    paymentOn: boolean;
    run: number;
  } | null>(null);
  const [lastChoice, setLastChoice] = useState<boolean | null>(null);
  const [tourOn, setTourOn] = useTourSwitch();
  const memory = useTourMemory();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const setupStep = stepFor(
    {
      phase: 'setup',
      screen: 'chat',
      desktop: true,
      tab: 'customer',
      mine: null,
      paymentOn: lastChoice ?? true,
      scenario,
      liff: null,
      explained: memory.explained,
      history: NO_HISTORY,
    },
    memory,
  );

  return (
    <Box ref={rootRef}>
      {!session ? (
        <>
          <SandboxSetup scenario={scenario} initial={lastChoice} onStart={(paymentOn) => setSession({ paymentOn, run: 1 })} />
          {tourOn ? (
            <SandboxTour rootRef={rootRef} step={setupStep} onNext={() => memory.next(setupStep)} onSkipExplain={() => memory.skip(setupStep)} onClose={() => setTourOn(false)} />
          ) : null}
        </>
      ) : (
        <SandboxPlay
          key={session.run}
          rootRef={rootRef}
          scenario={scenario}
          paymentOn={session.paymentOn}
          tourOn={tourOn}
          onTour={setTourOn}
          memory={memory}
          onReset={() => setSession({ paymentOn: session.paymentOn, run: session.run + 1 })}
          onChangeMode={() => {
            setLastChoice(session.paymentOn);
            setSession(null);
          }}
        />
      )}
    </Box>
  );
}

function SandboxPlay({
  rootRef,
  scenario,
  paymentOn,
  tourOn,
  onTour,
  memory,
  onReset,
  onChangeMode,
}: {
  rootRef: RefObject<HTMLDivElement | null>;
  scenario: BusinessScenario;
  paymentOn: boolean;
  tourOn: boolean;
  onTour: (on: boolean) => void;
  memory: TourMemory;
  onReset: () => void;
  onChangeMode: () => void;
}) {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('lg'), { noSsr: true });
  const now = useBangkokNow();
  const reducer = useMemo(() => reducerFor(scenario), [scenario]);
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    createInitialState(scenario, {
      paymentOn,
      today: bangkokStamp(new Date()).date,
    }),
  );
  const [screen, setScreen] = useState<'chat' | 'liff'>('chat');
  const [liffStart, setLiffStart] = useState<'booking' | 'member'>('booking');
  const [liffRun, setLiffRun] = useState(0);
  const [tab, setTab] = useState<'customer' | 'staff' | 'tv'>('customer');
  const [liff, setLiff] = useState<LiffProgress | null>(null);
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  const mine = state.queues.find((q) => q.id === state.lastBookingId) ?? null;
  const hint = nextHint({ screen, mine, boardVisible: desktop });
  // The booking the tour follows; "จองอีกแบบ" lets go of it so the next booking is guided again.
  const tracked = mine && mine.id !== dismissedId ? mine : null;
  const history = useMemo<TourHistory>(() => {
    const own = state.queues.filter((q) => q.mine);
    return {
      servicesBooked: own.map((q) => q.serviceKey),
      methodsUsed: own.flatMap((q) => (q.payment?.method && ['paid', 'awaiting_verification'].includes(q.payment.status) ? [q.payment.method] : [])),
    };
  }, [state.queues]);
  const step = stepFor(
    {
      phase: 'play',
      screen,
      desktop,
      tab,
      mine: tracked,
      paymentOn,
      scenario,
      liff: screen === 'liff' ? liff : null,
      explained: memory.explained,
      history,
    },
    memory,
  );
  const onLiffProgress = useCallback((p: LiffProgress) => setLiff(p), []);

  const openLiff = (start: 'booking' | 'member') => {
    setLiffStart(start);
    setLiffRun((n) => n + 1);
    setScreen('liff');
  };
  const onMenuTap = (button: RichMenuButton) => {
    const tap = resolveMenuTap(button, mine);
    if (tap.kind === 'open_booking') openLiff('booking');
    else if (tap.kind === 'open_member') openLiff('member');
    else
      dispatch({
        type: 'customer_text',
        text: tap.customerText,
        reply: tap.botText,
      });
  };

  const phone = (
    <Box
      data-tour="area-phone"
      sx={{
        width: '100%',
        maxWidth: 390,
        mx: 'auto',
        bgcolor: '#0f1a15',
        borderRadius: '38px',
        p: 1.5,
        boxShadow: 3,
      }}
    >
      <Box
        sx={{
          position: 'relative',
          height: 'min(700px, 78dvh)',
          bgcolor: '#fff',
          borderRadius: '28px',
          overflow: 'hidden',
          display: screen === 'chat' ? 'block' : 'flex',
          flexDirection: 'column',
        }}
      >
        {screen === 'chat' ? (
          <LineChat scenario={scenario} chat={state.chat} guideBooking={!mine} onMenuTap={onMenuTap} />
        ) : (
          <>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{
                px: 1,
                py: 0.5,
                bgcolor: '#fff',
                borderBottom: 1,
                borderColor: 'divider',
                flexShrink: 0,
              }}
            >
              <Typography variant="caption" sx={{ pl: 1, fontWeight: 600 }}>
                LIFF · {scenario.shopName}
              </Typography>
              <IconButton size="small" aria-label="ปิดหน้าจอง กลับไปแชท" onClick={() => setScreen('chat')}>
                <CloseRoundedIcon fontSize="small" />
              </IconButton>
            </Stack>
            <Box
              sx={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                '& main': { minHeight: 'auto' },
                '& > div': { minHeight: 'auto' },
              }}
            >
              <LiffThemeScope>
                <LiffSim
                  key={liffRun}
                  scenario={scenario}
                  state={state}
                  dispatch={dispatch}
                  now={now}
                  startAt={liffStart}
                  onBackToChat={() => setScreen('chat')}
                  onProgress={onLiffProgress}
                />
              </LiffThemeScope>
            </Box>
          </>
        )}
      </Box>
    </Box>
  );

  const staff = <StaffBoard scenario={scenario} state={state} dispatch={dispatch} />;

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} justifyContent="space-between">
        <Chip
          color={paymentOn ? 'primary' : 'default'}
          variant="outlined"
          label={paymentOn ? 'โหมด: มีชำระเงินออนไลน์' : 'โหมด: จ่ายหน้าร้าน'}
          sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
        />
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {!tourOn ? (
            <Button
              size="small"
              variant="contained"
              startIcon={<TourRoundedIcon />}
              onClick={() => {
                memory.restart();
                setDismissedId(mine?.id ?? null);
                onTour(true);
              }}
            >
              วิธีเล่น
            </Button>
          ) : null}
          <Button size="small" variant="outlined" onClick={onChangeMode}>
            เปลี่ยนโหมดชำระเงิน
          </Button>
          <Button size="small" variant="outlined" color="inherit" onClick={onReset}>
            เริ่มใหม่
          </Button>
        </Stack>
      </Stack>

      <Alert icon={<TipsAndUpdatesRoundedIcon fontSize="inherit" />} severity="info" role="status" aria-live="polite">
        {hint}
      </Alert>

      {desktop ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '440px minmax(0, 1fr)',
            gap: 3,
            alignItems: 'start',
          }}
        >
          {/* Sticky so the customer's phone stays in view while the visitor scrolls the shop side. */}
          <Box sx={{ position: 'sticky', top: 88 }}>
            <RolePanel role="customer" tourTarget="role-customer">
              {phone}
            </RolePanel>
          </Box>
          <RolePanel role="shop" tourTarget="role-shop">
            <Stack spacing={3}>
              <Box data-tour="area-board">{staff}</Box>
              <RolePanel role="display" tourTarget="area-tv" dense>
                <TvView scenario={scenario} state={state} />
              </RolePanel>
            </Stack>
          </RolePanel>
        </Box>
      ) : (
        <>
          <Tabs
            value={tab}
            onChange={(_, v: typeof tab) => setTab(v)}
            variant="fullWidth"
            aria-label="เลือกมุมมอง: ลูกค้า หรือ ร้าน"
            sx={{
              bgcolor: 'background.paper',
              borderRadius: 3,
              border: 1,
              borderColor: 'divider',
              minHeight: 56,
              '& .MuiTabs-indicator': { height: 4, borderRadius: 2, bgcolor: ROLE_META[TAB_ROLE[tab]].color },
            }}
          >
            {(['customer', 'staff', 'tv'] as const).map((value) => {
              const meta = ROLE_META[TAB_ROLE[value]];
              return (
                <Tab
                  key={value}
                  value={value}
                  data-tour={`tab-${value}`}
                  label={
                    <Stack alignItems="center" spacing={0.25}>
                      <span aria-hidden>{meta.icon}</span>
                      <span>{meta.tab}</span>
                    </Stack>
                  }
                  sx={{ minHeight: 56, py: 0.75, fontWeight: 700, fontSize: 13, '&.Mui-selected': { color: meta.color } }}
                />
              );
            })}
          </Tabs>
          {/* The phone stays mounted so the half-filled booking survives a tab switch. */}
          <Box sx={{ display: tab === 'customer' ? 'block' : 'none' }}>
            <RolePanel role="customer" dense>
              {phone}
            </RolePanel>
          </Box>
          {tab === 'staff' ? (
            <RolePanel role="shop" dense>
              {staff}
            </RolePanel>
          ) : null}
          {tab === 'tv' ? (
            <RolePanel role="display" dense>
              <TvView scenario={scenario} state={state} />
            </RolePanel>
          ) : null}
        </>
      )}

      {tourOn ? (
        <SandboxTour
          rootRef={rootRef}
          step={step}
          onNext={() => memory.next(step)}
          onSkipExplain={() => memory.skip(step)}
          onAgain={() => {
            setDismissedId(mine?.id ?? null);
            setScreen('chat');
            setTab('customer');
          }}
          onClose={() => onTour(false)}
        />
      ) : null}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="center" sx={{ pt: 1 }}>
        <Button component={Link} href="/register" variant="contained" size="large" data-tour="cta-register">
          สมัครใช้ฟรี
        </Button>
        <Button component={Link} href="/pricing" variant="outlined" size="large">
          ดูราคา
        </Button>
      </Stack>
    </Stack>
  );
}
