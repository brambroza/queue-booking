'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { TablePaginationControls } from '@/components/ui/table-pagination-controls';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { ActionIconGroup } from '@/components/ui/action-icon-group';

type Branch = { id: string; branch_name: string };
type Resource = {
  id: string;
  branch_id: string | null;
  resource_type: 'table' | 'buffet_zone' | 'meeting_room' | 'counter' | 'service_area';
  resource_code: string | null;
  resource_name: string;
  capacity: number;
  floor: string | null;
  zone: string | null;
  description: string | null;
  active: boolean;
  branches?: { branch_name?: string } | null;
};

const RESOURCE_TYPES: Array<Resource['resource_type']> = ['table', 'buffet_zone', 'meeting_room', 'counter', 'service_area'];

export function ResourcesCrud() {
  const { push } = useToast();
  const [rows, setRows] = useState<Resource[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [filterType, setFilterType] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [filterZone, setFilterZone] = useState('');
  const [filterActive, setFilterActive] = useState('');
  const [q, setQ] = useState('');

  async function load() {
    const params = new URLSearchParams();
    if (filterType) params.set('resource_type', filterType);
    if (filterBranch) params.set('branch_id', filterBranch);
    if (filterZone) params.set('zone', filterZone);
    if (filterActive) params.set('active', filterActive);
    if (q.trim()) params.set('q', q.trim());

    const [rRes, bRes] = await Promise.all([
      fetch(`/api/resources?${params.toString()}`, { cache: 'no-store' }),
      fetch('/api/branches?page_size=100', { cache: 'no-store' }),
    ]);
    const [rJson, bJson] = await Promise.all([rRes.json(), bRes.json()]);
    if (!rRes.ok) return push(rJson.error ?? 'โหลด resources ไม่สำเร็จ', 'error');
    if (!bRes.ok) return push(bJson.error ?? 'โหลด branches ไม่สำเร็จ', 'error');
    setRows(rJson.data ?? []);
    setBranches(bJson.data ?? []);
    setPage(1);
  }

  useEffect(() => { void load(); }, []);

  const pagedRows = useMemo(() => rows.slice((page - 1) * rowsPerPage, page * rowsPerPage), [rows, page, rowsPerPage]);

  async function submitSingle(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const payload = {
      id: editing?.id,
      branch_id: String(fd.get('branch_id') || '') || null,
      resource_type: String(fd.get('resource_type') || ''),
      resource_code: String(fd.get('resource_code') || '') || null,
      resource_name: String(fd.get('resource_name') || ''),
      capacity: Number(fd.get('capacity') || 1),
      floor: String(fd.get('floor') || '') || null,
      zone: String(fd.get('zone') || '') || null,
      description: String(fd.get('description') || '') || null,
      active: fd.get('active') === 'on',
    };

    const isEdit = Boolean(editing);
    const res = await fetch('/api/resources', {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) return push(json.error ?? 'บันทึก resource ไม่สำเร็จ', 'error');
    push(isEdit ? 'อัปเดตทรัพยากรแล้ว' : 'เพิ่มทรัพยากรสำเร็จ');
    setDrawerOpen(false);
    setEditing(null);
    form.reset();
    await load();
  }

  async function submitBulk(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const mode = String(fd.get('mode') || 'range');
    const codeListRaw = String(fd.get('code_list') || '');
    const payload = {
      mode,
      resource_type: String(fd.get('resource_type') || ''),
      branch_id: String(fd.get('branch_id') || '') || null,
      prefix: String(fd.get('prefix') || '') || null,
      start_number: Number(fd.get('start_number') || 1),
      end_number: Number(fd.get('end_number') || 1),
      pad_length: Number(fd.get('pad_length') || 2),
      code_list: mode === 'list' ? codeListRaw.split(',').map((x) => x.trim()).filter(Boolean) : undefined,
      name_prefix: String(fd.get('name_prefix') || '') || null,
      capacity: Number(fd.get('capacity') || 1),
      floor: String(fd.get('floor') || '') || null,
      zone: String(fd.get('zone') || '') || null,
      active: fd.get('active') === 'on',
    };
    const res = await fetch('/api/resources/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) return push(json.error ?? 'สร้าง resource แบบกลุ่มไม่สำเร็จ', 'error');
    push(`สร้างทรัพยากรแล้ว ${json.data?.created ?? 0} รายการ`);
    setBulkOpen(false);
    form.reset();
    await load();
  }

  async function removeRow(id: string) {
    const res = await fetch(`/api/resources?id=${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) return push(json.error ?? 'ลบไม่สำเร็จ', 'error');
    push('ลบทรัพยากรแล้ว');
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="grid gap-2 md:grid-cols-6">
          <input className="input" placeholder="ค้นหา code/name" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">ทุกประเภท</option>
            {RESOURCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className="input" value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}>
            <option value="">ทุกสาขา</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
          </select>
          <input className="input" placeholder="Zone" value={filterZone} onChange={(e) => setFilterZone(e.target.value)} />
          <select className="input" value={filterActive} onChange={(e) => setFilterActive(e.target.value)}>
            <option value="">ทุกสถานะ</option>
            <option value="true">active</option>
            <option value="false">inactive</option>
          </select>
          <button className="btn-outline" onClick={() => void load()}>ค้นหา</button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">ทรัพยากรร้าน</h3>
        <div className="flex gap-2">
          <button className="btn-outline" onClick={() => setBulkOpen(true)}>Quick Create</button>
          <button className="btn-primary" onClick={() => { setEditing(null); setDrawerOpen(true); }}>Add New</button>
        </div>
      </div>

      <div className="card p-4 overflow-x-auto">
        {rows.length === 0 ? <p className="text-sm text-slate-500">ยังไม่มีทรัพยากร</p> : (
          <table className="min-w-full text-sm">
            <thead>
              <tr>
                <th className="px-2 py-2 text-left">Code</th>
                <th className="px-2 py-2 text-left">Name</th>
                <th className="px-2 py-2 text-left">Type</th>
                <th className="px-2 py-2 text-left">Branch</th>
                <th className="px-2 py-2 text-left">Capacity</th>
                <th className="px-2 py-2 text-left">Zone</th>
                <th className="px-2 py-2 text-left">Status</th>
                <th className="px-2 py-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-2 py-2">{r.resource_code ?? '-'}</td>
                  <td className="px-2 py-2">{r.resource_name}</td>
                  <td className="px-2 py-2">{r.resource_type}</td>
                  <td className="px-2 py-2">{r.branches?.branch_name ?? '-'}</td>
                  <td className="px-2 py-2">{r.capacity}</td>
                  <td className="px-2 py-2">{r.zone ?? '-'}</td>
                  <td className="px-2 py-2">{r.active ? 'active' : 'inactive'}</td>
                  <td className="px-2 py-2">
                    <ActionIconGroup
                      actions={[
                        {
                          key: 'edit',
                          icon: <EditIcon fontSize="small" />,
                          labelKey: 'common.edit',
                          fallbackLabel: 'Edit',
                          onClick: () => { setEditing(r); setDrawerOpen(true); },
                        },
                        {
                          key: 'delete',
                          icon: <DeleteOutlineIcon fontSize="small" />,
                          labelKey: 'common.delete',
                          fallbackLabel: 'Delete',
                          color: 'error',
                          onClick: () => void removeRow(r.id),
                          confirmBeforeClick: true,
                          confirmTitle: 'Delete',
                          confirmMessage: 'ยืนยันการลบทรัพยากรนี้?',
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {rows.length > 0 ? (
          <TablePaginationControls
            page={page}
            rowsPerPage={rowsPerPage}
            total={rows.length}
            onPageChange={setPage}
            onRowsPerPageChange={(v) => { setRowsPerPage(v); setPage(1); }}
          />
        ) : null}
      </div>

      {drawerOpen ? (
        <>
          <button className="fixed inset-0 z-40 bg-slate-900/30" onClick={() => setDrawerOpen(false)} aria-label="Close drawer" />
          <aside className="fixed right-0 top-0 z-50 h-screen w-full bg-white p-5 shadow-2xl sm:w-[60%] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
              <h4 className="text-lg font-semibold">{editing ? 'แก้ไขทรัพยากร' : 'เพิ่มทรัพยากร'}</h4>
              <button className="btn-outline" onClick={() => setDrawerOpen(false)}>Close</button>
            </div>
            <form onSubmit={submitSingle} className="grid gap-3 sm:grid-cols-2">
              <select className="input" name="resource_type" defaultValue={editing?.resource_type || 'table'} required>
                {RESOURCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select className="input" name="branch_id" defaultValue={editing?.branch_id || ''}>
                <option value="">ทุกสาขา/ไม่ระบุ</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
              </select>
              <input className="input" name="resource_code" placeholder="resource code เช่น T01" defaultValue={editing?.resource_code ?? ''} />
              <input className="input" name="resource_name" placeholder="resource name" defaultValue={editing?.resource_name ?? ''} required />
              <input className="input" name="capacity" type="number" min={1} defaultValue={editing?.capacity ?? 1} required />
              <input className="input" name="floor" placeholder="floor" defaultValue={editing?.floor ?? ''} />
              <input className="input" name="zone" placeholder="zone" defaultValue={editing?.zone ?? ''} />
              <input className="input sm:col-span-2" name="description" placeholder="description" defaultValue={editing?.description ?? ''} />
              <label className="sm:col-span-2 text-sm text-slate-600">
                <input className="mr-2" type="checkbox" name="active" defaultChecked={editing?.active ?? true} />
                Active
              </label>
              <div className="sm:col-span-2 flex gap-2 pt-1">
                <button className="btn-primary">{editing ? 'บันทึกการแก้ไข' : 'เพิ่มทรัพยากร'}</button>
                <button type="button" className="btn-outline" onClick={() => setDrawerOpen(false)}>ยกเลิก</button>
              </div>
            </form>
          </aside>
        </>
      ) : null}

      {bulkOpen ? (
        <>
          <button className="fixed inset-0 z-40 bg-slate-900/30" onClick={() => setBulkOpen(false)} aria-label="Close drawer" />
          <aside className="fixed right-0 top-0 z-50 h-screen w-full bg-white p-5 shadow-2xl sm:w-[60%] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
              <h4 className="text-lg font-semibold">Quick Create Resource</h4>
              <button className="btn-outline" onClick={() => setBulkOpen(false)}>Close</button>
            </div>
            <form onSubmit={submitBulk} className="grid gap-3 sm:grid-cols-2">
              <select className="input" name="resource_type" defaultValue="table" required>
                {RESOURCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select className="input" name="branch_id" defaultValue="">
                <option value="">ทุกสาขา/ไม่ระบุ</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
              </select>
              <select className="input" name="mode" defaultValue="range">
                <option value="range">Range (T01-T20)</option>
                <option value="list">List (ROOM-A,ROOM-B)</option>
              </select>
              <input className="input" name="prefix" placeholder="prefix เช่น T" defaultValue="T" />
              <input className="input" name="start_number" type="number" min={1} defaultValue={1} />
              <input className="input" name="end_number" type="number" min={1} defaultValue={20} />
              <input className="input" name="pad_length" type="number" min={0} max={6} defaultValue={2} />
              <input className="input" name="code_list" placeholder="ROOM-A, ROOM-B, ROOM-C" />
              <input className="input" name="name_prefix" placeholder="name prefix เช่น โต๊ะ" defaultValue="โต๊ะ" />
              <input className="input" name="capacity" type="number" min={1} defaultValue={4} />
              <input className="input" name="floor" placeholder="floor" />
              <input className="input" name="zone" placeholder="zone เช่น Indoor" />
              <label className="sm:col-span-2 text-sm text-slate-600">
                <input className="mr-2" type="checkbox" name="active" defaultChecked />
                Active
              </label>
              <div className="sm:col-span-2 flex gap-2 pt-1">
                <button className="btn-primary">สร้างรายการ</button>
                <button type="button" className="btn-outline" onClick={() => setBulkOpen(false)}>ยกเลิก</button>
              </div>
            </form>
          </aside>
        </>
      ) : null}
    </div>
  );
}

