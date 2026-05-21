import type { Metadata } from 'next';
import { Container } from '@mui/material';
import { PublicNavbar } from '@/components/public/public-navbar';
import { PublicFooter } from '@/components/public/public-footer';
import { DemoLineExperiencePanel } from '@/components/demo/demo-line-experience-panel';

export const metadata: Metadata = {
  title: 'โหมดทดลองระบบจองคิวผ่าน LINE | QueueBooking LINE',
  description: 'ทดลองประสบการณ์ลูกค้าและหลังบ้านของระบบจองคิวผ่าน LINE ได้ทันที โดยไม่ต้องล็อกอิน พร้อม Step Guide แบบเข้าใจง่าย',
  alternates: {
    canonical: '/sandbox-demo',
  },
};

export default function SandboxDemoPage() {
  return (
    <main>
      <PublicNavbar />
      <Container maxWidth="xl" sx={{ py: 4 }}>
       

         

        <DemoLineExperiencePanel />
      </Container>
      <PublicFooter />
    </main>
  );
}
