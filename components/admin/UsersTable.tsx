'use client';

import { useState } from 'react';
import type { User, Region, Role, Project } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Pencil, Trash2, Plus, KeyRound, ShieldOff, ShieldCheck } from 'lucide-react';
import { formatDateAr } from '@/lib/utils';

const ROLE_AR: Record<Role,string> = { admin: 'مدير النظام', regional_manager: 'مدير منطقة', viewer: 'مشاهد' };

interface Props { initial: User[]; regions: Region[]; projects: Project[]; currentUserId: number; }

export function UsersTable({ initial, regions, projects, currentUserId }: Props) {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>(initial);

  // Create/Edit modal
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const emptyForm = {
    username: '', password: '', full_name: '', email: '',
    role: 'regional_manager' as Role,
    region_id:  regions[0]?.id  ?? null as number | null,
    project_id: projects[0]?.id ?? null as number | null,
  };
  const [form, setForm] = useState(emptyForm);

  // Reset-password modal
  const [pwOpen, setPwOpen] = useState(false);
  const [pwTarget, setPwTarget] = useState<User | null>(null);
  const [pwValue, setPwValue] = useState('');
  const [pwForceChange, setPwForceChange] = useState(true);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, region_id: regions[0]?.id ?? null, project_id: projects[0]?.id ?? null });
    setOpen(true);
  }
  function openEdit(u: User) {
    setEditing(u);
    setForm({
      username: u.username, password: '', full_name: u.full_name ?? '',
      email: u.email ?? '', role: u.role,
      region_id: u.region_id,
      project_id: u.project_id,
    });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = {
      full_name: form.full_name || null,
      email: form.email || null,
      role: form.role,
      region_id:  form.role === 'admin' ? null : form.region_id,
      project_id: form.role === 'admin' ? null : form.project_id,
    };
    if (!editing) {
      payload.username = form.username;
      payload.password = form.password;
    }
    const url = editing ? `/api/users/${editing.id}` : '/api/users';
    const method = editing ? 'PATCH' : 'POST';
    const res = await fetch(url, { method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
    if (res.ok) {
      const saved: User = await res.json();
      setUsers(prev => editing ? prev.map(u => u.id === saved.id ? saved : u) : [...prev, saved]);
      toast({ title: editing ? 'تم تحديث المستخدم' : 'تمت إضافة المستخدم وتعيين كلمة المرور' });
      setOpen(false);
    } else {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      toast({ title: 'فشل', description: err.error, variant: 'destructive' });
    }
  }

  async function deleteUser(id: number) {
    if (id === currentUserId) { toast({ title: 'لا يمكن حذف نفسك', variant: 'destructive' }); return; }
    if (!confirm('حذف هذا المستخدم؟')) return;
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
    if (res.ok) { setUsers(prev => prev.filter(u => u.id !== id)); toast({ title: 'تم الحذف' }); }
    else toast({ title: 'فشل الحذف', variant: 'destructive' });
  }

  async function toggleActive(u: User) {
    const res = await fetch(`/api/users/${u.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: u.is_active ? 0 : 1 }),
    });
    if (res.ok) {
      const saved = await res.json();
      setUsers(prev => prev.map(x => x.id === saved.id ? saved : x));
      toast({ title: saved.is_active ? 'تم تفعيل الحساب' : 'تم تعطيل الحساب' });
    }
  }

  function openResetPassword(u: User) {
    setPwTarget(u); setPwValue(''); setPwForceChange(true); setPwOpen(true);
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!pwTarget) return;
    if (pwValue.length < 8) { toast({ title: 'كلمة المرور 8 أحرف على الأقل', variant: 'destructive' }); return; }
    const res = await fetch(`/api/users/${pwTarget.id}/password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwValue, must_change_password: pwForceChange }),
    });
    if (res.ok) {
      // Update local list to reflect must_change_password
      setUsers(prev => prev.map(u => u.id === pwTarget.id ? { ...u, must_change_password: pwForceChange ? 1 : 0 } : u));
      toast({ title: 'تم تعيين كلمة المرور', description: pwForceChange ? 'سيُطلب من المستخدم تغييرها عند الدخول التالي' : undefined });
      setPwOpen(false);
    } else {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      toast({ title: 'فشل', description: err.error, variant: 'destructive' });
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="flex justify-between items-center mb-5">
        <h3 className="text-lg font-bold text-brand-navy">👥 إدارة المستخدمين</h3>
        <Button onClick={openCreate}><Plus className="h-4 w-4" />إضافة مستخدم</Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-brand-soft text-brand-navy">
            <tr className="text-right">
              <th className="p-3 font-bold">اسم المستخدم</th>
              <th className="p-3 font-bold">الاسم الكامل</th>
              <th className="p-3 font-bold">الإيميل</th>
              <th className="p-3 font-bold">الدور</th>
              <th className="p-3 font-bold">المشروع</th>
              <th className="p-3 font-bold">المنطقة</th>
              <th className="p-3 font-bold">الحالة</th>
              <th className="p-3 font-bold">آخر دخول</th>
              <th className="p-3 font-bold">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => {
              const region  = u.region_id  ? regions.find(r => r.id === u.region_id)   : null;
              const project = u.project_id ? projects.find(p => p.id === u.project_id) : null;
              const lastLogin = u.last_login_at ? formatDateAr(u.last_login_at) : '—';
              return (
                <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-3 font-mono font-bold text-brand-navy ltr-only text-left">{u.username}</td>
                  <td className="p-3">{u.full_name ?? '—'}</td>
                  <td className="p-3 ltr-only text-left text-xs">{u.email ?? '—'}</td>
                  <td className="p-3"><Badge variant="info">{ROLE_AR[u.role]}</Badge></td>
                  <td className="p-3">{project?.name_ar ?? <span className="text-xs text-muted-foreground">جميع المشاريع</span>}</td>
                  <td className="p-3">{region?.name_ar  ?? 'جميع المناطق'}</td>
                  <td className="p-3">
                    {u.is_active
                      ? <Badge variant="success">نشط</Badge>
                      : <Badge variant="destructive">معطل</Badge>}
                    {u.must_change_password ? <Badge variant="warning" className="mr-1">يجب تغيير كلمة المرور</Badge> : null}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{lastLogin}</td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(u)} title="تعديل"><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => openResetPassword(u)} title="إعادة تعيين كلمة المرور"><KeyRound className="h-4 w-4 text-brand-teal" /></Button>
                      {u.id !== currentUserId && (
                        <Button size="icon" variant="ghost" onClick={() => toggleActive(u)} title={u.is_active ? 'تعطيل' : 'تفعيل'}>
                          {u.is_active ? <ShieldOff className="h-4 w-4 text-brand-gold" /> : <ShieldCheck className="h-4 w-4 text-brand-green" />}
                        </Button>
                      )}
                      {u.id !== currentUserId && <Button size="icon" variant="ghost" onClick={() => deleteUser(u.id)} title="حذف"><Trash2 className="h-4 w-4 text-brand-red" /></Button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ===== Create / Edit Modal ===== */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'تعديل المستخدم' : 'إضافة مستخدم جديد'}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-4">
            {!editing && (
              <>
                <div>
                  <Label>اسم المستخدم * <span className="text-xs text-muted-foreground">(3-32 حرف إنجليزي/أرقام)</span></Label>
                  <Input
                    required dir="ltr" className="mt-1 ltr-only text-left"
                    pattern="^[a-z0-9_.\-]{3,32}$"
                    value={form.username} onChange={e => setForm({ ...form, username: e.target.value.toLowerCase() })}
                    placeholder="username"
                  />
                </div>
                <div>
                  <Label>كلمة المرور الأولية * <span className="text-xs text-muted-foreground">(8 أحرف على الأقل، يُطلب تغييرها عند أول دخول)</span></Label>
                  <Input type="password" required minLength={8} className="mt-1" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                </div>
              </>
            )}
            <div><Label>الاسم الكامل</Label><Input className="mt-1" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} /></div>
            <div><Label>الإيميل (اختياري)</Label><Input type="email" className="mt-1 ltr-only" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
            <div>
              <Label>الدور *</Label>
              <select className="h-10 w-full mt-1 px-3 border border-input rounded-lg bg-white text-sm"
                value={form.role} onChange={e => setForm({...form, role: e.target.value as Role})}>
                <option value="admin">مدير النظام</option>
                <option value="regional_manager">مدير منطقة</option>
                <option value="viewer">مشاهد</option>
              </select>
            </div>
            {form.role !== 'admin' && (
              <>
                <div>
                  <Label>المشروع *</Label>
                  <select className="h-10 w-full mt-1 px-3 border border-input rounded-lg bg-white text-sm" required
                    value={form.project_id ?? ''} onChange={e => setForm({...form, project_id: parseInt(e.target.value)})}>
                    {projects.filter(p => p.is_active).map(p => <option key={p.id} value={p.id}>{p.name_ar}</option>)}
                  </select>
                </div>
                <div>
                  <Label>المنطقة *</Label>
                  <select className="h-10 w-full mt-1 px-3 border border-input rounded-lg bg-white text-sm" required
                    value={form.region_id ?? ''} onChange={e => setForm({...form, region_id: parseInt(e.target.value)})}>
                    {regions.map(r => <option key={r.id} value={r.id}>{r.name_ar}</option>)}
                  </select>
                </div>
              </>
            )}
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>إلغاء</Button>
              <Button type="submit">حفظ</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ===== Reset Password Modal ===== */}
      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إعادة تعيين كلمة المرور</DialogTitle>
          </DialogHeader>
          <form onSubmit={savePassword} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              المستخدم: <span dir="ltr" className="font-mono font-bold text-brand-navy">{pwTarget?.username}</span>
            </p>
            <div>
              <Label>كلمة المرور الجديدة *</Label>
              <Input type="text" required minLength={8} className="mt-1" value={pwValue} onChange={e => setPwValue(e.target.value)} placeholder="8 أحرف على الأقل" />
              <p className="text-xs text-muted-foreground mt-1">يمكنك توليد كلمة عشوائية أو اختيار كلمة سهلة الإملاء — المستخدم سيغيرها أول دخول.</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={pwForceChange} onChange={e => setPwForceChange(e.target.checked)} className="w-4 h-4 accent-brand-teal" />
              <span className="text-sm">إجبار المستخدم على تغيير كلمة المرور عند الدخول التالي (مُستحسن)</span>
            </label>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setPwOpen(false)}>إلغاء</Button>
              <Button type="submit">حفظ كلمة المرور</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
