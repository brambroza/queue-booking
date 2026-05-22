'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Grid, MenuItem, Stack, TextField, Typography } from '@mui/material';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import PhoneInTalkRoundedIcon from '@mui/icons-material/PhoneInTalkRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import QueueRoundedIcon from '@mui/icons-material/QueueRounded';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import FullscreenRoundedIcon from '@mui/icons-material/FullscreenRounded';
import { LineChatSimulator } from '@/components/demo/line-chat-simulator';
import { LiffBookingSimulator } from '@/components/demo/liff-booking-simulator';
import { RichMenuSimulator } from '@/components/demo/rich-menu-simulator';
import { DemoQueueBoard } from '@/components/demo/demo-queue-board';
import { DemoSignage } from '@/components/demo/demo-signage';
import type { PromoCard } from '@/components/demo/demo-flex-carousel';
import type { ChatMessage, DemoBooking, DemoMemberProfile, DemoMenuAction, DemoQueueItem, DemoQueueStatus, DemoTemplate } from '@/components/demo/line-demo-types';

let demoIdSeq = 0;
function id() {
  demoIdSeq += 1;
  return `demo-${demoIdSeq}`;
}

const TEMPLATE_CONFIG: Record<DemoTemplate, {
  shopName: string;
  menuLabels: Partial<Record<DemoMenuAction, string>>;
  promos: PromoCard[];
  resourceLabel: string;
}> = {
  barber: {
    shopName: 'queue booking',
    menuLabels: { booking: 'จองคิว', check: 'ดูคิว', promo: 'โปรโมชัน' },
    promos: [
      { id: 'b1', title: 'ตัดผม + สระ ลด 15%', subtitle: 'เฉพาะวันจันทร์ - พฤหัส', cta: 'จองเลย' },
      { id: 'b2', title: 'สมาชิกใหม่ลดเพิ่ม', subtitle: 'สมัครสมาชิกผ่าน LINE รับส่วนลดทันที', cta: 'ดูรายละเอียด' },
    ],
    resourceLabel: 'ช่างบอส',
  },
  restaurant: {
    shopName: 'ร้านอาหาร / บุฟเฟ่ต์',
    menuLabels: { booking: 'จองโต๊ะ', check: 'คิวโต๊ะ', promo: 'ดีลพิเศษ' },
    promos: [
      { id: 'r1', title: 'โปร 4 จ่าย 3', subtitle: 'บุฟเฟ่ต์รอบเย็นทุกวันอังคาร', cta: 'จองรอบ 19:00' },
      { id: 'r2', title: 'ส่วนลดวันเกิด', subtitle: 'แสดงบัตรประชาชนรับเค้กฟรี', cta: 'รับสิทธิ์' },
    ],
    resourceLabel: 'โต๊ะ T02',
  },
  clinic: {
    shopName: 'คลินิก / ความงาม',
    menuLabels: { booking: 'นัดหมาย', check: 'คิวตรวจ', promo: 'แพ็กเกจ' },
    promos: [
      { id: 'c1', title: 'ฟรี! ประเมินผิว', subtitle: 'เมื่อจองคอร์สดูแลผิวครบ 3 ครั้ง', cta: 'นัดตรวจ' },
      { id: 'c2', title: 'แพ็กเกจ Botox', subtitle: 'จองคิวผ่าน LINE รับส่วนลด 10%', cta: 'ดูแพ็กเกจ' },
    ],
    resourceLabel: 'ห้อง 1',
  },
  meeting: {
    shopName: 'ห้องประชุม',
    menuLabels: { booking: 'จองห้อง', check: 'สถานะห้อง', promo: 'แพ็กเกจห้อง' },
    promos: [
      { id: 'm1', title: 'Half-Day Package', subtitle: 'จองครึ่งวัน ฟรีโปรเจกเตอร์', cta: 'จองช่วงเช้า' },
      { id: 'm2', title: 'Corporate Plan', subtitle: 'เหมารายเดือนลดสูงสุด 20%', cta: 'ติดต่อเซลล์' },
    ],
    resourceLabel: 'ROOM-A',
  },
};

const initialMessages: ChatMessage[] = [
  { id: id(), role: 'customer', text: 'จองคิว' },
  { id: id(), role: 'bot', text: 'ต้องการบริการอะไรคะ' },
  { id: id(), role: 'bot', text: 'เลือกจาก Rich Menu ด้านล่างได้เลยค่ะ' },
];

const seededQueue: DemoQueueItem[] = [
  { id: id(), queueNo: 'A001', branchName: 'ประชาอุทิศ', serviceName: 'ตัดผมชาย', dateLabel: '16 พ.ค. 2569', timeLabel: '09:30', customerName: 'คุณเอ', resourceName: 'ช่างบอส', status: 'waiting', customerPhone: '0890000001' },
  { id: id(), queueNo: 'A002', branchName: 'ประชาอุทิศ', serviceName: 'ตัดผม + สระ', dateLabel: '16 พ.ค. 2569', timeLabel: '10:00', customerName: 'คุณบี', resourceName: 'ช่างโต', status: 'called', customerPhone: '0890000002' },
  { id: id(), queueNo: 'A003', branchName: 'ประชาอุทิศ', serviceName: 'ทำสีผม', dateLabel: '16 พ.ค. 2569', timeLabel: '10:30', customerName: 'คุณซี', resourceName: 'ช่างบั้ม', status: 'serving', customerPhone: '0890000003' },
  { id: id(), queueNo: 'A004', branchName: 'ประชาอุทิศ', serviceName: 'สระผม', dateLabel: '16 พ.ค. 2569', timeLabel: '11:00', customerName: 'คุณดี', resourceName: 'ช่างบอส', status: 'completed', customerPhone: '0890000004' },
];

type SyncEvent =
  | { type: 'reset' }
  | { type: 'menu'; key: DemoMenuAction }
  | { type: 'quick'; key: 'today' | 'tomorrow' | 'morning' | 'afternoon' | 'contact' }
  | { type: 'booked'; booking: DemoBooking }
  | { type: 'queue'; action: 'call_next' | 'recall' | 'near' | 'advance' | 'add' }
  | { type: 'template'; template: DemoTemplate };

export function DemoLineExperiencePanel() {
  const sourceId = useRef(id());
  const channelRef = useRef<BroadcastChannel | null>(null);
  const step5FullscreenRef = useRef<HTMLDivElement | null>(null);
  const step6FullscreenRef = useRef<HTMLDivElement | null>(null);

  const [template, setTemplate] = useState<DemoTemplate>('barber');
  const [activeMenu, setActiveMenu] = useState<DemoMenuAction>('booking');
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [typing, setTyping] = useState(false);
  const [showLiff, setShowLiff] = useState(true);
  const [lastBooking, setLastBooking] = useState<DemoBooking | null>(null);
  const [queueItems, setQueueItems] = useState<DemoQueueItem[]>(seededQueue);
  const [currentStep, setCurrentStep] = useState<2 | 3 | 4 | 5 | 6>(2);
  const [unlockedSteps, setUnlockedSteps] = useState<Record<2 | 3 | 4 | 5 | 6, boolean>>({
    2: true,
    3: false,
    4: false,
    5: false,
    6: false,
  });
  const [memberProfile, setMemberProfile] = useState<DemoMemberProfile>({
    name: 'ลูกค้าประจำ',
    phone: '085-608-3298',
    tier: 'Silver',
    points: 120,
    totalBookings: 6,
    lastQueueNo: 'A003',
  });
  const [walktourOpen, setWalktourOpen] = useState(false);
  const [walktourIndex, setWalktourIndex] = useState(0);

  const templateConfig = useMemo(() => TEMPLATE_CONFIG[template], [template]);
  const stepOrder: Array<2 | 3 | 4 | 5 | 6> = [2, 3, 4, 5, 6];
  const currentStepIndex = stepOrder.indexOf(currentStep);
  const nextStep = currentStepIndex >= 0 ? stepOrder[currentStepIndex + 1] : undefined;
  const walktourSteps: Array<{ step: 2 | 3 | 4 | 5 | 6; title: string; description: string }> = [
    { step: 2, title: 'STEP 1: LINE Chat', description: 'เริ่มจากแชทลูกค้าใน LINE และกดเมนูจองคิวจาก Rich Menu' },
    { step: 3, title: 'STEP 2: LIFF Booking', description: 'เลือกบริการ วัน เวลา และยืนยันการจองผ่าน LIFF' },
    { step: 4, title: 'STEP 3: Queue Notification', description: 'ฝั่งร้านทดลองส่งแจ้งเตือน เรียกคิว และอัปเดตสถานะคิว' },
    { step: 5, title: 'STEP 4: Queue Board', description: 'ดูภาพรวมคิวสำหรับพนักงาน พร้อมมุมมองลูกค้าแบบมือถือ' },
    { step: 6, title: 'STEP 5: Signage View', description: 'แสดงจอเรียกคิวหน้าร้านสำหรับลูกค้าที่รอคิว' },
  ];
  const activeWalktourStep = walktourSteps[walktourIndex];

  function unlockStep(step: 2 | 3 | 4 | 5 | 6) {
    setUnlockedSteps((prev) => (prev[step] ? prev : { ...prev, [step]: true }));
  }

  function goToNextStep() {
    if (!nextStep || !unlockedSteps[nextStep]) return;
    setCurrentStep(nextStep);
  }

  function goToStepWithUnlock(step: 2 | 3 | 4 | 5 | 6) {
    setUnlockedSteps((prev) => ({
      ...prev,
      2: true,
      3: step >= 3 ? true : prev[3],
      4: step >= 4 ? true : prev[4],
      5: step >= 5 ? true : prev[5],
      6: step >= 6 ? true : prev[6],
    }));
    setCurrentStep(step);
  }

  function startWalktour() {
    setWalktourIndex(0);
    setWalktourOpen(true);
    goToStepWithUnlock(2);
  }

  function moveWalktour(direction: 'next' | 'prev') {
    if (!activeWalktourStep) return;
    if (direction === 'prev') {
      const prevIndex = Math.max(0, walktourIndex - 1);
      setWalktourIndex(prevIndex);
      goToStepWithUnlock(walktourSteps[prevIndex].step);
      return;
    }
    const isLast = walktourIndex >= walktourSteps.length - 1;
    if (isLast) {
      setWalktourOpen(false);
      return;
    }
    const nextIndex = walktourIndex + 1;
    setWalktourIndex(nextIndex);
    goToStepWithUnlock(walktourSteps[nextIndex].step);
  }

  async function openFullscreen(target: 'step5' | 'step6') {
    const element = target === 'step5' ? step5FullscreenRef.current : step6FullscreenRef.current;
    if (!element) return;
    await element.requestFullscreen?.();
  }

  useEffect(() => {
    const channel = new BroadcastChannel('demo-line-experience-sync');
    channelRef.current = channel;
    channel.onmessage = (event: MessageEvent<{ source: string; payload: SyncEvent }>) => {
      if (!event.data || event.data.source === sourceId.current) return;
      handleEvent(event.data.payload, false);
    };
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [queueItems, lastBooking, template]);

  function emit(payload: SyncEvent) {
    channelRef.current?.postMessage({ source: sourceId.current, payload });
  }

  function pushMessage(message: ChatMessage) {
    setMessages((prev) => [...prev, message]);
  }

  function botReply(text: string, delay = 500) {
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      pushMessage({ id: id(), role: 'bot', text });
    }, delay);
  }

  function queueNotify(item: DemoQueueItem, type: 'called' | 'near' | 'repeat') {
    const suffix = type === 'near' ? 'ใกล้ถึงคิวของคุณแล้วค่ะ' : 'ถึงคิวของคุณแล้วค่ะ';
    const line = item.resourceName ? `จุดบริการ ${item.resourceName}` : `สาขา ${item.branchName}`;
    const repeatText = type === 'repeat' ? 'เรียกซ้ำอีกครั้งค่ะ' : '';
    botReply(`${suffix}\nเลขคิว ${item.queueNo}\n${line}\nกรุณาไปที่จุดบริการภายใน 5 นาทีค่ะ ${repeatText}`.trim(), 250);
  }

  function updateStatus(targetId: string, next: DemoQueueStatus) {
    setQueueItems((prev) => prev.map((q) => (q.id === targetId ? { ...q, status: next } : q)));
  }

  function onCallNextQueue() {
    const target = queueItems.find((q) => q.status === 'waiting');
    if (!target) {
      botReply('ไม่มีคิว waiting สำหรับเรียกถัดไปค่ะ', 200);
      return;
    }
    updateStatus(target.id, 'called');
    queueNotify({ ...target, status: 'called' }, 'called');
  }

  function onRecallQueue() {
    const target = queueItems.find((q) => q.status === 'called');
    if (!target) {
      botReply('ยังไม่มีคิวที่อยู่สถานะ called ค่ะ', 200);
      return;
    }
    queueNotify(target, 'repeat');
  }

  function onNearQueue() {
    const target = queueItems.find((q) => q.status === 'waiting');
    if (!target) {
      botReply('ยังไม่มีคิว waiting สำหรับแจ้งเตือนล่วงหน้าค่ะ', 200);
      return;
    }
    queueNotify(target, 'near');
  }

  function onAdvanceStatus() {
    const targetCalled = queueItems.find((q) => q.status === 'called');
    if (targetCalled) {
      updateStatus(targetCalled.id, 'serving');
      botReply(`คิว ${targetCalled.queueNo} เปลี่ยนเป็นกำลังให้บริการแล้วค่ะ`, 220);
      return;
    }
    const targetServing = queueItems.find((q) => q.status === 'serving');
    if (targetServing) {
      updateStatus(targetServing.id, 'completed');
      botReply(`คิว ${targetServing.queueNo} ให้บริการเสร็จแล้วค่ะ`, 220);
      return;
    }
    botReply('ยังไม่มีคิวที่เปลี่ยนสถานะได้ในตอนนี้', 220);
  }

  function createDemoBookingFromAdmin() {
    const num = queueItems.length + 1;
    const booking: DemoQueueItem = {
      id: id(),
      queueNo: `A${String(num).padStart(3, '0')}`,
      branchName: 'ประชาอุทิศ',
      serviceName: 'ตัดผมชาย',
      dateLabel: '16 พ.ค. 2569',
      timeLabel: '14:00',
      customerName: `ลูกค้าตัวอย่าง ${num}`,
      customerPhone: `0890000${String(num).padStart(3, '0')}`,
      resourceName: templateConfig.resourceLabel,
      status: 'waiting',
    };
    setQueueItems((prev) => [...prev, booking]);
    botReply(`เพิ่มคิวตัวอย่าง ${booking.queueNo} แล้ว`, 180);
  }

  function onMenuSelect(key: DemoMenuAction) {
    setActiveMenu(key);
    if (key === 'booking' || key === 'open_liff') {
      unlockStep(3);
      setCurrentStep(3);
      setShowLiff(true);
      botReply('กรุณาเลือกบริการ วัน และเวลาใน LIFF Simulator ได้เลยค่ะ');
      return;
    }
    if (key === 'member') {
      pushMessage({ id: id(), role: 'bot', type: 'member_profile' });
      return;
    }
    if (key === 'check') {
      if (lastBooking) {
        pushMessage({ id: id(), role: 'bot', type: 'flex_booking_success', booking: lastBooking });
      } else {
        botReply('ยังไม่พบคิวล่าสุดค่ะ ลองกดเมนูจองคิวก่อนนะคะ');
      }
      return;
    }
    if (key === 'promo') {
      pushMessage({ id: id(), role: 'bot', type: 'promo', promos: templateConfig.promos });
      return;
    }
    botReply('ทีมงานพร้อมช่วยเหลือค่ะ สามารถพิมพ์คำถามได้เลย');
  }

  function onQuickReply(key: 'today' | 'tomorrow' | 'morning' | 'afternoon' | 'contact') {
    const textMap = {
      today: 'วันนี้มีคิวว่างไหม',
      tomorrow: 'พรุ่งนี้มีคิวไหม',
      morning: 'ขอคิวช่วงเช้า',
      afternoon: 'ขอคิวช่วงบ่าย',
      contact: 'ติดต่อร้าน',
    } as const;
    pushMessage({ id: id(), role: 'customer', text: textMap[key] });
    if (key === 'contact') {
      botReply('รับทราบค่ะ เจ้าหน้าที่จะตอบกลับในไม่กี่นาที');
      return;
    }
    botReply('มีคิวว่างค่ะ ต้องการให้เปิดหน้าจองคิวเลยไหมคะ');
  }

  function onBooked(booking: DemoBooking) {
    unlockStep(4);
    setCurrentStep(4);
    setLastBooking(booking);
    setShowLiff(false);
    setQueueItems((prev) => [...prev, { id: id(), ...booking, status: 'waiting', resourceName: templateConfig.resourceLabel }]);
    setMemberProfile((prev) => ({
      ...prev,
      name: booking.customerName,
      phone: booking.customerPhone || prev.phone,
      totalBookings: prev.totalBookings + 1,
      points: prev.points + 10,
      lastQueueNo: booking.queueNo,
    }));
    pushMessage({ id: id(), role: 'customer', text: `เลือกเวลา ${booking.timeLabel}` });
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      pushMessage({ id: id(), role: 'bot', text: 'จองคิวสำเร็จค่ะ' });
      pushMessage({ id: id(), role: 'bot', type: 'flex_booking_success', booking });
      setActiveMenu('check');
    }, 650);
  }

  function resetDemo() {
    setMessages(initialMessages);
    setLastBooking(null);
    setActiveMenu('booking');
    setShowLiff(true);
    setTyping(false);
    setQueueItems(seededQueue);
    setCurrentStep(2);
    setUnlockedSteps({ 2: true, 3: false, 4: false, 5: false, 6: false });
    setMemberProfile({
      name: 'ลูกค้าประจำ',
      phone: '085-608-3298',
      tier: 'Silver',
      points: 120,
      totalBookings: 6,
      lastQueueNo: 'A003',
    });
  }

  function handleEvent(payload: SyncEvent, shouldEmit = true) {
    if (payload.type === 'reset') resetDemo();
    if (payload.type === 'menu') onMenuSelect(payload.key);
    if (payload.type === 'quick') onQuickReply(payload.key);
    if (payload.type === 'booked') onBooked(payload.booking);
    if (payload.type === 'template') {
      setTemplate(payload.template);
      botReply(`เปลี่ยนเทมเพลตเป็น ${payload.template} แล้ว`);
    }
    if (payload.type === 'queue') {
      unlockStep(5);
      unlockStep(6);
      setCurrentStep(5);
      if (payload.action === 'call_next') onCallNextQueue();
      if (payload.action === 'recall') onRecallQueue();
      if (payload.action === 'near') onNearQueue();
      if (payload.action === 'advance') onAdvanceStatus();
      if (payload.action === 'add') createDemoBookingFromAdmin();
    }
    if (shouldEmit) emit(payload);
  }

  return (
    <Stack spacing={2}>


      <Card sx={{ borderRadius: 1 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'column' }} justifyContent="space-between" spacing={1.4}>
            <Box>
              <Typography variant="h5" fontWeight={900}>LINE Rich Menu + LIFF Sandbox</Typography>
              <Typography color="text.secondary">จำลองแชท LINE, เมนู Rich Menu, จองคิว LIFF, แจ้งเตือนคิว และ Signage แบบ real flow</Typography>
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField
                select
                size="small"
                label="Rich Menu Template"
                value={template}
                onChange={(e) => handleEvent({ type: 'template', template: e.target.value as DemoTemplate })}
                sx={{ minWidth: 190 }}
              >
                <MenuItem value="barber">Barber</MenuItem>
                <MenuItem value="restaurant">Restaurant/Buffet</MenuItem>
                <MenuItem value="clinic">Clinic</MenuItem>
                <MenuItem value="meeting">Meeting Room</MenuItem>
              </TextField>
              <Button onClick={() => handleEvent({ type: 'reset' })} variant="outlined" startIcon={<RefreshRoundedIcon />}>Reset Demo</Button>
              <Button onClick={() => handleEvent({ type: 'menu', key: 'booking' })} variant="contained" startIcon={<PlayArrowRoundedIcon />} sx={{ bgcolor: '#73C088', '&:hover': { bgcolor: '#5ead77' } }}>
                เริ่ม Flow จองคิว
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 1, border: '1px solid', borderColor: 'divider', boxShadow: 'none', bgcolor: '#fafcfa' }}>
        <CardContent sx={{ py: 1.2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'center', md: 'center' }}>
            <Typography variant="caption" color="text.secondary">ลำดับการทดลอง:</Typography>
            <Stack direction="row" spacing={0.8} flexWrap="wrap">
              {[2, 3, 4, 5, 6].map((step) => {
                const typedStep = step as 2 | 3 | 4 | 5 | 6;
                const unlocked = unlockedSteps[typedStep];
                const active = currentStep === typedStep;
                return (
                  <Chip
                    key={step}
                    label={`STEP ${step-1}`}
                    clickable={unlocked}
                    onClick={unlocked ? () => setCurrentStep(typedStep) : undefined}
                    variant={active ? 'filled' : 'outlined'}
                    sx={{
                      bgcolor: active ? '#EAF3DE' : undefined,
                      color: active ? '#3B6D11' : undefined,
                      borderColor: unlocked ? undefined : '#d4dbe3',
                      opacity: unlocked ? 1 : 0.55,
                      fontWeight: 700,
                    }}
                  />
                );
              })}
            </Stack>
            <Typography variant="caption" color="text.secondary">
              เริ่มจาก STEP 1 แล้วระบบจะปลดล็อกขั้นถัดไปให้อัตโนมัติ
            </Typography>
            <Button
              size="small"
              variant="outlined"
              onClick={goToNextStep}
              disabled={!nextStep || !unlockedSteps[nextStep]}
            >
              Next Step
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={startWalktour}
              sx={{ bgcolor: '#73C088', '&:hover': { bgcolor: '#5ead77' } }}
            >
              Walktour
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {currentStep === 2 || currentStep === 3 || currentStep === 4 ? (
      <Grid container spacing={2.2}>
          {currentStep !== 3 ? (
            <Grid size={{ xs: 12, xl: 6 }}>
              <Card
                sx={{
                  borderRadius: 1,
                  overflow: 'hidden',
                  maxWidth: 420,
                  mx: 'auto',
                  width: '100%',
                }}
              >
                <CardContent sx={{ p: 0 }}>
                  <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider', bgcolor: '#fafcfa' }}>
                    <Typography variant="caption" color="text.secondary">STEP 1: LINE Chat Simulator (จอมือถือสำหรับลูกค้าจองคิว)</Typography>
                  </Box>
                  <LineChatSimulator messages={messages} typing={typing} onQuickReply={(k) => handleEvent({ type: 'quick', key: k })} memberProfile={memberProfile} shopName={templateConfig.shopName} />
                  <RichMenuSimulator active={activeMenu} onSelect={(key) => handleEvent({ type: 'menu', key })} labels={templateConfig.menuLabels} />
                </CardContent>
              </Card>
            </Grid>
          ) : null}

          <Grid size={{ xs: 12, xl: currentStep === 3 ? 12 : 6 }}>
            <Stack spacing={2} alignItems="center">
              {unlockedSteps[3] ? (
                <Card
                  sx={{
                    borderRadius: 1,
                    border: currentStep === 3 ? '2px solid #73c088' : undefined,
                    maxWidth: 420,
                    mx: 'auto',
                    width: '100%',
                  }}
                >
                  <CardContent>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.6 }}>STEP 2: LIFF Booking (สำหรับลูกค้า)</Typography>
                    <Typography fontWeight={800} sx={{ mb: 1 }}>LIFF Booking Simulator</Typography>
                    {showLiff ? <LiffBookingSimulator onBooked={(booking) => handleEvent({ type: 'booked', booking })} /> : (
                      <Box sx={{ border: '1px dashed #c6d5e2', borderRadius: 1, p: 2.2, textAlign: 'center', color: '#586677' }}>
                        จองคิวสำเร็จแล้ว กดเมนู &quot;เช็กคิว&quot; หรือ &quot;เปิด LIFF&quot; เพื่อทดลองต่อ
                      </Box>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card sx={{ borderRadius: 1, border: '1px dashed #c6d5e2', maxWidth: 420, mx: 'auto', width: '100%' }}>
                  <CardContent>
                    <Typography variant="caption" color="text.secondary">STEP 3: LIFF Booking</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.6 }}>
                      ไปที่ STEP 2 แล้วกดเมนู &quot;จองคิว&quot; ก่อน เพื่อปลดล็อกขั้นตอนนี้
                    </Typography>
                  </CardContent>
                </Card>
              )}

              {unlockedSteps[4] ? (
                <Card
                  sx={{
                    borderRadius: 1,
                    border: currentStep === 4 ? '2px solid #73c088' : undefined,
                    maxWidth: 420,
                    width: '100%',
                  }}
                >
                  <CardContent>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.6 }}>STEP 3: Queue Notification (สำหรับร้านค้า)</Typography>
                    <Typography fontWeight={800} sx={{ mb: 1 }}>Queue Notification Simulator</Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap">
                      <Button variant="outlined" startIcon={<QueueRoundedIcon />} onClick={() => handleEvent({ type: 'queue', action: 'call_next' })}>เรียกคิวถัดไป</Button>
                      <Button variant="outlined" startIcon={<ReplayRoundedIcon />} onClick={() => handleEvent({ type: 'queue', action: 'recall' })}>เรียกซ้ำ</Button>
                      <Button variant="outlined" startIcon={<NotificationsActiveRoundedIcon />} onClick={() => handleEvent({ type: 'queue', action: 'near' })}>ใกล้ถึงคิว</Button>
                      <Button variant="outlined" startIcon={<AutorenewRoundedIcon />} onClick={() => handleEvent({ type: 'queue', action: 'advance' })}>เปลี่ยนสถานะ</Button>
                      <Button variant="outlined" startIcon={<AddCircleOutlineRoundedIcon />} onClick={() => handleEvent({ type: 'queue', action: 'add' })}>สร้าง booking demo</Button>
                      <Button variant="outlined" startIcon={<CampaignRoundedIcon />} onClick={() => handleEvent({ type: 'menu', key: 'promo' })}>ส่งโปรโมชัน</Button>
                      <Button variant="outlined" startIcon={<PhoneInTalkRoundedIcon />} onClick={() => handleEvent({ type: 'menu', key: 'contact' })}>จำลองตอบจากทีมงาน</Button>
                    </Stack>
                  </CardContent>
                </Card>
              ) : null}
            </Stack>
          </Grid>
        </Grid>
      ) : null}

      {unlockedSteps[5] && currentStep === 5 ? (
        <Grid container spacing={2.2}>
          <Grid size={{ xs: 12 }}>
            <Card ref={step5FullscreenRef} sx={{ borderRadius: 1, border: currentStep === 5 ? '2px solid #73c088' : undefined, position: 'relative', overflow: 'visible' }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.6 }}>
                  <Typography variant="caption" color="text.secondary">STEP 4 Queue Board (สำหรับร้าน)</Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<FullscreenRoundedIcon />}
                    onClick={() => void openFullscreen('step5')}
                    aria-label="Open queue board fullscreen"
                  >
                    Fullscreen
                  </Button>
                </Stack>
                <DemoQueueBoard items={queueItems} />
              </CardContent>

              <Box
                sx={{
                  position: 'absolute',
                  right: { xs: 10, md: 18 },
                  bottom: { xs: -52, md: -64 },
                  width: { xs: 112, md: 132 },
                  zIndex: 10,
                  bgcolor: '#1a1a2e',
                  border: '2px solid #3a3a5c',
                  borderRadius: '18px',
                  p: 0.6,
                  boxShadow: '0 10px 26px rgba(0,0,0,.45)',
                }}
              >
                <Box sx={{ width: 28, height: 5, bgcolor: '#0d0d1a', borderRadius: '0 0 4px 4px', mx: 'auto', mb: 0.5 }} />
                <Box sx={{ borderRadius: 1.5, overflow: 'hidden', bgcolor: '#fff', height: { xs: 170, md: 192 } }}>
                  <Box sx={{ transform: { xs: 'scale(0.26)', md: 'scale(0.31)' }, transformOrigin: 'top left', width: 390, height: 620 }}>
                    <LineChatSimulator
                      messages={messages}
                      typing={typing}
                      onQuickReply={(k) => handleEvent({ type: 'quick', key: k })}
                      memberProfile={memberProfile}
                      shopName={templateConfig.shopName}
                    />
                    <RichMenuSimulator
                      active={activeMenu}
                      onSelect={(key) => handleEvent({ type: 'menu', key })}
                      labels={templateConfig.menuLabels}
                    />
                  </Box>
                </Box>
                <Box sx={{ width: 18, height: 3, bgcolor: '#3a3a5c', borderRadius: 99, mx: 'auto', mt: 0.45 }} />
              </Box>
            </Card>
          </Grid>

        </Grid>
      ) : null}

      {unlockedSteps[6] && currentStep === 6 ? (
        <Grid container spacing={2.2}>

          <Grid size={{ xs: 12 }}>
            <Card ref={step6FullscreenRef} sx={{ borderRadius: 1, border: currentStep === 6 ? '2px solid #73c088' : undefined }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.6 }}>
                  <Typography variant="caption" color="text.secondary">STEP 5: Signage View (แสดงจอในร้าน)</Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<FullscreenRoundedIcon />}
                    onClick={() => void openFullscreen('step6')}
                    aria-label="Open signage fullscreen"
                  >
                    Fullscreen
                  </Button>
                </Stack>
                <DemoSignage items={queueItems} />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      ) : null}

      <Dialog open={walktourOpen} onClose={() => setWalktourOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 0.8 }}>
          {activeWalktourStep?.title}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {activeWalktourStep?.description}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1.2, display: 'block' }}>
            ขั้นตอน {walktourIndex + 1} / {walktourSteps.length}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.6 }}>
          <Button onClick={() => setWalktourOpen(false)}>ปิด</Button>
          <Button onClick={() => moveWalktour('prev')} disabled={walktourIndex === 0}>ก่อนหน้า</Button>
          <Button variant="contained" onClick={() => moveWalktour('next')} sx={{ bgcolor: '#73C088', '&:hover': { bgcolor: '#5ead77' } }}>
            {walktourIndex >= walktourSteps.length - 1 ? 'เสร็จสิ้น' : 'ถัดไป'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
