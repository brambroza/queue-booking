'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Divider,
  FormControlLabel,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import DownloadingRoundedIcon from '@mui/icons-material/DownloadingRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import { brand, lineGreen, neutral } from '@/theme/tokens';
import { useToast } from '@/components/ui/toast';

/** รูปแบบพื้นหลังของไอคอนที่ดาวน์โหลดได้ */
export type IconVariant = 'plain' | 'white' | 'tint' | 'solid';

type TileColors = { glyph: string; knockout: string; bg: string | null; label: string };

type IconDef = {
  key: string;
  defaultLabel: string;
  /** วาดด้วย viewBox 0 0 24 24 — c = สีหลัก, k = สี knockout */
  svg: (c: string, k: string) => string;
};

/** สีพรีเซ็ตที่แนะนำสำหรับ Rich Menu */
const COLOR_PRESETS: { label: string; value: string }[] = [
  { label: 'LINE Green', value: lineGreen },
  { label: 'Brand Green', value: brand[500] },
  { label: 'Deep Green', value: brand[700] },
  { label: 'Ocean', value: '#2e8ad8' },
  { label: 'Navy', value: '#1f3a8a' },
  { label: 'Sunset', value: '#f07d29' },
  { label: 'Rose', value: '#e0508a' },
  { label: 'Purple', value: '#7b52d3' },
  { label: 'Charcoal', value: neutral[800] },
];

const SIZE_OPTIONS = [300, 512, 1024];

const VARIANT_OPTIONS: { value: IconVariant; label: string }[] = [
  { value: 'plain', label: 'พื้นหลังโปร่งใส' },
  { value: 'white', label: 'พื้นหลังขาว' },
  { value: 'tint', label: 'พื้นหลังสีอ่อน' },
  { value: 'solid', label: 'พื้นหลังสีเข้ม' },
];

const ICONS: IconDef[] = [
  {
    key: 'booking',
    defaultLabel: 'จองคิว',
    svg: (c, k) => `
      <rect x="2.4" y="4" width="14.4" height="14" rx="3.2" fill="${c}"/>
      <rect x="5.6" y="1.8" width="2.2" height="4.4" rx="1.1" fill="${c}"/>
      <rect x="11.4" y="1.8" width="2.2" height="4.4" rx="1.1" fill="${c}"/>
      <path d="M6.3 11.4l2.3 2.3 4.1-4.4" fill="none" stroke="${k}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="17.6" cy="17.4" r="5.6" fill="${k}"/>
      <circle cx="17.6" cy="17.4" r="4.4" fill="${c}"/>
      <path d="M17.6 14.9v2.7h2" fill="none" stroke="${k}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    `,
  },
  {
    key: 'member',
    defaultLabel: 'ข้อมูลสมาชิก',
    svg: (c, k) => `
      <rect x="10.6" y="7" width="12.4" height="9.6" rx="2.4" fill="${c}"/>
      <circle cx="15.2" cy="10.8" r="1.7" fill="${k}"/>
      <rect x="18" y="9.9" width="4.2" height="1.5" rx="0.75" fill="${k}"/>
      <rect x="18" y="12.7" width="4.2" height="1.5" rx="0.75" fill="${k}"/>
      <path d="M11.4 16.6c-0.9-1.4-2.2-2.4-3.7-2.9" fill="none" stroke="${k}" stroke-width="1.2" stroke-linecap="round"/>
      <circle cx="7.2" cy="6.9" r="3.9" fill="${c}"/>
      <path d="M1 20.4c0-3.4 2.8-6.2 6.2-6.2s6.2 2.8 6.2 6.2z" fill="${c}"/>
    `,
  },
  {
    key: 'check-queue',
    defaultLabel: 'เช็คคิวของฉัน',
    svg: (c, k) => `
      <rect x="2.2" y="2.8" width="15.6" height="18.4" rx="3.2" fill="${c}"/>
      <rect x="5.2" y="6.6" width="7.6" height="1.9" rx="0.95" fill="${k}"/>
      <rect x="5.2" y="10.4" width="9.6" height="1.9" rx="0.95" fill="${k}"/>
      <rect x="5.2" y="14.2" width="5.6" height="1.9" rx="0.95" fill="${k}"/>
      <circle cx="17.8" cy="17.2" r="5.8" fill="${k}"/>
      <circle cx="17.8" cy="17.2" r="4.6" fill="${c}"/>
      <path d="M15.8 17.3l1.5 1.5 2.6-2.9" fill="none" stroke="${k}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    `,
  },
  {
    key: 'contact',
    defaultLabel: 'ติดต่อร้าน',
    svg: (c, k) => `
      <rect x="1.8" y="3" width="20.4" height="14.4" rx="4.2" fill="${c}"/>
      <path d="M7.4 15.6h5.4l-4.6 6.6z" fill="${c}"/>
      <circle cx="7.6" cy="10.2" r="1.6" fill="${k}"/>
      <circle cx="12" cy="10.2" r="1.6" fill="${k}"/>
      <circle cx="16.4" cy="10.2" r="1.6" fill="${k}"/>
    `,
  },
  {
    key: 'services',
    defaultLabel: 'บริการของเรา',
    svg: (c, k) => `
      <rect x="2.2" y="2.2" width="8.8" height="8.8" rx="2.6" fill="${c}"/>
      <rect x="13" y="2.2" width="8.8" height="8.8" rx="2.6" fill="${c}"/>
      <rect x="2.2" y="13" width="8.8" height="8.8" rx="2.6" fill="${c}"/>
      <rect x="13" y="13" width="8.8" height="8.8" rx="2.6" fill="${c}"/>
      <path d="M15.2 17.4l1.6 1.6 3-3.4" fill="none" stroke="${k}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    `,
  },
  {
    key: 'location',
    defaultLabel: 'ที่ตั้งร้าน',
    svg: (c, k) => `
      <path d="M12 1.4c-4.5 0-8.1 3.6-8.1 8.1 0 5.8 8.1 13.1 8.1 13.1s8.1-7.3 8.1-13.1c0-4.5-3.6-8.1-8.1-8.1z" fill="${c}"/>
      <circle cx="12" cy="9.4" r="3.2" fill="${k}"/>
    `,
  },
  {
    key: 'hours',
    defaultLabel: 'เวลาทำการ',
    svg: (c, k) => `
      <circle cx="12" cy="12" r="9.8" fill="${c}"/>
      <path d="M12 6.2V12l4.1 2.5" fill="none" stroke="${k}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    `,
  },
  {
    key: 'promotion',
    defaultLabel: 'โปรโมชั่น',
    svg: (c, k) => `
      <path d="M11.6 1.8H20a2.2 2.2 0 0 1 2.2 2.2v8.4a2.4 2.4 0 0 1-0.7 1.7l-7.4 7.4a2.4 2.4 0 0 1-3.4 0l-8-8a2.4 2.4 0 0 1 0-3.4l7.4-7.4a2.4 2.4 0 0 1 1.5-0.9z" fill="${c}"/>
      <circle cx="17.2" cy="6.8" r="2.1" fill="${k}"/>
    `,
  },
];

/** แปลง hex เป็น rgba string ตาม alpha ที่กำหนด */
function withAlpha(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  const full = normalized.length === 3
    ? normalized.split('').map((ch) => ch + ch).join('')
    : normalized;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** ผสมสีกับสีขาวเพื่อให้ได้ tint ทึบ (ใช้กับ canvas ที่ไม่ต้องการ alpha) */
function mixWithWhite(hex: string, ratio: number) {
  const normalized = hex.replace('#', '');
  const full = normalized.length === 3
    ? normalized.split('').map((ch) => ch + ch).join('')
    : normalized;
  const channels = [0, 2, 4].map((i) => {
    const value = parseInt(full.slice(i, i + 2), 16);
    return Math.round(value + (255 - value) * (1 - ratio));
  });
  return `#${channels.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** เลือกสี glyph / knockout / พื้นหลัง ตาม variant */
function resolveColors(color: string, variant: IconVariant): TileColors {
  if (variant === 'solid') {
    return { glyph: '#ffffff', knockout: color, bg: color, label: '#ffffff' };
  }
  if (variant === 'tint') {
    const tint = mixWithWhite(color, 0.12);
    return { glyph: color, knockout: tint, bg: tint, label: neutral[900] };
  }
  if (variant === 'white') {
    return { glyph: color, knockout: '#ffffff', bg: '#ffffff', label: neutral[900] };
  }
  return { glyph: color, knockout: '#ffffff', bg: null, label: neutral[900] };
}

/** สร้าง SVG markup ของไอคอน (ไม่รวม label) */
function buildIconSvg(def: IconDef, colors: TileColors, size: number) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">${def.svg(colors.glyph, colors.knockout)}</svg>`;
}

/** โหลด SVG string เป็น HTMLImageElement เพื่อวาดลง canvas */
function loadSvgImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('load svg failed'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

/** อ่าน font stack จริงของหน้า (Kanit) มาใช้กับ canvas */
function resolveFontStack() {
  if (typeof window === 'undefined') return 'sans-serif';
  const family = window.getComputedStyle(document.body).fontFamily;
  return family || 'sans-serif';
}

type TileOptions = {
  color: string;
  variant: IconVariant;
  showLabel: boolean;
  radiusRatio: number;
};

/** วาดไอคอน 1 ชิ้นลง canvas ตามขนาดที่กำหนด */
async function drawTile(
  canvas: HTMLCanvasElement,
  def: IconDef,
  label: string,
  size: number,
  options: TileOptions,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const colors = resolveColors(options.color, options.variant);
  canvas.width = size;
  canvas.height = size;
  ctx.clearRect(0, 0, size, size);

  if (colors.bg) {
    const radius = size * options.radiusRatio;
    ctx.fillStyle = colors.bg;
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(0, 0, size, size, radius);
      ctx.fill();
    } else {
      ctx.fillRect(0, 0, size, size);
    }
  }

  const glyphSize = options.showLabel ? size * 0.5 : size * 0.62;
  const glyphX = (size - glyphSize) / 2;
  const glyphY = options.showLabel ? size * 0.14 : (size - glyphSize) / 2;
  const img = await loadSvgImage(buildIconSvg(def, colors, Math.round(glyphSize)));
  ctx.drawImage(img, glyphX, glyphY, glyphSize, glyphSize);

  if (options.showLabel && label.trim()) {
    const fontSize = size * (label.trim().length > 10 ? 0.1 : 0.125);
    ctx.fillStyle = colors.label;
    ctx.font = `700 ${fontSize}px ${resolveFontStack()}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label.trim(), size / 2, size * 0.82, size * 0.9);
  }
}

/** สั่งดาวน์โหลด canvas เป็นไฟล์ PNG */
function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  return new Promise<void>((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) return resolve();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      resolve();
    }, 'image/png');
  });
}

type PreviewTileProps = {
  def: IconDef;
  label: string;
  options: TileOptions;
  onLabelChange: (value: string) => void;
  onDownload: () => void;
};

/** การ์ดพรีวิว 1 ไอคอน + ปุ่มดาวน์โหลด + แก้ข้อความ */
function PreviewTile({ def, label, options, onLabelChange, onDownload }: PreviewTileProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    void (async () => {
      if (typeof document !== 'undefined' && document.fonts?.ready) await document.fonts.ready;
      if (cancelled || !canvasRef.current) return;
      await drawTile(canvasRef.current, def, label, 320, options);
    })();
    return () => {
      cancelled = true;
    };
  }, [def, label, options]);

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Stack spacing={1.2} alignItems="stretch">
          <Box
            sx={{
              borderRadius: 2,
              p: 1,
              display: 'flex',
              justifyContent: 'center',
              background:
                options.variant === 'plain'
                  ? 'repeating-conic-gradient(#f1f3f6 0% 25%, #ffffff 0% 50%) 50% / 16px 16px'
                  : 'transparent',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <canvas ref={canvasRef} style={{ width: 148, height: 148 }} />
          </Box>
          <TextField
            size="small"
            label="ข้อความใต้ไอคอน"
            value={label}
            onChange={(e) => onLabelChange(e.target.value)}
          />
          <Button size="small" variant="outlined" startIcon={<DownloadRoundedIcon />} onClick={onDownload}>
            ดาวน์โหลด PNG
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

type SheetLayout = '3x2' | '3x1' | '2x1';

const SHEET_LAYOUTS: { value: SheetLayout; label: string; cols: number; rows: number; width: number; height: number }[] = [
  { value: '3x2', label: '6 ปุ่ม (2500 × 1686)', cols: 3, rows: 2, width: 2500, height: 1686 },
  { value: '3x1', label: '3 ปุ่ม (2500 × 843)', cols: 3, rows: 1, width: 2500, height: 843 },
  { value: '2x1', label: '2 ปุ่ม (2500 × 843)', cols: 2, rows: 1, width: 2500, height: 843 },
];

/**
 * Rich Menu Icon Studio
 * ให้เจ้าของร้านเลือกสี ปรับข้อความ แล้วดาวน์โหลดไอคอน PNG
 * รวมถึง export ภาพ Rich Menu เต็มขนาดสำหรับอัปโหลดเข้า LINE OA Manager
 */
export function RichMenuIconStudio() {
  const { push } = useToast();
  const [color, setColor] = useState<string>(lineGreen);
  const [variant, setVariant] = useState<IconVariant>('white');
  const [size, setSize] = useState<number>(512);
  const [showLabel, setShowLabel] = useState<boolean>(true);
  const [labels, setLabels] = useState<Record<string, string>>(
    () => Object.fromEntries(ICONS.map((icon) => [icon.key, icon.defaultLabel])),
  );
  const [sheetLayout, setSheetLayout] = useState<SheetLayout>('3x2');
  const [busy, setBusy] = useState(false);

  const options = useMemo<TileOptions>(
    () => ({ color, variant, showLabel, radiusRatio: 0.16 }),
    [color, variant, showLabel],
  );

  const downloadIcon = useCallback(
    async (def: IconDef) => {
      const canvas = document.createElement('canvas');
      await drawTile(canvas, def, labels[def.key] ?? def.defaultLabel, size, options);
      await downloadCanvas(canvas, `richmenu-${def.key}-${size}.png`);
    },
    [labels, options, size],
  );

  const downloadAll = useCallback(async () => {
    setBusy(true);
    try {
      for (const def of ICONS) {
        // eslint-disable-next-line no-await-in-loop
        await downloadIcon(def);
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      push('ดาวน์โหลดไอคอนทั้งหมดแล้ว');
    } catch {
      push('ดาวน์โหลดไม่สำเร็จ', 'error');
    } finally {
      setBusy(false);
    }
  }, [downloadIcon, push]);

  const downloadSheet = useCallback(async () => {
    const layout = SHEET_LAYOUTS.find((x) => x.value === sheetLayout);
    if (!layout) return;
    setBusy(true);
    try {
      if (typeof document !== 'undefined' && document.fonts?.ready) await document.fonts.ready;
      const canvas = document.createElement('canvas');
      canvas.width = layout.width;
      canvas.height = layout.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const colors = resolveColors(color, variant);
      ctx.fillStyle = colors.bg ?? '#ffffff';
      ctx.fillRect(0, 0, layout.width, layout.height);

      const cellW = layout.width / layout.cols;
      const cellH = layout.height / layout.rows;
      const cellCount = layout.cols * layout.rows;
      const glyphSize = Math.min(cellW, cellH) * (showLabel ? 0.36 : 0.46);
      const fontStack = resolveFontStack();

      for (let i = 0; i < cellCount; i += 1) {
        const def = ICONS[i];
        if (!def) break;
        const col = i % layout.cols;
        const row = Math.floor(i / layout.cols);
        const cx = col * cellW + cellW / 2;
        const cy = row * cellH + cellH / 2;
        const label = (labels[def.key] ?? def.defaultLabel).trim();

        // eslint-disable-next-line no-await-in-loop
        const img = await loadSvgImage(buildIconSvg(def, colors, Math.round(glyphSize)));
        const glyphY = showLabel ? cy - glyphSize * 0.72 : cy - glyphSize / 2;
        ctx.drawImage(img, cx - glyphSize / 2, glyphY, glyphSize, glyphSize);

        if (showLabel && label) {
          const fontSize = Math.min(cellW, cellH) * (label.length > 10 ? 0.1 : 0.12);
          ctx.fillStyle = colors.label;
          ctx.font = `700 ${fontSize}px ${fontStack}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, cx, cy + glyphSize * 0.62, cellW * 0.82);
        }
      }

      // เส้นแบ่งช่องให้ผู้ใช้เห็นขอบเขตปุ่ม
      ctx.strokeStyle = variant === 'solid' ? 'rgba(255,255,255,0.35)' : withAlpha(neutral[300], 0.9);
      ctx.lineWidth = Math.max(2, layout.width * 0.0016);
      for (let c = 1; c < layout.cols; c += 1) {
        ctx.beginPath();
        ctx.moveTo(c * cellW, 0);
        ctx.lineTo(c * cellW, layout.height);
        ctx.stroke();
      }
      for (let r = 1; r < layout.rows; r += 1) {
        ctx.beginPath();
        ctx.moveTo(0, r * cellH);
        ctx.lineTo(layout.width, r * cellH);
        ctx.stroke();
      }

      await downloadCanvas(canvas, `richmenu-sheet-${layout.value}-${layout.width}x${layout.height}.png`);
      push('ดาวน์โหลดภาพ Rich Menu แล้ว');
    } catch {
      push('สร้างภาพ Rich Menu ไม่สำเร็จ', 'error');
    } finally {
      setBusy(false);
    }
  }, [color, labels, push, sheetLayout, showLabel, variant]);

  const resetLabels = useCallback(() => {
    setLabels(Object.fromEntries(ICONS.map((icon) => [icon.key, icon.defaultLabel])));
  }, []);

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>Step 4: ไอคอน Rich Menu (เลือกสี + ดาวน์โหลด)</Typography>
            <Typography variant="body2" color="text.secondary">
              เลือกสีให้ตรงกับแบรนด์ร้าน แก้ข้อความใต้ไอคอนได้ แล้วดาวน์โหลดเป็น PNG ไปใช้ใน LINE OA Manager
            </Typography>
          </Box>

          <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center">
            {COLOR_PRESETS.map((preset) => (
              <Tooltip key={preset.value} title={preset.label}>
                <Box
                  role="button"
                  aria-label={preset.label}
                  onClick={() => setColor(preset.value)}
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    bgcolor: preset.value,
                    cursor: 'pointer',
                    outline: color.toLowerCase() === preset.value.toLowerCase() ? '3px solid' : '1px solid',
                    outlineColor: color.toLowerCase() === preset.value.toLowerCase() ? 'text.primary' : 'divider',
                    outlineOffset: 2,
                  }}
                />
              </Tooltip>
            ))}
            <Chip label={color.toUpperCase()} size="small" variant="outlined" />
          </Stack>

          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                fullWidth
                size="small"
                type="color"
                label="สีที่กำหนดเอง"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                fullWidth
                select
                size="small"
                label="รูปแบบพื้นหลัง"
                value={variant}
                onChange={(e) => setVariant(e.target.value as IconVariant)}
              >
                {VARIANT_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                fullWidth
                select
                size="small"
                label="ขนาดไฟล์ (px)"
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
              >
                {SIZE_OPTIONS.map((opt) => (
                  <MenuItem key={opt} value={opt}>{`${opt} × ${opt}`}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Stack direction="row" spacing={1} alignItems="center" height="100%">
                <FormControlLabel
                  control={<Checkbox checked={showLabel} onChange={(e) => setShowLabel(e.target.checked)} />}
                  label="ใส่ข้อความใต้ไอคอน"
                />
                <Tooltip title="คืนค่าข้อความเริ่มต้น">
                  <Button size="small" onClick={resetLabels} startIcon={<RestartAltRoundedIcon />}>รีเซ็ต</Button>
                </Tooltip>
              </Stack>
            </Grid>
          </Grid>

          <Grid container spacing={1.5}>
            {ICONS.map((def) => (
              <Grid key={def.key} size={{ xs: 6, sm: 4, md: 3 }}>
                <PreviewTile
                  def={def}
                  label={labels[def.key] ?? def.defaultLabel}
                  options={options}
                  onLabelChange={(value) => setLabels((prev) => ({ ...prev, [def.key]: value }))}
                  onDownload={() => void downloadIcon(def)}
                />
              </Grid>
            ))}
          </Grid>

          <Divider />

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }}>
            <Button
              variant="contained"
              disabled={busy}
              startIcon={<DownloadingRoundedIcon />}
              onClick={() => void downloadAll()}
            >
              ดาวน์โหลดไอคอนทั้งหมด ({ICONS.length} ไฟล์)
            </Button>
            <TextField
              select
              size="small"
              label="เลย์เอาต์ Rich Menu"
              value={sheetLayout}
              onChange={(e) => setSheetLayout(e.target.value as SheetLayout)}
              sx={{ minWidth: 220 }}
            >
              {SHEET_LAYOUTS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </TextField>
            <Button
              variant="outlined"
              disabled={busy}
              startIcon={<DownloadRoundedIcon />}
              onClick={() => void downloadSheet()}
            >
              ดาวน์โหลดภาพ Rich Menu เต็มขนาด
            </Button>
          </Stack>

          <Typography variant="caption" color="text.secondary">
            หมายเหตุ: LINE รองรับภาพ Rich Menu ขนาด 2500 × 1686 หรือ 2500 × 843 (PNG/JPEG ไม่เกิน 1 MB)
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
