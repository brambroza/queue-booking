'use client';

import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';
import EmojiEmotionsOutlinedIcon from '@mui/icons-material/EmojiEmotionsOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import PlayCircleOutlineRoundedIcon from '@mui/icons-material/PlayCircleOutlineRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import { useToast } from '@/components/ui/toast';
import {
  conversationMatches,
  formatChatDayLabel,
  formatChatListTime,
  formatChatTime,
  groupMessagesByDay,
  messagePreview,
  type ChatPreviewSource,
} from '@/lib/line/chat-inbox';

type LineUser = {
  id: string;
  line_user_id: string;
  display_name: string | null;
  picture_url?: string | null;
  status_message?: string | null;
  nickname?: string | null;
  last_message?: (ChatPreviewSource & { created_at: string }) | null;
};
type ChatMsg = {
  id: string;
  direction: string;
  message_type: string;
  message_text: string | null;
  payload?: {
    sticker_package_id?: string;
    sticker_id?: string;
    media_url?: string;
    media_name?: string;
    media_type?: string;
  } | null;
  created_at: string;
};

type StickerPreset = {
  emoji: string;
  label: string;
  packageId: string;
  stickerId: string;
};

const STICKER_PRESETS: StickerPreset[] = [
  { emoji: '😀', label: 'Happy', packageId: '11537', stickerId: '52002734' },
  { emoji: '😍', label: 'Love', packageId: '11537', stickerId: '52002735' },
  { emoji: '🙏', label: 'Thanks', packageId: '11537', stickerId: '52002736' },
  { emoji: '👍', label: 'OK', packageId: '11537', stickerId: '52002737' },
  { emoji: '🎉', label: 'Congrats', packageId: '11537', stickerId: '52002739' },
  { emoji: '😅', label: 'Sorry', packageId: '11537', stickerId: '52002740' },
];

const PAGE_SIZE = 50;
const MESSAGE_POLL_MS = 10_000;
const USER_POLL_MS = 30_000;
const SEARCH_DEBOUNCE_MS = 300;

/** Public LINE sticker image for a sticker id. */
function stickerImageUrl(stickerId: string): string {
  return `https://stickershop.line-scdn.net/stickershop/v1/sticker/${encodeURIComponent(stickerId)}/android/sticker.png`;
}

/** Name shown for a conversation: nickname first (shop's own name for them), then LINE name. */
function displayName(u: LineUser): string {
  return u.nickname || u.display_name || 'LINE User';
}

/** Round avatar with an initial fallback. */
function Avatar({ user, size }: { user: LineUser; size: number }) {
  const name = displayName(user);
  if (user.picture_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={user.picture_url} alt={name} style={{ width: size, height: size }} className="shrink-0 rounded-full object-cover" />
    );
  }
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      className="flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700 dark:bg-brand-400/15 dark:text-brand-300"
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

/** Body of one message: sticker, media or text. */
function MessageBody({ m, outbound }: { m: ChatMsg; outbound: boolean }) {
  const media = m.payload?.media_url;
  if (m.message_type === 'sticker' && m.payload?.sticker_id) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={stickerImageUrl(m.payload.sticker_id)} alt="สติกเกอร์" className="h-28 w-28 object-contain" loading="lazy" />
    );
  }
  if (m.message_type === 'image' && media) {
    return (
      <a href={media} target="_blank" rel="noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={media} alt={m.payload?.media_name || 'รูปภาพ'} className="max-h-72 max-w-[260px] rounded-2xl border border-line object-cover" loading="lazy" />
      </a>
    );
  }
  const bubble = outbound
    ? 'bg-brand-500 text-white dark:bg-brand-600'
    : 'border border-line bg-surface text-content';
  if ((m.message_type === 'video' || m.message_type === 'file') && media) {
    const Icon = m.message_type === 'video' ? PlayCircleOutlineRoundedIcon : InsertDriveFileOutlinedIcon;
    return (
      <a href={media} target="_blank" rel="noreferrer" className={`flex max-w-[280px] items-center gap-2 rounded-2xl px-3.5 py-2.5 text-sm ${bubble}`}>
        <Icon fontSize="small" />
        <span className="truncate underline-offset-2 hover:underline">{m.payload?.media_name || (m.message_type === 'video' ? 'วิดีโอ' : 'ไฟล์')}</span>
      </a>
    );
  }
  const text = m.message_text || (m.message_type === 'text' ? '-' : m.message_type);
  return (
    <div className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${bubble}`}>{text}</div>
  );
}

/**
 * LINE OA Manager–style inbox: searchable conversation list, thread with day
 * separators, Enter-to-send composer, and a profile panel on wide screens.
 */
export function ChatInboxClient() {
  const { push } = useToast();
  const [users, setUsers] = useState<LineUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [usersState, setUsersState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [messagesState, setMessagesState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [selected, setSelected] = useState<LineUser | null>(null);
  const [showProfile, setShowProfile] = useState(true);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [showStickerPanel, setShowStickerPanel] = useState(false);
  const [sticker, setSticker] = useState<StickerPreset | null>(null);

  const selectedIdRef = useRef<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastMessageIdRef = useRef<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const loadUsers = useCallback(async (opts: { page: number; q: string; silent?: boolean }) => {
    if (!opts.silent) setUsersState('loading');
    const params = new URLSearchParams({ page: String(opts.page), page_size: String(PAGE_SIZE) });
    if (opts.q) params.set('q', opts.q);
    const res = await fetch(`/api/chat-inbox?${params}`, { cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (!opts.silent) {
        setUsersState('error');
        push(json.error ?? 'โหลดรายการแชทไม่สำเร็จ', 'error');
      }
      return;
    }
    const rows: LineUser[] = json.data?.users ?? [];
    setUsers((prev) => (opts.page === 1 ? rows : [...prev, ...rows.filter((r) => !prev.some((p) => p.id === r.id))]));
    setTotal(json.pagination?.total ?? rows.length);
    setUsersState('ready');
  }, [push]);

  useEffect(() => {
    setPage(1);
    void loadUsers({ page: 1, q: debouncedQuery });
  }, [debouncedQuery, loadUsers]);

  const loadMessages = useCallback(async (lineUserPk: string, silent = false) => {
    if (!silent) setMessagesState('loading');
    const res = await fetch(`/api/chat-inbox?line_user_id=${encodeURIComponent(lineUserPk)}&page_size=1`, { cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    if (selectedIdRef.current !== lineUserPk) return; // user switched conversation meanwhile
    if (!res.ok) {
      if (!silent) {
        setMessagesState('error');
        push(json.error ?? 'โหลดข้อความไม่สำเร็จ', 'error');
      }
      return;
    }
    setMessages(json.data?.messages ?? []);
    setMessagesState('ready');
  }, [push]);

  // Poll the open thread and the list while the tab is visible.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (selectedIdRef.current) void loadMessages(selectedIdRef.current, true);
    }, MESSAGE_POLL_MS);
    return () => clearInterval(id);
  }, [loadMessages]);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible' || page !== 1) return;
      void loadUsers({ page: 1, q: debouncedQuery, silent: true });
    }, USER_POLL_MS);
    return () => clearInterval(id);
  }, [loadUsers, debouncedQuery, page]);

  // Stick to the newest message when one arrives.
  useEffect(() => {
    const last = messages[messages.length - 1]?.id ?? null;
    if (last && last !== lastMessageIdRef.current && threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
    lastMessageIdRef.current = last;
  }, [messages]);

  function openConversation(u: LineUser) {
    selectedIdRef.current = u.id;
    lastMessageIdRef.current = null;
    setSelected(u);
    setMessages([]);
    setText('');
    setFile(null);
    setSticker(null);
    setShowStickerPanel(false);
    void loadMessages(u.id);
  }

  function closeConversation() {
    selectedIdRef.current = null;
    setSelected(null);
  }

  // Server results for the current text are authoritative; while typing, filter what is loaded.
  const visibleUsers = useMemo(
    () => (debouncedQuery === query.trim() ? users : users.filter((u) => conversationMatches(u, query))),
    [users, query, debouncedQuery],
  );
  const dayGroups = useMemo(() => groupMessagesByDay(messages), [messages]);
  const canSend = !sending && Boolean(text.trim() || sticker || file);

  async function sendMessage(e?: FormEvent) {
    e?.preventDefault();
    if (!selected || !canSend) return;
    const form = new FormData();
    form.set('line_user_id', selected.line_user_id);
    if (text.trim()) {
      form.set('message_type', 'text');
      form.set('message', text.trim());
    }
    if (sticker) {
      form.set('message_type', 'sticker');
      form.set('sticker_package_id', sticker.packageId);
      form.set('sticker_id', sticker.stickerId);
    }
    if (file) form.set('file', file);

    setSending(true);
    try {
      const res = await fetch('/api/chat-inbox', { method: 'POST', body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        push(json.error ?? 'ส่งข้อความไม่สำเร็จ', 'error');
        return;
      }
      setText('');
      setFile(null);
      setSticker(null);
      await loadMessages(selected.id, true);
      void loadUsers({ page: 1, q: debouncedQuery, silent: true });
      textareaRef.current?.focus();
    } catch {
      push('ส่งข้อความไม่สำเร็จ', 'error');
    } finally {
      setSending(false);
    }
  }

  function onComposerKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter breaks the line; ignore Enter while a Thai/IME composition is open.
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void sendMessage();
    }
  }

  const iconButton = 'inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-surface-soft hover:text-content disabled:opacity-40';

  return (
    <div
      className={`card grid h-[calc(100dvh-210px)] min-h-[520px] overflow-hidden !p-0 md:grid-cols-[300px_1fr] ${
        selected && showProfile ? 'xl:grid-cols-[320px_1fr_300px]' : 'xl:grid-cols-[320px_1fr]'
      }`}
    >
      {/* Conversation list */}
      <aside className={`min-h-0 flex-col border-line md:flex md:border-r ${selected ? 'hidden' : 'flex'}`}>
        <div className="space-y-3 border-b border-line p-3">
          <div className="flex items-center justify-between px-1">
            <p className="text-sm font-semibold text-content">ทั้งหมด</p>
            <span className="text-xs text-muted">{total.toLocaleString('th-TH')} แชท</span>
          </div>
          <label className="flex h-10 items-center gap-2 rounded-xl border border-line bg-surface-soft px-3 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20">
            <SearchRoundedIcon fontSize="small" className="text-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาชื่อลูกค้า"
              aria-label="ค้นหาแชท"
              className="h-full min-w-0 flex-1 bg-transparent text-sm text-content outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
            />
            {query ? (
              <button type="button" aria-label="ล้างคำค้นหา" className="text-muted hover:text-content" onClick={() => setQuery('')}>
                <CloseRoundedIcon fontSize="small" />
              </button>
            ) : null}
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {usersState === 'loading' && users.length === 0 ? (
            <ul className="space-y-1 p-2" aria-label="กำลังโหลด">
              {Array.from({ length: 6 }).map((_, i) => (
                <li key={i} className="flex animate-pulse items-center gap-3 px-3 py-3">
                  <div className="h-12 w-12 rounded-full bg-line" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-1/2 rounded bg-line" />
                    <div className="h-3 w-3/4 rounded bg-line" />
                  </div>
                </li>
              ))}
            </ul>
          ) : usersState === 'error' && users.length === 0 ? (
            <div className="space-y-3 p-6 text-center text-sm text-muted">
              <p>โหลดรายการแชทไม่สำเร็จ</p>
              <button type="button" className="btn-outline" onClick={() => void loadUsers({ page: 1, q: debouncedQuery })}>ลองใหม่</button>
            </div>
          ) : visibleUsers.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted">
              {query.trim() ? `ไม่พบแชทที่ตรงกับ “${query.trim()}”` : 'ยังไม่มีแชทจากลูกค้า'}
            </div>
          ) : (
            <ul>
              {visibleUsers.map((u) => {
                const active = selected?.id === u.id;
                const preview = messagePreview(u.last_message);
                return (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => openConversation(u)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                        active ? 'bg-brand-50 dark:bg-brand-400/10' : 'hover:bg-surface-soft'
                      }`}
                    >
                      <Avatar user={u} size={48} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[15px] font-medium text-content">{displayName(u)}</span>
                          <span className="shrink-0 text-xs text-muted">{formatChatListTime(u.last_message?.created_at)}</span>
                        </div>
                        <p className="mt-0.5 truncate text-[13px] text-muted">
                          {preview || (u.nickname && u.display_name ? u.display_name : 'ยังไม่มีข้อความ')}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
              {!debouncedQuery && users.length < total ? (
                <li className="p-3">
                  <button
                    type="button"
                    className="btn-outline w-full"
                    disabled={usersState === 'loading'}
                    onClick={() => {
                      const next = page + 1;
                      setPage(next);
                      void loadUsers({ page: next, q: debouncedQuery });
                    }}
                  >
                    {usersState === 'loading' ? 'กำลังโหลด…' : 'โหลดเพิ่ม'}
                  </button>
                </li>
              ) : null}
            </ul>
          )}
        </div>
      </aside>

      {/* Thread */}
      <section className={`min-h-0 flex-col ${selected ? 'flex' : 'hidden md:flex'}`}>
        {!selected ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted">
            <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 48 }} />
            <p className="text-sm">เลือกแชททางซ้ายเพื่อเริ่มตอบลูกค้า</p>
          </div>
        ) : (
          <>
            <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line px-3 md:px-4">
              <button type="button" className={`${iconButton} md:hidden`} aria-label="กลับไปรายการแชท" onClick={closeConversation}>
                <ArrowBackRoundedIcon fontSize="small" />
              </button>
              <Avatar user={selected} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-content">{displayName(selected)}</p>
                {selected.nickname && selected.display_name ? (
                  <p className="truncate text-xs text-muted">LINE: {selected.display_name}</p>
                ) : null}
              </div>
              <button type="button" className={iconButton} aria-label="รีเฟรชข้อความ" title="รีเฟรช" onClick={() => void loadMessages(selected.id)}>
                <RefreshRoundedIcon fontSize="small" />
              </button>
              <button
                type="button"
                className={`${iconButton} hidden xl:inline-flex ${showProfile ? '!bg-surface-soft !text-content' : ''}`}
                aria-label="ข้อมูลลูกค้า"
                aria-pressed={showProfile}
                title="ข้อมูลลูกค้า"
                onClick={() => setShowProfile((v) => !v)}
              >
                <InfoOutlinedIcon fontSize="small" />
              </button>
            </header>

            <div ref={threadRef} className="min-h-0 flex-1 overflow-y-auto bg-surface-soft px-3 py-4 md:px-6">
              {messagesState === 'loading' && messages.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted">กำลังโหลดข้อความ…</p>
              ) : messagesState === 'error' && messages.length === 0 ? (
                <div className="space-y-3 py-10 text-center text-sm text-muted">
                  <p>โหลดข้อความไม่สำเร็จ</p>
                  <button type="button" className="btn-outline" onClick={() => void loadMessages(selected.id)}>ลองใหม่</button>
                </div>
              ) : messages.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted">ยังไม่มีข้อความ</p>
              ) : (
                dayGroups.map((group) => (
                  <div key={group.day} className="space-y-1.5">
                    <div className="sticky top-0 z-10 flex justify-center py-2">
                      <span className="rounded-full bg-slate-500/60 px-3 py-0.5 text-xs text-white backdrop-blur dark:bg-white/15">
                        {formatChatDayLabel(group.day)}
                      </span>
                    </div>
                    {group.items.map((m, i) => {
                      const outbound = m.direction === 'outbound';
                      const prev = group.items[i - 1];
                      const firstOfRun = !prev || prev.direction !== m.direction;
                      return (
                        <div key={m.id} className={`flex items-end gap-2 ${outbound ? 'flex-row-reverse' : ''} ${firstOfRun ? 'pt-2' : ''}`}>
                          {!outbound ? (
                            <div className="w-8 shrink-0 self-start">{firstOfRun ? <Avatar user={selected} size={32} /> : null}</div>
                          ) : null}
                          <div className="max-w-[75%]">
                            <MessageBody m={m} outbound={outbound} />
                          </div>
                          <span className="shrink-0 pb-0.5 text-[11px] text-muted">{formatChatTime(m.created_at)}</span>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            <form onSubmit={sendMessage} className="shrink-0 border-t border-line bg-surface">
              {showStickerPanel ? (
                <div className="grid grid-cols-6 gap-2 border-b border-line p-3">
                  {STICKER_PRESETS.map((s) => (
                    <button
                      key={`${s.packageId}-${s.stickerId}`}
                      type="button"
                      title={s.label}
                      className={`rounded-xl border p-1 transition hover:bg-surface-soft ${sticker?.stickerId === s.stickerId ? 'border-brand-500' : 'border-line'}`}
                      onClick={() => {
                        setSticker(s);
                        setShowStickerPanel(false);
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={stickerImageUrl(s.stickerId)} alt={s.label} className="mx-auto h-14 w-14 object-contain" loading="lazy" />
                    </button>
                  ))}
                </div>
              ) : null}

              {file || sticker ? (
                <div className="flex flex-wrap gap-2 px-4 pt-3">
                  {file ? (
                    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-surface-soft px-3 py-1 text-xs text-content">
                      <AttachFileRoundedIcon sx={{ fontSize: 14 }} />
                      <span className="truncate">{file.name}</span>
                      <button type="button" aria-label="เอาไฟล์ออก" className="text-muted hover:text-content" onClick={() => setFile(null)}>
                        <CloseRoundedIcon sx={{ fontSize: 14 }} />
                      </button>
                    </span>
                  ) : null}
                  {sticker ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-2 py-1 text-xs text-brand-700 dark:border-brand-400/30 dark:bg-brand-400/10 dark:text-brand-300">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={stickerImageUrl(sticker.stickerId)} alt="" className="h-5 w-5 object-contain" />
                      สติกเกอร์ {sticker.label}
                      <button type="button" aria-label="เอาสติกเกอร์ออก" onClick={() => setSticker(null)}>
                        <CloseRoundedIcon sx={{ fontSize: 14 }} />
                      </button>
                    </span>
                  ) : null}
                </div>
              ) : null}

              <textarea
                ref={textareaRef}
                rows={3}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onComposerKeyDown}
                placeholder="Enter: ส่ง, Shift + Enter: ขึ้นบรรทัดใหม่"
                aria-label="พิมพ์ข้อความ"
                className="block w-full resize-none bg-transparent px-4 pt-3 text-sm text-content outline-none placeholder:text-muted"
              />
              <div className="flex items-center gap-1 px-2 pb-2">
                <button
                  type="button"
                  className={`${iconButton} ${showStickerPanel ? '!bg-surface-soft !text-content' : ''}`}
                  aria-label="สติกเกอร์"
                  title="สติกเกอร์"
                  onClick={() => setShowStickerPanel((v) => !v)}
                >
                  <EmojiEmotionsOutlinedIcon fontSize="small" />
                </button>
                <button type="button" className={iconButton} aria-label="แนบไฟล์" title="แนบรูป / วิดีโอ / PDF" onClick={() => fileInputRef.current?.click()}>
                  <AttachFileRoundedIcon fontSize="small" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*,video/mp4,video/quicktime,application/pdf"
                  onChange={(e) => {
                    setFile(e.target.files?.[0] ?? null);
                    e.target.value = '';
                  }}
                />
                <button
                  type="submit"
                  disabled={!canSend}
                  className="ml-auto inline-flex h-9 min-w-[64px] items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
                >
                  {sending ? 'กำลังส่ง…' : 'ส่ง'}
                </button>
              </div>
            </form>
          </>
        )}
      </section>

      {/* Profile panel (wide screens) */}
      {selected && showProfile ? (
        <aside className="hidden min-h-0 flex-col overflow-y-auto border-l border-line p-5 xl:flex">
          <div className="flex flex-col items-center gap-3 text-center">
            <Avatar user={selected} size={96} />
            <div className="min-w-0">
              <p className="break-words text-lg font-semibold text-content">{displayName(selected)}</p>
              {selected.nickname && selected.display_name ? (
                <p className="text-sm text-muted">ชื่อ LINE: {selected.display_name}</p>
              ) : null}
            </div>
          </div>
          {selected.status_message ? (
            <div className="mt-5 rounded-xl bg-surface-soft p-3 text-sm text-muted">
              <p className="mb-1 text-xs font-semibold text-content">ข้อความสถานะ</p>
              <p className="whitespace-pre-wrap break-words">{selected.status_message}</p>
            </div>
          ) : null}
          <div className="mt-5 rounded-xl border border-dashed border-line p-3 text-xs leading-relaxed text-muted">
            ข้อความที่ส่งจากหน้านี้จะไปถึงลูกค้าทาง LINE OA ของร้านทันที ส่งได้เฉพาะลูกค้าที่เคยแชทหรือเพิ่มเพื่อนกับร้านแล้ว
          </div>
        </aside>
      ) : null}
    </div>
  );
}
