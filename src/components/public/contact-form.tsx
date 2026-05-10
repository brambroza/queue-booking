'use client';

import { FormEvent, useState } from 'react';
import { z } from 'zod';
import { Alert, Box, Button, MenuItem, Stack, TextField } from '@mui/material';
import { useToast } from '@/components/ui/toast';

const schema = z.object({
  name: z.string().min(2),
  company_name: z.string().optional(),
  phone: z.string().min(8),
  email: z.string().email(),
  business_type: z.string().min(2),
  message: z.string().min(5),
});

export function ContactForm() {
  const { push } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    const form = e.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      setError('กรุณากรอกข้อมูลให้ครบถ้วนและถูกต้อง');
      return;
    }

    setLoading(true);
    const res = await fetch('/api/contact-leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    });
    const json = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(json.error ?? 'ส่งฟอร์มไม่สำเร็จ');
      return;
    }

    form.reset();
    push('ส่งข้อมูลเรียบร้อย ทีมงานจะติดต่อกลับเร็วที่สุด', 'success');
  }

  return (
    <Box component="form" onSubmit={onSubmit} sx={{ display: 'grid', gap: 1.5 }}>
      {error ? <Alert severity="error">{error}</Alert> : null}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <TextField name="name" label="ชื่อ" fullWidth required />
        <TextField name="company_name" label="ชื่อบริษัท/ร้านค้า" fullWidth />
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <TextField name="phone" label="เบอร์โทร" fullWidth required />
        <TextField name="email" label="อีเมล" type="email" fullWidth required />
      </Stack>
      <TextField select name="business_type" label="ประเภทธุรกิจ" required defaultValue="">
        <MenuItem value="">เลือกประเภทธุรกิจ</MenuItem>
        <MenuItem value="ร้านตัดผม">ร้านตัดผม</MenuItem>
        <MenuItem value="คลินิก">คลินิก</MenuItem>
        <MenuItem value="ร้านอาหาร">ร้านอาหาร</MenuItem>
        <MenuItem value="ศูนย์บริการ">ศูนย์บริการ</MenuItem>
        <MenuItem value="อื่น ๆ">อื่น ๆ</MenuItem>
      </TextField>
      <TextField name="message" label="ข้อความ" multiline minRows={4} required />
      <Button type="submit" variant="contained" size="large" disabled={loading}>{loading ? 'กำลังส่ง...' : 'ส่งข้อมูลติดต่อ'}</Button>
    </Box>
  );
}
