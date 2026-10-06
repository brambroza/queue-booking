'use client';

import { DragEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import { useToast } from '@/components/ui/toast';

/** Formats the shop-profile route stores; keep in sync with the file input `accept`. */
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
/** Matches the `shop-assets` bucket `fileSizeLimit` the route creates (5 MB). */
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Human readable size, e.g. `820 KB` / `1.4 MB`.
 *
 * @param bytes File size in bytes.
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Drag-and-drop logo picker for the shop profile form.
 *
 * Controlled by the parent: it keeps the chosen `file` and the `removed` flag and
 * sends them with the normal "save profile" request (nothing is uploaded here).
 * Click, keyboard (Enter / Space) and drop all pick a file; the new file previews
 * in place with its name and size, and can be swapped or discarded before saving.
 */
export function LogoDropzone({
  currentUrl,
  file,
  removed,
  onFileChange,
  onRemovedChange,
  disabled = false,
}: {
  /** Saved logo URL, if the shop has one. */
  currentUrl: string | null;
  /** File picked this session but not saved yet. */
  file: File | null;
  /** True when the saved logo is marked for deletion on save. */
  removed: boolean;
  onFileChange: (file: File | null) => void;
  onRemovedChange: (removed: boolean) => void;
  disabled?: boolean;
}) {
  const { push } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Object URL for the picked file; revoked when it changes or the form unmounts.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const shownUrl = file ? previewUrl : currentUrl && !removed ? currentUrl : null;

  /** Validate and hand the file to the parent; toast the reason when it is refused. */
  function accept(next: File | undefined) {
    if (!next) return;
    if (!ACCEPTED_TYPES.includes(next.type)) {
      push('รองรับเฉพาะไฟล์ PNG, JPG, WebP หรือ SVG', 'error');
      return;
    }
    if (next.size > MAX_BYTES) {
      push(`ไฟล์ "${next.name}" ใหญ่เกิน 5 MB (${formatBytes(next.size)})`, 'error');
      return;
    }
    onRemovedChange(false);
    onFileChange(next);
  }

  function browse() {
    if (!disabled) inputRef.current?.click();
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    accept(e.dataTransfer.files?.[0]);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      browse();
    }
  }

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="อัปโหลดโลโก้ร้าน ลากไฟล์มาวางหรือคลิกเพื่อเลือกไฟล์"
        aria-disabled={disabled}
        onClick={browse}
        onKeyDown={onKeyDown}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragEnter={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false); }}
        onDrop={onDrop}
        className={[
          'flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-5 text-center transition sm:flex-row sm:text-left',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60',
          dragging
            ? 'border-sky-400 bg-sky-50 dark:bg-sky-400/10'
            : 'border-slate-300 bg-slate-50/60 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-400/5',
          disabled ? 'cursor-not-allowed opacity-60' : '',
        ].join(' ')}
      >
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          {shownUrl ? (
            // Blob / storage URL, plain <img> like the other portal uploaders.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shownUrl} alt="โลโก้ร้าน" className="h-full w-full object-contain" />
          ) : (
            <CloudUploadOutlinedIcon className="text-slate-400" fontSize="large" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {dragging ? 'ปล่อยไฟล์ที่นี่' : 'ลากไฟล์โลโก้มาวาง หรือคลิกเพื่อเลือกไฟล์'}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">PNG, JPG, WebP หรือ SVG · ไม่เกิน 5 MB · แนะนำภาพสี่เหลี่ยมจัตุรัส</p>

          {file ? (
            <p className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
              <InsertDriveFileOutlinedIcon sx={{ fontSize: 14 }} />
              <span className="truncate">{file.name}</span>
              <span className="shrink-0 text-emerald-600/70">· {formatBytes(file.size)} · ยังไม่ได้บันทึก</span>
            </p>
          ) : removed ? (
            <p className="mt-2 inline-flex items-center rounded-full bg-rose-50 px-2.5 py-1 text-xs text-rose-700 dark:bg-rose-400/10 dark:text-rose-300">
              จะลบโลโก้ปัจจุบันเมื่อกดบันทึก
            </p>
          ) : null}
        </div>

        {/* Actions sit inside the zone, so they must not bubble up and re-open the file dialog. */}
        <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {file ? (
            <>
              <button type="button" className="btn-outline inline-flex items-center gap-1.5" onClick={browse} disabled={disabled}>
                <SwapHorizRoundedIcon fontSize="small" />
                เปลี่ยนไฟล์
              </button>
              <button type="button" className="btn-outline inline-flex items-center gap-1.5" onClick={() => onFileChange(null)} disabled={disabled}>
                <UndoRoundedIcon fontSize="small" />
                ยกเลิก
              </button>
            </>
          ) : removed ? (
            <button type="button" className="btn-outline inline-flex items-center gap-1.5" onClick={() => onRemovedChange(false)} disabled={disabled}>
              <UndoRoundedIcon fontSize="small" />
              เก็บโลโก้ไว้
            </button>
          ) : currentUrl ? (
            <button
              type="button"
              className="btn-outline inline-flex items-center gap-1.5 text-rose-600"
              onClick={() => onRemovedChange(true)}
              disabled={disabled}
            >
              <DeleteOutlineIcon fontSize="small" />
              ลบโลโก้
            </button>
          ) : null}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        className="hidden"
        onChange={(e) => {
          accept(e.target.files?.[0]);
          // Same file picked twice in a row must still fire onChange.
          e.target.value = '';
        }}
      />
    </div>
  );
}
