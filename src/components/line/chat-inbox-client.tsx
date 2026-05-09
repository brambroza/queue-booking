'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';

type LineUser = { id: string; line_user_id: string; display_name: string | null };
type ChatMsg = { id: string; direction: string; message_text: string | null; created_at: string };

export function ChatInboxClient() {
  const { push } = useToast();
  const [users, setUsers] = useState<LineUser[]>([]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [selected, setSelected] = useState<LineUser | null>(null);
  const [text, setText] = useState('');

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
    if (!selected || !text.trim()) return;
    const res = await fetch('/api/chat-inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ line_user_id: selected.line_user_id, message: text.trim() }),
    });
    const json = await res.json();
    if (!res.ok) return push(json.error ?? 'ส่งข้อความไม่สำเร็จ', 'error');
    setText('');
    push('ส่งข้อความแล้ว');
    await loadMessages(selected.id);
  }

  return (
    <div className="grid gap-4 md:grid-cols-[280px_1fr]">
      <aside className="card p-2">
        <p className="px-2 py-1 text-xs text-slate-500">Conversations</p>
        <div className="space-y-1">
          {users.map((u) => (
            <button
              key={u.id}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm ${selected?.id === u.id ? 'bg-brand-100' : 'hover:bg-slate-100'}`}
              onClick={() => { setSelected(u); void loadMessages(u.id); }}
            >
              <div className="font-medium">{u.display_name || 'LINE User'}</div>
              <div className="text-xs text-slate-500">{u.line_user_id}</div>
            </button>
          ))}
        </div>
      </aside>

      <section className="card p-4">
        {!selected ? <p className="text-sm text-slate-500">เลือกบทสนทนาเพื่อดูข้อความ</p> : (
          <>
            <div className="mb-3 text-sm font-medium">{selected.display_name || selected.line_user_id}</div>
            <div className="h-[420px] overflow-y-auto space-y-2 rounded-lg border border-slate-200 p-3">
              {messages.length === 0 ? <p className="text-sm text-slate-500">ยังไม่มีข้อความ</p> : messages.map((m) => (
                <div key={m.id} className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.direction === 'outbound' ? 'ml-auto bg-brand-500 text-white' : 'bg-slate-100 text-slate-800'}`}>
                  <p>{m.message_text || '-'}</p>
                  <p className={`mt-1 text-[10px] ${m.direction === 'outbound' ? 'text-blue-100' : 'text-slate-500'}`}>{new Date(m.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>

            <form onSubmit={sendMessage} className="mt-3 flex gap-2">
              <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="พิมพ์ข้อความ..." />
              <button className="btn-primary" type="submit">ส่ง</button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
