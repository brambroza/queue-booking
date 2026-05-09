'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';

type LineUser = { id: string; line_user_id: string; display_name: string | null; picture_url?: string | null };
type ChatMsg = {
  id: string;
  direction: string;
  message_type: string;
  message_text: string | null;
  payload?: { sticker_package_id?: string; sticker_id?: string } | null;
  created_at: string;
};

export function ChatInboxClient() {
  const { push } = useToast();
  const [users, setUsers] = useState<LineUser[]>([]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [selected, setSelected] = useState<LineUser | null>(null);
  const [text, setText] = useState('');
  const [sendType, setSendType] = useState<'text' | 'sticker'>('text');
  const [stickerPackageId, setStickerPackageId] = useState('11537');
  const [stickerId, setStickerId] = useState('52002734');

  const loadUsers = useCallback(async () => {
    const res = await fetch('/api/chat-inbox', { cache: 'no-store' });
    const json = await res.json();
    if (!res.ok) return push(json.error ?? 'โหลด inbox ไม่สำเร็จ', 'error');
    setUsers(json.data.users ?? []);
  }, [push]);

  async function loadMessages(lineUserPk: string) {
    const res = await fetch(`/api/chat-inbox?line_user_id=${lineUserPk}`, { cache: 'no-store' });
    const json = await res.json();
    if (!res.ok) return push(json.error ?? 'โหลดข้อความไม่สำเร็จ', 'error');
    setMessages(json.data.messages ?? []);
  }

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    if (sendType === 'text' && !text.trim()) return;
    if (sendType === 'sticker' && (!stickerPackageId || !stickerId)) return;
    const res = await fetch('/api/chat-inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        line_user_id: selected.line_user_id,
        message_type: sendType,
        message: sendType === 'text' ? text.trim() : undefined,
        sticker_package_id: sendType === 'sticker' ? stickerPackageId : undefined,
        sticker_id: sendType === 'sticker' ? stickerId : undefined,
      }),
    });
    const json = await res.json();
    if (!res.ok) return push(json.error ?? 'ส่งข้อความไม่สำเร็จ', 'error');
    setText('');
    push('ส่งข้อความแล้ว');
    await loadMessages(selected.id);
  }

  return (
    <div className="grid gap-4 md:grid-cols-[320px_1fr]">
      <aside className="card p-3">
        <p className="px-2 py-1 text-xs font-semibold tracking-wide text-slate-400">CONVERSATIONS</p>
        <div className="space-y-1">
          {users.map((u) => (
            <button
              key={u.id}
              className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${selected?.id === u.id ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}
              onClick={() => { setSelected(u); void loadMessages(u.id); }}
            >
              <div className="flex items-center gap-3">
                {u.picture_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.picture_url} alt={u.display_name ?? 'LINE User'} className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                    {(u.display_name || 'U').slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-800">{u.display_name || 'LINE User'}</div>
                  <div className="truncate text-xs text-slate-500">{u.line_user_id}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      <section className="card p-4">
        {!selected ? <p className="text-sm text-slate-500">เลือกบทสนทนาเพื่อดูข้อความ</p> : (
          <>
            <div className="mb-3 flex items-center gap-3 border-b border-slate-200 pb-3">
              {selected.picture_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selected.picture_url} alt={selected.display_name ?? 'LINE User'} className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600">
                  {(selected.display_name || 'U').slice(0, 1).toUpperCase()}
                </div>
              )}
              <div>
                <div className="text-sm font-semibold text-slate-800">{selected.display_name || selected.line_user_id}</div>
                <div className="text-xs text-slate-500">{selected.line_user_id}</div>
              </div>
            </div>
            <div className="h-[460px] overflow-y-auto space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              {messages.length === 0 ? <p className="text-sm text-slate-500">ยังไม่มีข้อความ</p> : messages.map((m) => (
                <div key={m.id} className={`max-w-[82%] rounded-xl px-3 py-2 text-sm shadow-sm ${m.direction === 'outbound' ? 'ml-auto bg-[#73c088] text-white' : 'bg-white text-slate-800'}`}>
                  <p>
                    {m.message_type === 'sticker'
                      ? `Sticker (${m.payload?.sticker_package_id ?? '-'}:${m.payload?.sticker_id ?? '-'})`
                      : (m.message_text || '-')}
                  </p>
                  <p className={`mt-1 text-[10px] ${m.direction === 'outbound' ? 'text-blue-100' : 'text-slate-500'}`}>{new Date(m.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>

            <form onSubmit={sendMessage} className="mt-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className={sendType === 'text' ? 'btn-primary' : 'btn-outline'} onClick={() => setSendType('text')}>Text</button>
                <button type="button" className={sendType === 'sticker' ? 'btn-primary' : 'btn-outline'} onClick={() => setSendType('sticker')}>Sticker</button>
              </div>
              {sendType === 'text' ? (
                <div className="flex gap-2">
                  <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="พิมพ์ข้อความ..." />
                  <button className="btn-primary" type="submit">ส่ง</button>
                </div>
              ) : (
                <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                  <input className="input" value={stickerPackageId} onChange={(e) => setStickerPackageId(e.target.value)} placeholder="Package ID" />
                  <input className="input" value={stickerId} onChange={(e) => setStickerId(e.target.value)} placeholder="Sticker ID" />
                  <button className="btn-primary" type="submit">ส่งสติกเกอร์</button>
                </div>
              )}
            </form>
          </>
        )}
      </section>
    </div>
  );
}
