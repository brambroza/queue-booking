'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Card, CardContent, Chip, Grid, MenuItem, Stack, TextField, Typography } from '@mui/material';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import PhoneInTalkRoundedIcon from '@mui/icons-material/PhoneInTalkRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import QueueRoundedIcon from '@mui/icons-material/QueueRounded';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
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

  const [template, setTemplate] = useState<DemoTemplate>('barber');
  const [activeMenu, setActiveMenu] = useState<DemoMenuAction>('booking');
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [typing, setTyping] = useState(false);
  const [showLiff, setShowLiff] = useState(true);
  const [lastBooking, setLastBooking] = useState<DemoBooking | null>(null);
  const [queueItems, setQueueItems] = useState<DemoQueueItem[]>(seededQueue);
  const [currentStep, setCurrentStep] = useState<2 | 3 | 4 | 5>(2);
  const [unlockedSteps, setUnlockedSteps] = useState<Record<2 | 3 | 4 | 5, boolean>>({
    2: true,
    3: false,
    4: false,
    5: false,
  });
  const [memberProfile, setMemberProfile] = useState<DemoMemberProfile>({
    name: 'ลูกค้าประจำ',
    phone: '085-608-3298',
    tier: 'Silver',
    points: 120,
    totalBookings: 6,
    lastQueueNo: 'A003',
  });

  const templateConfig = useMemo(() => TEMPLATE_CONFIG[template], [template]);

  function unlockStep(step: 2 | 3 | 4 | 5) {
    setUnlockedSteps((prev) => (prev[step] ? prev : { ...prev, [step]: true }));
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
    setUnlockedSteps({ 2: true, 3: false, 4: false, 5: false });
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
      <Card sx={{ borderRadius: 1, border: '1px solid', borderColor: 'divider', boxShadow: 'none', bgcolor: '#fafcfa' }}>
        <CardContent sx={{ py: 1.2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', md: 'center' }}>
            <Typography variant="caption" color="text.secondary">ลำดับการทดลอง:</Typography>
            <Stack direction="row" spacing={0.8} flexWrap="wrap">
              {[2, 3, 4, 5].map((step) => {
                const typedStep = step as 2 | 3 | 4 | 5;
                const unlocked = unlockedSteps[typedStep];
                const active = currentStep === typedStep;
                return (
                  <Chip
                    key={step}
                    label={`STEP ${step}`}
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
              เริ่มจาก STEP 2 แล้วระบบจะปลดล็อกขั้นถัดไปให้อัตโนมัติ
            </Typography>
          </Stack>
        </CardContent>
      </Card>

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
              <Button  onClick={() => handleEvent({ type: 'reset' })} variant="outlined" startIcon={<RefreshRoundedIcon />}>Reset Demo</Button>
              <Button onClick={() => handleEvent({ type: 'menu', key: 'booking' })} variant="contained" startIcon={<PlayArrowRoundedIcon />} sx={{ bgcolor: '#73C088', '&:hover': { bgcolor: '#5ead77' } }}>
                เริ่ม Flow จองคิว
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Grid container spacing={2.2}>
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
                <Typography variant="caption" color="text.secondary">STEP 2: LINE Chat Simulator</Typography>
              </Box>
              <LineChatSimulator messages={messages} typing={typing} onQuickReply={(k) => handleEvent({ type: 'quick', key: k })} memberProfile={memberProfile} shopName={templateConfig.shopName} />
              <RichMenuSimulator active={activeMenu} onSelect={(key) => handleEvent({ type: 'menu', key })} labels={templateConfig.menuLabels} />
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, xl: 6 }}>
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
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.6 }}>STEP 3: LIFF Booking</Typography>
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
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.6 }}>STEP 4: Queue Notification</Typography>
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

      {unlockedSteps[5] ? (
      <Grid container spacing={2.2}>
        <Grid size={{ xs: 12 }}>
          <Card sx={{ borderRadius: 1, border: currentStep === 5 ? '2px solid #73c088' : undefined }}>
            <CardContent>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.6 }}>STEP 5: Queue Board</Typography>
              <DemoQueueBoard items={queueItems} />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <Card sx={{ borderRadius: 1, border: currentStep === 5 ? '2px solid #73c088' : undefined }}>
            <CardContent>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.6 }}>STEP 5: Signage View</Typography>
              <DemoSignage items={queueItems} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      ) : null}
    </Stack>
  );
}
