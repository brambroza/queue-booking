import Link from 'next/link';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Grid,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import { features, pricingPlans, testimonials, useCases as useCaseCards } from './content';

const painCards = [
  { title: 'ลูกค้าทักถามคิวซ้ำ ๆ', desc: 'พนักงานต้องตอบข้อความเดิมซ้ำหลายสิบครั้งต่อวัน เสียเวลามาก', color: '#E24B4A' },
  { title: 'พนักงานตอบแชทไม่ทัน', desc: 'ลูกค้ารอนาน ได้รับประสบการณ์ที่ไม่ดี อาจยกเลิกไปใช้เจ้าอื่น', color: '#BA7517' },
  { title: 'คิวชนกันหรือจองซ้ำ', desc: 'จัดการคิวด้วยมือเกิดข้อผิดพลาด ลูกค้าผิดหวังและเสียโอกาส', color: '#D85A30' },
  { title: 'จัดการหลายสาขายาก', desc: 'ข้อมูลกระจัดกระจาย ไม่สามารถดูภาพรวมธุรกิจทั้งหมดได้', color: '#7F77DD' },
  { title: 'ไม่มีรายงานจำนวนคิว', desc: 'ไม่รู้ช่วงเวลาไหนคนเยอะ วางแผนพนักงานและบริการได้ยาก', color: '#1D9E75' },
  { title: 'ลูกค้าลืมนัดหรือไม่มา', desc: 'ไม่มีระบบแจ้งเตือน ทำให้คิวว่างโดยไม่ได้รับแจ้งล่วงหน้า', color: '#D4537E' },
];

const solutionCards = [
  { title: 'ลูกค้าถามคิวผ่าน LINE', desc: 'ตอบกลับอัตโนมัติทันที ไม่ต้องใช้พนักงาน', icon: <ForumRoundedIcon sx={{ color: '#639922' }} />, bg: '#EAF3DE' },
  { title: 'จองคิวผ่าน LIFF', desc: 'เปิดหน้าจองในแอป LINE ได้เลย สะดวกมาก', icon: <DashboardRoundedIcon sx={{ color: '#378ADD' }} />, bg: '#E6F1FB' },
  { title: 'ตอบกลับอัตโนมัติ', desc: 'Chatbot ตอบ 24/7 ไม่มีวันหยุด', icon: <SmartToyRoundedIcon sx={{ color: '#534AB7' }} />, bg: '#EEEDFE' },
  { title: 'จัดการคิวหลังบ้าน', desc: 'Dashboard ครบ ดู แก้ ยกเลิก คิวได้ทันที', icon: <DashboardRoundedIcon sx={{ color: '#639922' }} />, bg: '#EAF3DE' },
  { title: 'รองรับหลายสาขา', desc: 'บริหารหลายร้านหลายสาขาในที่เดียว', icon: <ApartmentRoundedIcon sx={{ color: '#854F0B' }} />, bg: '#FAEEDA' },
  { title: 'รายงานและสถิติ', desc: 'วิเคราะห์ข้อมูลเพื่อพัฒนาธุรกิจ', icon: <InsightsRoundedIcon sx={{ color: '#A32D2D' }} />, bg: '#FCEBEB' },
];

export function HeroSection() {
  return (
    <Box sx={{ background: '#fff', py: { xs: 8, md: 10 }, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Container maxWidth="lg">
        <Grid container spacing={4} alignItems="center">
          <Grid size={{ xs: 12, md: 7 }}>
            <Chip label="ระบบจองคิวผ่าน LINE OA" sx={{ bgcolor: '#EAF3DE', color: '#3B6D11', fontWeight: 600 }} />
            <Typography sx={{ mt: 2, fontSize: { xs: 32, md: 46 }, lineHeight: 1.2, fontWeight: 700 }}>
              ลูกค้าจองคิวผ่าน LINE ได้เอง


            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ mt: 3 }}>
              <Chip label="แจ้งเตือนอัตโนมัติ" sx={{ bgcolor: '#EAF3DE', color: '#3B6D11', fontWeight: 600 }} />
              <Chip label="เรียกคิวผ่านจอได้" sx={{ bgcolor: '#EAF3DE', color: '#3B6D11', fontWeight: 600 }} />
              <Chip label="ลด no-show" sx={{ bgcolor: '#EAF3DE', color: '#3B6D11', fontWeight: 600 }} />
              <Chip label="ใช้ได้หลายสาขา" sx={{ bgcolor: '#EAF3DE', color: '#3B6D11', fontWeight: 600 }} />
            </Stack>
            <Typography color="text.secondary" sx={{ mt: 2, maxWidth: 560, lineHeight: 1.8 }}>
              ให้ลูกค้าถามคิวว่างและจองคิวได้ง่ายผ่าน LINE พร้อมระบบหลังบ้านสำหรับจัดการร้าน สาขา บริการ คิว พนักงาน และรายงานครบในที่เดียว
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ mt: 3 }}>
              <Button component={Link} href="/register" variant="contained" sx={{ bgcolor: '#639922', '&:hover': { bgcolor: '#3B6D11' } }}>เริ่มใช้งานฟรี</Button>
              <Button component={Link} href="/pricing" variant="outlined" sx={{ borderColor: '#639922', color: '#639922' }}>ดูแผนราคา</Button>
              <Button component={Link} href="/contact" variant="outlined" color="inherit">ติดต่อเรา</Button>
              <Button component={Link} href="/blog" variant="text" color="inherit">อ่านบทความ</Button>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 3 }}>
              {['Starter ฟรี 3 เดือน', '100 bookings/เดือน', 'ตั้งค่าง่ายใน 5 นาที'].map((x) => (
                <Stack key={x} direction="row" spacing={0.8} alignItems="center">
                  <CheckCircleRoundedIcon sx={{ color: '#639922', fontSize: 18 }} />
                  <Typography variant="body2" color="text.secondary">{x}</Typography>
                </Stack>
              ))}
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, md: 5 }}>
            <Stack direction="row" spacing={1.5} alignItems="end">
              <Paper sx={{ p: 1.5, borderRadius: 1, flex: 1, border: '1px solid', borderColor: 'divider', boxShadow: '0 10px 28px rgba(15,23,42,0.06)' }}>
                <Typography variant="caption" color="text.secondary">Dashboard</Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <Box sx={{ flex: 1, bgcolor: '#EAF3DE', borderRadius: 1, p: 1.2, textAlign: 'center' }}><Typography fontWeight={700} color="#3B6D11">48</Typography><Typography variant="caption">คิววันนี้</Typography></Box>
                  <Box sx={{ flex: 1, bgcolor: '#E6F1FB', borderRadius: 1, p: 1.2, textAlign: 'center' }}><Typography fontWeight={700} color="#185FA5">12</Typography><Typography variant="caption">รอดำเนินการ</Typography></Box>
                </Stack>
                <Box sx={{ mt: 1, p: 1.2, bgcolor: '#F1EFE8', borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary">คิวถัดไป</Typography>
                  <Typography variant="body2" fontWeight={600}>คุณสมชาย ใจดี</Typography>
                  <Typography variant="caption" color="text.secondary">ตัดผม 09:30</Typography>
                </Box>
              </Paper>
              <Box sx={{ width: 165, bgcolor: '#06C755', borderRadius: 1, p: 1.5, color: '#fff', boxShadow: '0 10px 28px rgba(6,199,85,0.28)' }}>
                <Typography fontWeight={700} variant="caption">LINE Chat</Typography>
                <Box sx={{ mt: 1, bgcolor: 'rgba(255,255,255,0.2)', borderRadius: '10px 10px 2px 10px', p: 1, fontSize: 12 }}>คิวว่างวันนี้มีไหมครับ?</Box>
                <Box sx={{ mt: 0.8, bgcolor: 'rgba(255,255,255,0.92)', color: '#333', borderRadius: '2px 10px 10px 10px', p: 1, fontSize: 12 }}>มีว่าง 2 ช่วง เลือกเวลาได้เลยค่ะ</Box>
                <Stack spacing={0.6} sx={{ mt: 1 }}>{['09:30 น.', '11:00 น.'].map((x) => <Box key={x} sx={{ bgcolor: '#fff', borderRadius: 1.5, textAlign: 'center', color: '#06C755', py: 0.5, fontWeight: 700, fontSize: 12 }}>{x}</Box>)}</Stack>
              </Box>
            </Stack>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

export function StatsSection() {
  const stats = [['500+', 'ร้านค้าที่ใช้งาน'], ['50,000+', 'การจองต่อเดือน'], ['99.9%', 'Uptime'], ['4.9 ★', 'คะแนนเฉลี่ย']];
  return (
    <Box sx={{ bgcolor: '#f8faf9', py: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Container maxWidth="lg">
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          divider={<Divider orientation="vertical" flexItem />}
          spacing={1.5}
          justifyContent="center"
          alignItems="center"
        >
          {stats.map(([n, l]) => (
            <Box key={l} sx={{ textAlign: 'center', px: { xs: 1, md: 3 }, py: 0.6 }}>
              <Typography sx={{ fontSize: 26, fontWeight: 700, color: '#639922', lineHeight: 1.1 }}>{n}</Typography>
              <Typography variant="caption" color="text.secondary">{l}</Typography>
            </Box>
          ))}
        </Stack>
      </Container>
    </Box>
  );
}

export function PainPointSection() {
  return (
    <SectionWrap id="pain-points" title="ปัญหาที่ร้านค้าพบเจอทุกวัน" sub="ถ้าคุณเจอปัญหาเหล่านี้ เราช่วยได้" tag="ปัญหาที่พบ" bg="#f6f7f9">
      <Grid container spacing={2}>
        {painCards.map((p) => (
          <Grid key={p.title} size={{ xs: 12, md: 4 }}>
            <Card sx={{ borderRadius: 1, height: '100%' }}><CardContent><Box sx={{ width: 10, height: 10, borderRadius: 10, bgcolor: p.color, mb: 1 }} /><Typography fontWeight={700}>{p.title}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.8 }}>{p.desc}</Typography></CardContent></Card>
          </Grid>
        ))}
      </Grid>
    </SectionWrap>
  );
}

export function SolutionSection() {
  return (
    <SectionWrap id="features" title="จัดการคิวทั้งหมดผ่านระบบเดียว" sub="ระบบครบวงจรเชื่อมต่อ LINE OA ของคุณโดยตรง" tag="โซลูชัน" bg="#fff">
      <Grid container spacing={2}>
        {solutionCards.map((s) => (
          <Grid key={s.title} size={{ xs: 12, md: 4 }}>
            <Paper sx={{ p: 2, borderRadius: 1, height: '100%', border: '1px solid', borderColor: 'divider' }}>
              <Stack direction="row" spacing={1.4} alignItems="flex-start">
                <Box sx={{ width: 40, height: 40, borderRadius: 2.5, bgcolor: s.bg, display: 'grid', placeItems: 'center' }}>{s.icon}</Box>
                <Box><Typography fontWeight={700}>{s.title}</Typography><Typography variant="body2" color="text.secondary">{s.desc}</Typography></Box>
              </Stack>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </SectionWrap>
  );
}

export function ShowcaseSection() {
  return (
    <SectionWrap id="showcase" title="ใช้ได้กับหลายธุรกิจ" sub="รองรับทุกรูปแบบการนัดหมายและจองคิว" tag="Use Cases" bg="#f6f7f9">
      <Grid container spacing={1.5}>
        {useCaseCards.map((item) => {
          const Icon = item.icon;
          return (
            <Grid key={item.slug} size={{ xs: 6, md: 3 }}>
              <Card sx={{ textAlign: 'center', borderRadius: 1 }}>
                <CardContent sx={{ py: 2.2 }}>
                  <Icon sx={{ fontSize: 30, color: '#639922' }} />
                  <Typography fontWeight={700} sx={{ fontSize: 14, mt: 0.6 }}>{item.title}</Typography>
                  <Typography variant="caption" color="text.secondary">{item.mode}</Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
      <Stack alignItems="center" sx={{ mt: 2.5 }}>
        <Button component={Link} href="/use-cases" variant="outlined" sx={{ borderColor: '#639922', color: '#639922' }}>
          ดูตัวอย่างธุรกิจทั้งหมด
        </Button>
      </Stack>
    </SectionWrap>
  );
}

export function FeatureSection() {
  return (
    <SectionWrap title="ฟีเจอร์หลักของระบบ" sub="ครบทุกอย่างที่ต้องการสำหรับการจัดการคิวมืออาชีพ" tag="ฟีเจอร์" bg="#fff">
      <Grid container spacing={1.5}>
        {features.map((f) => (
          <Grid key={f} size={{ xs: 6, md: 3 }}>
            <Paper sx={{ p: 1.5, borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
              <Typography sx={{ fontSize: 13 }}>{f}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </SectionWrap>
  );
}

export function HowItWorksSection() {
  const steps = ['สมัครใช้งานและสร้างร้านค้า', 'ตั้งค่าสาขา บริการ เวลาทำการ และเชื่อม LINE OA', 'ให้ลูกค้าจองคิวผ่าน LINE และจัดการผ่าน Dashboard'];
  return (
    <SectionWrap title="เริ่มใช้งานง่ายใน 3 ขั้นตอน" sub="ระบบออกแบบให้เริ่มได้รวดเร็ว" tag="How it works" bg="#f6f7f9">
      <Grid container spacing={2}>{steps.map((s, i) => <Grid key={s} size={{ xs: 12, md: 4 }}><Card sx={{ borderRadius: 1, height: '100%' }}><CardContent><Chip label={`Step ${i + 1}`} sx={{ bgcolor: '#EAF3DE', color: '#3B6D11' }} /><Typography sx={{ mt: 1.2 }}>{s}</Typography></CardContent></Card></Grid>)}</Grid>
    </SectionWrap>
  );
}

export function PricingPreviewSection() {
  return (
    <SectionWrap id="pricing" title="เลือกแผนที่เหมาะกับธุรกิจของคุณ" sub="มีทั้งแพ็กเกจมาตรฐานและแบบ Custom สำหรับร้านอาหาร บุฟเฟ่ต์ และห้องประชุม" tag="Pricing" bg="#fff">
      <Grid container spacing={2}>
        {pricingPlans.map((p) => (
          <Grid key={p.name} size={{ xs: 12, md: 6, lg: 3 }}>
            <Card sx={{ borderRadius: 1, border: p.highlight ? '2px solid #73c088' : undefined, height: '100%' }}>
              <CardContent>
                <Typography fontWeight={700}>{p.name}</Typography>
                <Typography sx={{ fontSize: 34, fontWeight: 800, mt: 0.5 }}>{p.price}</Typography>
                <Typography variant="caption" color="text.secondary">{p.name === 'Custom' ? 'ติดต่อทีมขาย' : 'บาท / เดือน'}</Typography>
                <Divider sx={{ my: 1.2 }} />
                <Stack spacing={0.5}>{p.items.map((x) => <Typography key={x} variant="body2">• {x}</Typography>)}</Stack>
                <Button
                  component={Link}
                  href={p.name === 'Custom' ? '/contact' : `/register?plan=${encodeURIComponent(p.name)}`}
                  variant="contained"
                  fullWidth
                  sx={{ mt: 2, bgcolor: '#639922', '&:hover': { bgcolor: '#3B6D11' } }}
                >
                  {p.name === 'Custom' ? 'ขอใบเสนอราคา' : 'เริ่มใช้งาน'}
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </SectionWrap>
  );
}

export function TestimonialSection() {
  return (
    <SectionWrap title="ร้านค้าที่ใช้ระบบจัดการคิวได้ง่ายขึ้น" sub="เสียงตอบรับจากธุรกิจบริการ" tag="Testimonials" bg="#f6f7f9">
      <Grid container spacing={2}>{testimonials.map((t) => <Grid key={t.name} size={{ xs: 12, md: 4 }}><Card sx={{ borderRadius: 1, height: '100%' }}><CardContent><Typography>“{t.quote}”</Typography><Typography fontWeight={700} sx={{ mt: 1.2 }}>{t.name}</Typography><Typography variant="caption" color="text.secondary">{t.type}</Typography></CardContent></Card></Grid>)}</Grid>
    </SectionWrap>
  );
}

export function CtaSection() {
  return (
    <Container id="contact" maxWidth="lg" sx={{ py: 8, scrollMarginTop: '96px' }}>
      <Paper
        sx={{
          p: { xs: 3, md: 5 },
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider',
          background: 'linear-gradient(135deg,#ffffff 0%,#f6fbf8 100%)',
          boxShadow: '0 14px 40px rgba(15,23,42,0.06)',
        }}
      >
        <Stack spacing={2}>
          <Box
            sx={{
              width: 'fit-content',
              px: 1.4,
              py: 0.5,
              borderRadius: 10,
              bgcolor: '#EAF3DE',
              color: '#3B6D11',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            พร้อมเริ่มใช้งาน
          </Box>

          <Typography sx={{ fontSize: { xs: 28, md: 38 }, lineHeight: 1.2, fontWeight: 800 }}>
            พร้อมให้ลูกค้าจองคิวผ่าน LINE แล้วหรือยัง?
          </Typography>

          <Typography color="text.secondary" sx={{ maxWidth: 680 }}>
            เริ่มต้นสร้างระบบจองคิวของร้านคุณได้ภายในไม่กี่นาที ลดงานตอบแชทซ้ำ และจัดการคิวได้เป็นระบบมากขึ้นทันที
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ pt: 0.5 }}>
            <Button component={Link} href="/register" variant="contained" sx={{ bgcolor: '#639922', '&:hover': { bgcolor: '#3B6D11' } }}>
              เริ่มใช้งานฟรี
            </Button>
            <Button component={Link} href="/contact" variant="outlined" sx={{ borderColor: '#639922', color: '#639922' }}>
              ติดต่อทีมงาน
            </Button>
            <Button component={Link} href="/pricing" variant="text" color="inherit">
              ดูแผนราคา
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            โปรโมชัน Starter ฟรี 3 เดือน • 100 bookings/เดือน • ตั้งค่าเริ่มต้นได้ใน 5 นาที
          </Typography>
        </Stack>
      </Paper>
    </Container>
  );
}

function SectionWrap({ id, title, sub, tag, bg, children }: { id?: string; title: string; sub: string; tag: string; bg: string; children: React.ReactNode }) {
  return (
    <Box id={id} sx={{ py: 8, bgcolor: bg, scrollMarginTop: '96px' }}>
      <Container maxWidth="lg">
        <Stack alignItems="center" sx={{ mb: 3 }}>
          <Chip label={tag} sx={{ bgcolor: '#EAF3DE', color: '#3B6D11', mb: 1 }} />
          <Typography variant="h4" fontWeight={700} textAlign="center">{title}</Typography>
          <Typography color="text.secondary" textAlign="center" sx={{ mt: 0.5 }}>{sub}</Typography>
        </Stack>
        {children}
      </Container>
    </Box>
  );
}
