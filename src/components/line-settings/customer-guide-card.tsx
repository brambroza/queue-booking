'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { track } from '@/lib/analytics/track';
import { guideFileName, isHexColor, type GuideService } from '@/lib/line/customer-guide';
import { drawGuideImage, guideCanvasToBlob, loadGuideAssets, type GuideAssets } from '@/lib/line/customer-guide-render';
import { downloadBlob, ensureFontsLoaded, resolveFontStack } from '@/lib/line/rich-menu/canvas';
import { COLOR_PRESETS } from '@/lib/line/rich-menu/colors';
import type { RichMenuConfig } from '@/lib/line/rich-menu/schema';

type GuideData = {
  shop_name: string;
  shop_key: string | null;
  line_name: string | null;
  basic_id: string | null;
  add_friend_url: string | null;
  line_error: string | null;
  services: GuideService[];
  slot_times: string[];
  branch_name: string | null;
  logo_url: string | null;
  rich_menu: { config: RichMenuConfig; is_saved: boolean; is_published: boolean };
};

type GuideImage = { url: string; blob: Blob };

type LogoChoice = 'none' | 'shop' | 'file';

/** Logo files are read in the browser only; this cap keeps decoding fast. */
const LOGO_MAX_BYTES = 5 * 1024 * 1024;
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/**
 * Load an image for canvas use. Remote URLs need CORS (`crossOrigin`) or the
 * canvas becomes tainted and cannot be exported.
 */
function loadImage(src: string, remote: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (remote) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('โหลดโลโก้ไม่สำเร็จ'));
    img.src = src;
  });
}

/**
 * "ภาพสอนลูกค้าจองคิว" — after LINE is connected, renders one how-to image
 * of this shop's booking flow (scan QR → rich menu → service → date/time →
 * the real confirmation Flex) to post on Facebook or send in LINE. The shop
 * can change the theme color and add a logo. Drawn in the browser; nothing is stored.
 *
 * @param refreshKey - Bump to reload (e.g. after a successful connection test).
 */
export function CustomerGuideCard({ refreshKey = 0 }: { refreshKey?: number }) {
  const { push } = useToast();
  const [data, setData] = useState<GuideData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [image, setImage] = useState<GuideImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [color, setColor] = useState<string | null>(null);
  const [logoChoice, setLogoChoice] = useState<LogoChoice>('none');
  const [shopLogo, setShopLogo] = useState<HTMLImageElement | null>(null);
  const [fileLogo, setFileLogo] = useState<{ img: HTMLImageElement; name: string } | null>(null);
  const assetsRef = useRef<GuideAssets | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    assetsRef.current = null;
    void (async () => {
      try {
        const res = await fetch('/api/customer-guide', { cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setLoadError(json.error ?? 'โหลดข้อมูลไม่สำเร็จ');
          return;
        }
        setLoadError(null);
        setData(json.data as GuideData);
      } catch {
        if (!cancelled) setLoadError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  // Shop logo from the profile: usable only when storage allows CORS.
  useEffect(() => {
    let cancelled = false;
    setShopLogo(null);
    if (!data?.logo_url) return;
    loadImage(data.logo_url, true)
      .then((img) => {
        if (cancelled) return;
        setShopLogo(img);
        setLogoChoice((c) => (c === 'none' ? 'shop' : c));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [data?.logo_url]);

  // Revoke the preview URL when it is replaced or the card unmounts.
  useEffect(() => () => {
    if (image) URL.revokeObjectURL(image.url);
  }, [image]);

  const themeColor = color ?? data?.rich_menu.config.palette.primary ?? '#06c755';
  const logo = logoChoice === 'shop' ? shopLogo : logoChoice === 'file' ? (fileLogo?.img ?? null) : null;

  /** Draw with the current color + logo; loads QR / rich menu once per data. */
  const render = useCallback(async () => {
    if (!data?.add_friend_url || !data.basic_id) return;
    setBusy(true);
    try {
      if (!assetsRef.current) {
        const fontStack = resolveFontStack();
        await ensureFontsLoaded(fontStack);
        assetsRef.current = await loadGuideAssets({
          shopName: data.shop_name,
          basicId: data.basic_id,
          branchName: data.branch_name,
          addFriendUrl: data.add_friend_url,
          config: data.rich_menu.config,
          services: data.services,
          slotTimes: data.slot_times,
          fontStack,
        });
      }
      const canvas = document.createElement('canvas');
      drawGuideImage(canvas, assetsRef.current, { primary: themeColor, logo });
      const blob = await guideCanvasToBlob(canvas);
      setImage({ blob, url: URL.createObjectURL(blob) });
    } catch (e) {
      push(e instanceof Error ? e.message : 'สร้างภาพไม่สำเร็จ', 'error');
    } finally {
      setBusy(false);
    }
  }, [data, themeColor, logo, push]);

  // Once an image exists, color / logo changes redraw it (short delay while dragging the picker).
  const hasImage = image !== null;
  useEffect(() => {
    if (!hasImage) return undefined;
    const timer = setTimeout(() => void render(), 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- redraw only on style changes, not on the new image itself
  }, [themeColor, logo]);

  async function onPickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) return push('รองรับเฉพาะไฟล์ PNG, JPG หรือ WebP', 'error');
    if (file.size > LOGO_MAX_BYTES) return push('ไฟล์โลโก้ต้องไม่เกิน 5 MB', 'error');
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url, false);
      setFileLogo({ img, name: file.name });
      setLogoChoice('file');
    } catch {
      push('อ่านไฟล์โลโก้ไม่ได้', 'error');
    }
    // The decoded <img> keeps its pixels; the URL is not needed after load.
    URL.revokeObjectURL(url);
  }

  function download(img: GuideImage) {
    downloadBlob(img.blob, guideFileName(data?.shop_key));
    track('cta_clicked', { cta: 'customer_guide_download' });
  }

  /** Native share sheet (mobile) so the shop can send straight to LINE / Facebook. */
  async function share(img: GuideImage) {
    const file = new File([img.blob], guideFileName(data?.shop_key), { type: 'image/png' });
    if (!navigator.canShare?.({ files: [file] })) {
      download(img);
      push('อุปกรณ์นี้แชร์ไฟล์ตรงไม่ได้ ดาวน์โหลดภาพให้แล้ว', 'info');
      return;
    }
    try {
      await navigator.share({ files: [file], title: `วิธีจองคิว ${data?.shop_name ?? ''}`.trim() });
      track('cta_clicked', { cta: 'customer_guide_share' });
    } catch {
      // User closed the share sheet — nothing to do.
    }
  }

  const ready = Boolean(data?.add_friend_url && data.basic_id);
  const logoButton = (choice: LogoChoice, label: string, disabled = false) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setLogoChoice(choice)}
      className={`rounded-lg border px-3 py-1.5 text-xs ${
        logoChoice === choice ? 'border-emerald-600 bg-emerald-50 font-medium text-emerald-800' : 'border-slate-200 text-slate-600'
      } disabled:opacity-40`}
    >
      {label}
    </button>
  );

  return (
    <section className="mt-4 max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="border-b border-slate-100 pb-3">
        <h3 className="text-sm font-semibold text-slate-800">ภาพสอนลูกค้าจองคิว (โพสต์ Facebook / ส่ง LINE)</h3>
        <p className="mt-1 text-xs text-slate-500">
          ภาพเดียวสอนลูกค้า 5 ขั้นตอน: สแกน QR → เข้า LINE OA เลือกเมนู → เลือกบริการ → เลือกวันเวลา → ยืนยันการจอง (ข้อความ LINE จริงที่ลูกค้าได้รับ)
          ใช้ QR, Rich Menu, บริการ และเวลาทำการจริงของร้าน — สร้างในเครื่องนี้ ไม่ถูกเก็บในระบบ
        </p>
      </div>

      {loadError && <p className="mt-3 text-sm text-rose-700">{loadError}</p>}

      {data && !ready && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          ยังสร้างภาพไม่ได้ — เชื่อมต่อ LINE OA ให้สำเร็จก่อน ({data.line_error ?? 'ไม่พบไอดี LINE ของร้าน'}) แล้วกด &quot;ทดสอบการเชื่อมต่อ&quot;
        </p>
      )}

      {data && ready && (
        <div className="mt-3 space-y-2 text-sm text-slate-600">
          <p>
            LINE OA: <span className="font-medium text-slate-800">{data.line_name ?? data.shop_name}</span>{' '}
            <span className="text-slate-500">({data.basic_id})</span>
          </p>
          {!data.rich_menu.is_saved && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
              ยังไม่ได้บันทึก Rich Menu — ภาพจะใช้เมนูตัวอย่างตามประเภทร้าน{' '}
              <Link href="/portal/rich-menu" className="underline">ตั้งค่า Rich Menu</Link>
            </p>
          )}
          {data.services.length === 0 && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
              ยังไม่มีบริการที่เปิดใช้ — ขั้นเลือกบริการจะแสดงเป็นตัวอย่าง{' '}
              <Link href="/portal/services" className="underline">เพิ่มบริการ</Link>
            </p>
          )}
          {data.rich_menu.is_saved && !data.rich_menu.is_published && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
              Rich Menu ยังไม่ได้เผยแพร่ไป LINE — ลูกค้าจะยังไม่เห็นเมนูตามภาพ{' '}
              <Link href="/portal/rich-menu" className="underline">เผยแพร่ Rich Menu</Link>
            </p>
          )}

          <div className="space-y-2 rounded-lg bg-slate-50 px-3 py-3">
            <p className="text-xs font-medium text-slate-700">สีของภาพ</p>
            <div className="flex flex-wrap items-center gap-2">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  title={preset.label}
                  aria-label={preset.label}
                  onClick={() => setColor(preset.value)}
                  className={`h-7 w-7 rounded-full border-2 ${
                    themeColor.toLowerCase() === preset.value.toLowerCase() ? 'border-slate-800' : 'border-white'
                  } shadow`}
                  style={{ backgroundColor: preset.value }}
                />
              ))}
              <label className="flex items-center gap-1 text-xs text-slate-600">
                <input
                  type="color"
                  value={themeColor}
                  onChange={(e) => isHexColor(e.target.value) && setColor(e.target.value)}
                  className="h-7 w-9 cursor-pointer rounded border border-slate-200 bg-white"
                />
                กำหนดเอง
              </label>
              {color && (
                <button type="button" className="text-xs text-slate-500 underline" onClick={() => setColor(null)}>
                  ใช้สีเดียวกับ Rich Menu
                </button>
              )}
            </div>

            <p className="pt-1 text-xs font-medium text-slate-700">โลโก้</p>
            <div className="flex flex-wrap items-center gap-2">
              {logoButton('none', 'ไม่ใส่โลโก้')}
              {data.logo_url && logoButton('shop', shopLogo ? 'โลโก้ร้าน' : 'โลโก้ร้าน (โหลดไม่ได้)', !shopLogo)}
              {fileLogo && logoButton('file', fileLogo.name.length > 24 ? `${fileLogo.name.slice(0, 24)}…` : fileLogo.name)}
              <button type="button" className="text-xs text-emerald-700 underline" onClick={() => fileInputRef.current?.click()}>
                เลือกไฟล์โลโก้…
              </button>
              <input ref={fileInputRef} type="file" accept={LOGO_TYPES.join(',')} className="hidden" onChange={(e) => void onPickLogo(e)} />
            </div>
            <p className="text-xs text-slate-500">โลโก้แสดงที่หัวภาพและเป็นรูปโปรไฟล์ร้านในข้อความยืนยัน — ไฟล์ที่เลือกใช้เฉพาะในเครื่องนี้ ไม่ถูกอัปโหลด</p>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            void render();
            track('cta_clicked', { cta: 'customer_guide_generate' });
          }}
          disabled={!ready || busy}
        >
          {busy ? 'กำลังสร้างภาพ...' : image ? 'สร้างภาพใหม่' : 'สร้างภาพ'}
        </button>
        {image && (
          <>
            <button type="button" className="btn-outline" onClick={() => download(image)}>
              ดาวน์โหลด
            </button>
            <button type="button" className="btn-outline" onClick={() => void share(image)}>
              แชร์ไป LINE / Facebook
            </button>
          </>
        )}
      </div>

      {image && (
        <div className="mt-4 max-w-sm rounded-xl border border-slate-200 bg-slate-50 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- blob URL drawn in the browser */}
          <img src={image.url} alt="วิธีจองคิวผ่าน LINE" className="w-full rounded-lg bg-white" />
        </div>
      )}
    </section>
  );
}
