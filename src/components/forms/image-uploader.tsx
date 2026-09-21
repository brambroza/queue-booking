'use client';

import { ChangeEvent, useRef, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { compressImage } from '@/lib/utils/image-compress';
import { SHOP_IMAGE_MAX_BYTES, type ShopImageKind } from '@/lib/storage/shop-assets';

/** Phone photos run 3–12 MB before the browser downscale; refuse only the absurd. */
const MAX_RAW_BYTES = 25 * 1024 * 1024;

/**
 * Photo picker for portal forms (resource photos, service cover, venue map).
 *
 * Uploads straight away to `/api/shop-assets/image` and hands back URLs through
 * `onChange`; the parent form saves them with its normal POST/PATCH. The first
 * URL is the cover, so "ตั้งเป็นรูปปก" just moves a photo to the front.
 */
export function ImageUploader({
  value,
  onChange,
  kind,
  max = 1,
  label,
  hint,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  kind: ShopImageKind;
  max?: number;
  label: string;
  hint?: string;
}) {
  const { push } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const remaining = max - value.length;

  /** Upload one file and return its public URL, or null after toasting the reason. */
  async function uploadOne(file: File): Promise<string | null> {
    if (file.size > MAX_RAW_BYTES) {
      push(`"${file.name}" ใหญ่เกินไป`, 'error');
      return null;
    }
    const compressed = await compressImage(file, { maxEdge: 1600, quality: 0.85 });
    if (compressed.size > SHOP_IMAGE_MAX_BYTES) {
      push(`"${file.name}" ใหญ่เกิน 5 MB`, 'error');
      return null;
    }
    const body = new FormData();
    body.set('kind', kind);
    body.set('image', compressed);
    try {
      const res = await fetch('/api/shop-assets/image', { method: 'POST', body });
      const json = (await res.json()) as { data?: { url?: string }; error?: string };
      if (!res.ok || !json.data?.url) {
        push(json.error ?? 'อัปโหลดรูปไม่สำเร็จ', 'error');
        return null;
      }
      return json.data.url;
    } catch {
      push('อัปโหลดรูปไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ต', 'error');
      return null;
    }
  }

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    if (files.length > remaining) push(`เพิ่มได้อีก ${remaining} รูป (สูงสุด ${max} รูป)`, 'error');

    setUploading(true);
    const added: string[] = [];
    for (const file of files.slice(0, remaining)) {
      const url = await uploadOne(file);
      if (url) added.push(url);
    }
    setUploading(false);
    if (added.length > 0) onChange([...value, ...added]);
  }

  return (
    <div className="space-y-1 sm:col-span-2">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
      <div className="flex flex-wrap gap-2 pt-1">
        {value.map((url, index) => (
          <div key={url} className="relative h-24 w-24 overflow-hidden rounded-xl border border-slate-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`${label} ${index + 1}`} className="h-full w-full object-cover" />
            {max > 1 && index === 0 ? (
              <span className="absolute left-1 top-1 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-medium text-white">รูปปก</span>
            ) : null}
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-slate-900/60 px-1 py-0.5 text-[10px] text-white">
              {max > 1 && index > 0 ? (
                <button type="button" onClick={() => onChange([url, ...value.filter((u) => u !== url)])}>
                  ตั้งเป็นรูปปก
                </button>
              ) : (
                <span />
              )}
              <button type="button" aria-label={`ลบรูปที่ ${index + 1}`} onClick={() => onChange(value.filter((u) => u !== url))}>
                ลบ
              </button>
            </div>
          </div>
        ))}
        {remaining > 0 ? (
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="flex h-24 w-24 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 text-xs text-slate-500 hover:border-emerald-500 hover:text-emerald-600 disabled:opacity-60"
          >
            <span className="text-xl leading-none">{uploading ? '…' : '+'}</span>
            <span className="mt-1">{uploading ? 'กำลังอัปโหลด' : 'เพิ่มรูป'}</span>
          </button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={max > 1}
        className="hidden"
        onChange={(e) => void onPick(e)}
      />
    </div>
  );
}
