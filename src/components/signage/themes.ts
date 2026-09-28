import type { CSSProperties } from 'react';
import type { SignageTheme } from '@/lib/signage/types';

/** One colour set for the signage. Exposed to templates as `--sg-*` CSS variables. */
export type SignagePalette = {
  id: SignageTheme;
  label_th: string;
  label_en: string;
  bg: string;
  bg2: string;
  surface: string;
  surface2: string;
  line: string;
  text: string;
  muted: string;
  accent: string;
  accentContrast: string;
  /** Second emphasis colour, used by the scene templates for the "please proceed" tag. */
  highlight: string;
  highlightContrast: string;
  /** Darker companion of `accent`, for chips that sit on an accent panel. */
  deep: string;
  isLight: boolean;
};

export const SIGNAGE_PALETTES: Record<SignageTheme, SignagePalette> = {
  emerald: {
    id: 'emerald', label_th: 'เขียวมรกต', label_en: 'Emerald',
    bg: '#070d07', bg2: '#0c1a10', surface: 'rgba(255,255,255,0.05)', surface2: 'rgba(255,255,255,0.09)',
    line: 'rgba(255,255,255,0.10)', text: '#eef8ee', muted: '#8ca98c', accent: '#4ade80', accentContrast: '#052e16', highlight: '#fbbf24', highlightContrast: '#2a1a00', deep: '#166534', isLight: false,
  },
  midnight: {
    id: 'midnight', label_th: 'มิดไนท์', label_en: 'Midnight',
    bg: '#0b0f16', bg2: '#101a2b', surface: 'rgba(255,255,255,0.05)', surface2: 'rgba(255,255,255,0.09)',
    line: 'rgba(255,255,255,0.10)', text: '#e6edf5', muted: '#94a1b2', accent: '#60a5fa', accentContrast: '#0b1a33', highlight: '#fbbf24', highlightContrast: '#2a1a00', deep: '#1e3a8a', isLight: false,
  },
  restaurant: {
    id: 'restaurant', label_th: 'ส้มอุ่น', label_en: 'Warm Orange',
    bg: '#1a0f08', bg2: '#0d0a08', surface: 'rgba(255,255,255,0.05)', surface2: 'rgba(255,255,255,0.09)',
    line: 'rgba(255,255,255,0.10)', text: '#fff4ea', muted: '#c9a58a', accent: '#fb923c', accentContrast: '#2a1204', highlight: '#fde68a', highlightContrast: '#3a1f12', deep: '#9a3412', isLight: false,
  },
  clinic: {
    id: 'clinic', label_th: 'ฟ้าคลินิก', label_en: 'Clinic Blue',
    bg: '#081420', bg2: '#0a1018', surface: 'rgba(255,255,255,0.05)', surface2: 'rgba(255,255,255,0.09)',
    line: 'rgba(255,255,255,0.10)', text: '#eaf6ff', muted: '#8fb3cc', accent: '#38bdf8', accentContrast: '#05202e', highlight: '#fda4af', highlightContrast: '#4a0d18', deep: '#075985', isLight: false,
  },
  meeting: {
    id: 'meeting', label_th: 'ม่วงประชุม', label_en: 'Meeting Violet',
    bg: '#120c22', bg2: '#0c0a14', surface: 'rgba(255,255,255,0.05)', surface2: 'rgba(255,255,255,0.09)',
    line: 'rgba(255,255,255,0.10)', text: '#f1ecff', muted: '#a99bc9', accent: '#a78bfa', accentContrast: '#1e1038', highlight: '#5eead4', highlightContrast: '#062b27', deep: '#4c1d95', isLight: false,
  },
  nail: {
    id: 'nail', label_th: 'ชมพูบิวตี้', label_en: 'Beauty Pink',
    bg: '#1f0a14', bg2: '#0f0a0f', surface: 'rgba(255,255,255,0.05)', surface2: 'rgba(255,255,255,0.09)',
    line: 'rgba(255,255,255,0.10)', text: '#fff0f6', muted: '#d1a3b8', accent: '#f9a8d4', accentContrast: '#3a0f24', highlight: '#fde68a', highlightContrast: '#3a1f12', deep: '#9d174d', isLight: false,
  },
  light: {
    id: 'light', label_th: 'สว่าง', label_en: 'Light',
    bg: '#f7f8fa', bg2: '#ffffff', surface: '#ffffff', surface2: '#f1f4f2',
    line: '#e3e8ef', text: '#121926', muted: '#697586', accent: '#12a862', accentContrast: '#ffffff', highlight: '#f59e0b', highlightContrast: '#2a1a00', deep: '#0b8d51', isLight: true,
  },
  day_navy: {
    id: 'day_navy', label_th: 'น้ำเงินคลาสสิก', label_en: 'Classic Navy',
    bg: '#F6F0E4', bg2: '#F6F0E4', surface: '#ffffff', surface2: 'rgba(31,45,92,0.1)',
    line: 'rgba(27,35,64,0.2)', text: '#1B2340', muted: 'rgba(27,35,64,0.68)', accent: '#1F2D5C', accentContrast: '#FFFFFF',
    highlight: '#D8382F', highlightContrast: '#FFFFFF', deep: '#141E42', isLight: true,
  },
  day_teal: {
    id: 'day_teal', label_th: 'ฟ้าสะอาด', label_en: 'Clean Teal',
    bg: '#EEF7F8', bg2: '#EEF7F8', surface: '#ffffff', surface2: 'rgba(15,124,138,0.1)',
    line: 'rgba(15,47,58,0.2)', text: '#0F2F3A', muted: 'rgba(15,47,58,0.68)', accent: '#0F7C8A', accentContrast: '#FFFFFF',
    highlight: '#FFB199', highlightContrast: '#4A1A0C', deep: '#0A5560', isLight: true,
  },
  day_brick: {
    id: 'day_brick', label_th: 'ส้มอิฐ', label_en: 'Brick',
    bg: '#FBF3E7', bg2: '#FBF3E7', surface: '#ffffff', surface2: 'rgba(184,69,31,0.1)',
    line: 'rgba(58,31,18,0.2)', text: '#3A1F12', muted: 'rgba(58,31,18,0.68)', accent: '#B8451F', accentContrast: '#FFFFFF',
    highlight: '#F9C74F', highlightContrast: '#3A1F12', deep: '#7E2C10', isLight: true,
  },
  day_chili: {
    id: 'day_chili', label_th: 'แดงพริก', label_en: 'Chili',
    bg: '#FFF4E0', bg2: '#FFF4E0', surface: '#ffffff', surface2: 'rgba(179,32,31,0.1)',
    line: 'rgba(59,15,15,0.2)', text: '#3B0F0F', muted: 'rgba(59,15,15,0.68)', accent: '#B3201F', accentContrast: '#FFFFFF',
    highlight: '#FFC93C', highlightContrast: '#3B0F0F', deep: '#7A1211', isLight: true,
  },
  day_indigo: {
    id: 'day_indigo', label_th: 'ม่วงคราม', label_en: 'Indigo',
    bg: '#F1F1F6', bg2: '#F1F1F6', surface: '#ffffff', surface2: 'rgba(63,61,158,0.1)',
    line: 'rgba(28,27,58,0.2)', text: '#1C1B3A', muted: 'rgba(28,27,58,0.68)', accent: '#3F3D9E', accentContrast: '#FFFFFF',
    highlight: '#5EE0CF', highlightContrast: '#0E2F2B', deep: '#2B2A73', isLight: true,
  },
  day_court: {
    id: 'day_court', label_th: 'เขียวสนาม', label_en: 'Court Green',
    bg: '#F0F7EC', bg2: '#F0F7EC', surface: '#ffffff', surface2: 'rgba(31,122,61,0.1)',
    line: 'rgba(18,48,28,0.2)', text: '#12301C', muted: 'rgba(18,48,28,0.68)', accent: '#1F7A3D', accentContrast: '#FFFFFF',
    highlight: '#FFD84A', highlightContrast: '#12301C', deep: '#14522A', isLight: true,
  },
  day_rose: {
    id: 'day_rose', label_th: 'ชมพูกุหลาบ', label_en: 'Rose',
    bg: '#FDF0F2', bg2: '#FDF0F2', surface: '#ffffff', surface2: 'rgba(178,58,94,0.1)',
    line: 'rgba(61,21,36,0.2)', text: '#3D1524', muted: 'rgba(61,21,36,0.68)', accent: '#B23A5E', accentContrast: '#FFFFFF',
    highlight: '#F2D088', highlightContrast: '#3D1524', deep: '#7C2440', isLight: true,
  },
  day_lime: {
    id: 'day_lime', label_th: 'ถ่านมะนาว', label_en: 'Charcoal Lime',
    bg: '#F3F6E8', bg2: '#F3F6E8', surface: '#ffffff', surface2: 'rgba(35,41,28,0.1)',
    line: 'rgba(29,34,22,0.2)', text: '#1D2216', muted: 'rgba(29,34,22,0.68)', accent: '#23291C', accentContrast: '#E4F76B',
    highlight: '#C6E835', highlightContrast: '#1D2216', deep: '#11150C', isLight: true,
  },
};

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const n = Number.parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Build the inline style that exposes a palette as `--sg-*` variables. */
export function paletteToStyle(palette: SignagePalette): CSSProperties {
  return {
    '--sg-bg': palette.bg,
    '--sg-bg-2': palette.bg2,
    '--sg-surface': palette.surface,
    '--sg-surface-2': palette.surface2,
    '--sg-line': palette.line,
    '--sg-text': palette.text,
    '--sg-muted': palette.muted,
    '--sg-accent': palette.accent,
    '--sg-accent-contrast': palette.accentContrast,
    '--sg-highlight': palette.highlight,
    '--sg-highlight-contrast': palette.highlightContrast,
    '--sg-deep': palette.deep,
    '--sg-accent-soft': hexToRgba(palette.accent, palette.isLight ? 0.12 : 0.16),
    '--sg-glow': hexToRgba(palette.accent, palette.isLight ? 0.25 : 0.45),
  } as CSSProperties;
}

/** Look up a palette, defaulting to emerald for unknown ids. */
export function getPalette(theme: SignageTheme | string | null | undefined): SignagePalette {
  return SIGNAGE_PALETTES[(theme ?? 'emerald') as SignageTheme] ?? SIGNAGE_PALETTES.emerald;
}
