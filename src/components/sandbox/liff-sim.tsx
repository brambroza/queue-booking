'use client';

import { useEffect, useMemo, useState, type Dispatch } from 'react';
import { Alert, Box, Button, Chip, IconButton, Stack, TextField, Typography } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import { LiffDateCalendar } from '@/components/line/liff-date-calendar';
import { KeyValueList, LiffSection, LiffShell, LiffStepper, OptionCard, SlotButton } from '@/components/line/liff-ui';
import type { BusinessScenario } from '@/lib/demo/scenarios/types';
import { DAY_OVER_HINT, SLOT_PAST_MESSAGE } from '@/lib/booking/slot-time';
import type { BookableDayRules } from '@/lib/booking/bookable-days';
import { computeAmount, formatBaht } from '@/lib/demo/sandbox-sim/amount';
import { canContinue, eligibleResources, stepperPill, stepsFor, type LiffStep } from '@/lib/demo/sandbox-sim/flow';
import { DEMO_CUSTOMER, STATUS_LABEL_TH, scenarioSlotTimes } from '@/lib/demo/sandbox-sim/reducer';
import { firstDayWithRoom, markSlots } from '@/lib/demo/sandbox-sim/slots';
import { addDaysIso } from '@/lib/demo/sandbox-sim/time';
import type { SimAction, SimState } from '@/lib/demo/sandbox-sim/types';
import { formatThaiDateLabel } from '@/lib/utils/date-format';
import type { LiffProgress, PayMethodChoice } from '@/lib/demo/sandbox-sim/tour';
import { LiffPaymentSim } from './liff-payment-sim';

/** How many days ahead the sandbox calendar lets the visitor look. */
const HORIZON_DAYS = 13;

type Screen = LiffStep | 'done';

/**
 * The LIFF booking inside the phone, built from the real presentational LIFF
 * components. Steps follow the real LIFF (service, service point, head count,
 * date and time, confirm) but all data is in memory.
 *
 * @param scenario - Business scenario.
 * @param state - Sandbox state.
 * @param dispatch - Sandbox reducer dispatch.
 * @param now - Bangkok clock stamp.
 * @param startAt - `member` opens straight on the visitor's latest queue.
 * @param onBackToChat - Close the LIFF.
 * @param onProgress - Reports screen / choices to the guided tour.
 */
export function LiffSim({
  scenario,
  state,
  dispatch,
  now,
  startAt,
  onBackToChat,
  onProgress,
}: {
  scenario: BusinessScenario;
  state: SimState;
  dispatch: Dispatch<SimAction>;
  now: { date: string; time: string };
  startAt: 'booking' | 'member';
  onBackToChat: () => void;
  onProgress?: (progress: LiffProgress) => void;
}) {
  const [screen, setScreen] = useState<Screen>(startAt === 'member' && state.lastBookingId ? 'done' : 'service');
  const [serviceKey, setServiceKey] = useState<string | null>(null);
  const [resourceCode, setResourceCode] = useState<string | null>(null);
  const [partySize, setPartySize] = useState<number>(scenario.partySize?.min ?? 1);
  const [dateChoice, setDateChoice] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [name, setName] = useState<string>(DEMO_CUSTOMER.name);
  const [phone, setPhone] = useState<string>(DEMO_CUSTOMER.phone);
  const [error, setError] = useState('');
  const [payMethod, setPayMethod] = useState<PayMethodChoice | null>(null);

  useEffect(() => {
    onProgress?.({ screen, serviceKey, resourceCode, payMethod });
  }, [onProgress, screen, serviceKey, resourceCode, payMethod]);

  const service = scenario.services.find((s) => s.key === serviceKey) ?? null;
  const steps = stepsFor(scenario, serviceKey);
  const slotTimes = useMemo(() => scenarioSlotTimes(scenario), [scenario]);

  const rules: BookableDayRules = useMemo(
    () => ({
      today: now.date,
      maxDate: addDaysIso(now.date, HORIZON_DAYS),
      openWeekdays: [0, 1, 2, 3, 4, 5, 6],
      holidays: [],
    }),
    [now.date],
  );

  const slotsOn = (iso: string) =>
    service
      ? markSlots({
          date: iso,
          today: state.today,
          now,
          times: slotTimes,
          service,
          resourceCode,
          queues: state.queues,
        })
      : [];
  const days = useMemo(() => Array.from({ length: HORIZON_DAYS + 1 }, (_, i) => addDaysIso(now.date, i)), [now.date]);
  const date = dateChoice ?? (service ? firstDayWithRoom(days, (d) => slotsOn(d).some((s) => s.state === 'open')) : now.date);
  const slots = slotsOn(date);
  const selectedTime = time && slots.find((s) => s.time === time)?.state === 'open' ? time : null;

  const amount = service ? computeAmount(scenario, service.key, resourceCode, state.paymentOn) : null;
  const resources = service ? eligibleResources(scenario, service.key) : [];
  const mine = state.queues.find((q) => q.id === state.lastBookingId) ?? null;

  const index = steps.indexOf(screen as LiffStep);
  const goNext = () => {
    setError('');
    const next = steps[index + 1];
    if (next) setScreen(next);
  };
  const goBack = () => {
    setError('');
    const prev = steps[index - 1];
    if (prev) setScreen(prev);
  };

  const pickService = (key: string) => {
    setServiceKey(key);
    setResourceCode(null);
    setTime(null);
    setDateChoice(null);
  };

  const confirm = () => {
    if (!service || !selectedTime) return;
    const open = markSlots({
      date,
      today: state.today,
      now,
      times: [selectedTime],
      service,
      resourceCode,
      queues: state.queues,
    })[0];
    if (!open || open.state !== 'open') {
      setError(open?.state === 'past' ? SLOT_PAST_MESSAGE : 'ช่วงเวลานี้เต็มแล้ว กรุณาเลือกเวลาอื่น');
      setTime(null);
      setScreen('datetime');
      return;
    }
    dispatch({
      type: 'book',
      serviceKey: service.key,
      resourceCode,
      date,
      time: selectedTime,
      partySize: scenario.partySize ? partySize : undefined,
      customerName: name,
      phone,
      now,
    });
    setScreen('done');
  };

  const resourceName = (code: string | null) => (code ? (scenario.resources.find((r) => r.code === code)?.name ?? code) : null);

  return (
    <LiffShell shopName={scenario.shopName} branchName={scenario.branchName} title={screen === 'done' ? 'คิวของฉัน' : 'จองคิว'}>
      {screen !== 'done' ? (
        <Box data-tour="liff-stepper">
          <LiffStepper step={stepperPill(screen)} />
        </Box>
      ) : null}
      {error ? <Alert severity="warning">{error}</Alert> : null}

      {screen === 'service' ? (
        <LiffSection title="เลือกบริการ">
          <Stack spacing={1} data-tour="liff-service">
            {scenario.services.map((s) => (
              <OptionCard
                key={s.key}
                icon={s.icon}
                title={s.name}
                subtitle={`${s.description} · ${s.durationMinutes} นาที${s.bookingMode === 'request_approval' ? ' · รอร้านยืนยัน' : ''}`}
                trailing={s.price > 0 ? formatBaht(s.price) : undefined}
                selected={serviceKey === s.key}
                onClick={() => pickService(s.key)}
              />
            ))}
          </Stack>
        </LiffSection>
      ) : null}

      {screen === 'resource' && service ? (
        <LiffSection title={`เลือก${scenario.resourceLabel}`}>
          <Stack spacing={1} data-tour="liff-resource">
            {scenario.resourcePicker === 'optional' ? (
              <OptionCard icon="✨" title="ไม่ระบุ" subtitle="ให้ร้านจัดให้" selected={resourceCode === null} onClick={() => setResourceCode(null)} />
            ) : null}
            {resources.map((r) => (
              <OptionCard
                key={r.code}
                icon={service.icon}
                title={r.name}
                subtitle={r.detail}
                trailing={r.unitPrice ? `${formatBaht(r.unitPrice)}/รอบ` : undefined}
                selected={resourceCode === r.code}
                onClick={() => {
                  setResourceCode(r.code);
                  setTime(null);
                  setDateChoice(null);
                }}
              />
            ))}
          </Stack>
        </LiffSection>
      ) : null}

      {screen === 'party' && scenario.partySize ? (
        <LiffSection title={scenario.partySize.label}>
          <Stack direction="row" alignItems="center" justifyContent="center" spacing={2.5} sx={{ py: 1 }} data-tour="liff-party">
            <IconButton aria-label="ลดจำนวน" disabled={partySize <= scenario.partySize.min} onClick={() => setPartySize((n) => n - 1)} sx={{ border: 1, borderColor: 'divider' }}>
              <RemoveRoundedIcon />
            </IconButton>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                minWidth: 48,
                textAlign: 'center',
                fontVariantNumeric: 'tabular-nums',
              }}
              aria-live="polite"
            >
              {partySize}
            </Typography>
            <IconButton
              aria-label="เพิ่มจำนวน"
              disabled={partySize >= scenario.partySize.max}
              onClick={() => setPartySize((n) => n + 1)}
              sx={{ border: 1, borderColor: 'divider' }}
            >
              <AddRoundedIcon />
            </IconButton>
          </Stack>
        </LiffSection>
      ) : null}

      {screen === 'datetime' ? (
        <>
          <LiffSection title="เลือกวัน">
            <Box data-tour="liff-calendar">
              <LiffDateCalendar
                value={date}
                rules={rules}
                onChange={(iso) => {
                  setDateChoice(iso);
                  setTime(null);
                }}
              />
            </Box>
          </LiffSection>
          <LiffSection
            title="เลือกเวลา"
            action={
              <Typography variant="caption" color="text.secondary">
                {formatThaiDateLabel(date)}
              </Typography>
            }
          >
            {slots.length > 0 && slots.every((s) => s.state === 'past') ? <Alert severity="info">{DAY_OVER_HINT} เลือกวันถัดไปได้เลย</Alert> : null}
            <Box
              data-tour="liff-time"
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 0.75,
              }}
            >
              {slots.map((s) => (
                <SlotButton
                  key={s.time}
                  label={s.time}
                  selected={selectedTime === s.time}
                  disabled={s.state !== 'open'}
                  disabledReason={s.state === 'open' ? undefined : s.state}
                  remaining={s.remaining}
                  booked={s.booked}
                  capacity={s.capacity}
                  onClick={() => setTime(s.time)}
                />
              ))}
            </Box>
          </LiffSection>
        </>
      ) : null}

      {screen === 'confirm' && service && amount ? (
        <>
          <LiffSection title="ข้อมูลผู้จอง">
            <Stack spacing={1.5} data-tour="liff-form">
              <TextField label="ชื่อ" size="small" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
              <TextField label="เบอร์โทร" size="small" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, '').slice(0, 10))} inputMode="tel" fullWidth />
            </Stack>
          </LiffSection>
          <LiffSection title="สรุปการจอง" muted>
            <Box data-tour="liff-summary">
              <KeyValueList
                rows={[
                  { label: 'บริการ', value: service.name },
                  ...(resourceCode
                    ? [
                        {
                          label: scenario.resourceLabel,
                          value: resourceName(resourceCode),
                        },
                      ]
                    : []),
                  ...(scenario.partySize
                    ? [
                        {
                          label: scenario.partySize.label,
                          value: String(partySize),
                        },
                      ]
                    : []),
                  { label: 'วันที่', value: formatThaiDateLabel(date) },
                  { label: 'เวลา', value: selectedTime },
                  {
                    label: 'ราคา',
                    value: amount.total > 0 ? formatBaht(amount.total) : 'จ่ายที่ร้าน',
                  },
                ]}
              />
            </Box>
            {amount.due > 0 ? (
              <Alert data-tour="liff-pay-note" severity="info">{`ชำระ ${formatBaht(amount.due)} ตอนจอง คิวยืนยันเมื่อชำระแล้ว`}</Alert>
            ) : state.paymentOn ? (
              <Alert severity="success">บริการนี้ไม่มีค่าใช้จ่ายล่วงหน้า</Alert>
            ) : null}
            {service.bookingMode === 'request_approval' ? (
              <Alert data-tour="liff-approval-note" severity="warning">
                บริการนี้รอร้านยืนยันก่อน
              </Alert>
            ) : null}
          </LiffSection>
        </>
      ) : null}

      {screen === 'done' && mine ? (
        <>
          <LiffSection>
            <Stack data-tour="liff-queue-no" alignItems="center" spacing={0.5} sx={{ textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                เลขคิวของคุณ
              </Typography>
              <Typography variant="h3" sx={{ fontWeight: 800, color: 'primary.main', lineHeight: 1 }} aria-live="polite">
                {mine.queueNo}
              </Typography>
              <Chip
                size="small"
                color={mine.status === 'pending_approval' ? 'warning' : mine.status === 'called' ? 'info' : 'success'}
                label={mine.status === 'pending_approval' && mine.payment?.status === 'pending_payment' ? 'รอชำระเงิน' : (STATUS_LABEL_TH[mine.status] ?? mine.status)}
              />
            </Stack>
            <KeyValueList
              dense
              rows={[
                {
                  label: 'บริการ',
                  value: scenario.services.find((s) => s.key === mine.serviceKey)?.name,
                },
                ...(mine.resourceCode
                  ? [
                      {
                        label: scenario.resourceLabel,
                        value: resourceName(mine.resourceCode),
                      },
                    ]
                  : []),
                { label: 'วันที่', value: formatThaiDateLabel(mine.date) },
                { label: 'เวลา', value: mine.time },
              ]}
            />
          </LiffSection>
          {mine.payment ? <LiffPaymentSim queue={mine} dispatch={dispatch} onMethod={setPayMethod} /> : null}
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" fullWidth onClick={onBackToChat}>
              กลับไปแชท LINE
            </Button>
            <Button
              variant="outlined"
              fullWidth
              onClick={() => {
                setScreen('service');
                setServiceKey(null);
                setResourceCode(null);
                setTime(null);
                setDateChoice(null);
              }}
            >
              จองเพิ่ม
            </Button>
          </Stack>
        </>
      ) : null}

      {screen === 'done' && !mine ? (
        <LiffSection>
          <Typography variant="body2" color="text.secondary">
            ยังไม่มีคิว กดจองคิวเพื่อเริ่มได้เลย
          </Typography>
          <Button variant="contained" onClick={() => setScreen('service')}>
            จองคิว
          </Button>
        </LiffSection>
      ) : null}

      {screen !== 'done' ? (
        <Stack direction="row" spacing={1}>
          {index > 0 ? (
            <Button variant="outlined" onClick={goBack} sx={{ flexShrink: 0 }}>
              ย้อนกลับ
            </Button>
          ) : null}
          {screen === 'confirm' ? (
            <Button
              data-tour={!name.trim() || phone.length < 9 ? undefined : 'liff-confirm'}
              variant="contained"
              size="large"
              fullWidth
              onClick={confirm}
              disabled={!name.trim() || phone.length < 9}
            >
              {amount && amount.due > 0 ? 'ยืนยันและไปชำระเงิน' : 'ยืนยันการจอง'}
            </Button>
          ) : (
            <Button
              data-tour={canContinue(screen, { serviceKey, resourceCode, time: selectedTime }, scenario) ? 'liff-next' : undefined}
              variant="contained"
              size="large"
              fullWidth
              onClick={goNext}
              disabled={!canContinue(screen, { serviceKey, resourceCode, time: selectedTime }, scenario)}
            >
              ถัดไป
            </Button>
          )}
        </Stack>
      ) : null}
    </LiffShell>
  );
}
