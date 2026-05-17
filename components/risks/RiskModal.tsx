'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { riskBucket } from '@/lib/formulas';
import type { Risk, Region, RiskStatus } from '@/lib/types';

interface Props {
  open: boolean; onOpenChange: (v: boolean) => void;
  risk: Risk | null; regions: Region[]; categories: string[];
  isAdmin: boolean; userRegionId: number | null;
  onSaved: (r: Risk) => void;
}

export function RiskModal({ open, onOpenChange, risk, regions, categories, isAdmin, userRegionId, onSaved }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    region_id: userRegionId ?? (regions[0]?.id ?? 1),
    risk_description: '',
    affected_project: '',
    category: categories[0] ?? '',
    probability: 3,
    impact: 3,
    response_plan: '',
    owner: '',
    status: 'open' as RiskStatus,
    notes: '',
  });

  useEffect(() => {
    if (risk) setForm({
      region_id: risk.region_id, risk_description: risk.risk_description,
      affected_project: risk.affected_project ?? '', category: risk.category ?? categories[0],
      probability: risk.probability, impact: risk.impact,
      response_plan: risk.response_plan ?? '', owner: risk.owner ?? '',
      status: risk.status, notes: risk.notes ?? '',
    });
    else setForm(f => ({ ...f, region_id: userRegionId ?? (regions[0]?.id ?? 1) }));
  }, [risk, open, userRegionId, regions, categories]);

  const lvl = form.probability * form.impact;
  const bucket = riskBucket(lvl);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const url = risk ? `/api/risks/${risk.id}` : '/api/risks';
    const method = risk ? 'PATCH' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setSaving(false);
    if (res.ok) {
      const saved = await res.json();
      toast({ title: risk ? 'تم تحديث الخطر' : 'تمت إضافة الخطر' });
      onSaved(saved); onOpenChange(false);
    } else {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      toast({ title: 'فشل الحفظ', description: err.error, variant: 'destructive' });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{risk ? 'تعديل الخطر' : 'إضافة خطر جديد'}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {isAdmin && (
            <div>
              <Label>المنطقة *</Label>
              <select className="h-10 w-full mt-1 px-3 border border-input rounded-lg bg-white text-sm"
                value={form.region_id} onChange={e => setForm({ ...form, region_id: parseInt(e.target.value) })}>
                {regions.map(r => <option key={r.id} value={r.id}>{r.name_ar}</option>)}
              </select>
            </div>
          )}
          <div><Label>وصف الخطر *</Label><Textarea required className="mt-1" value={form.risk_description} onChange={e => setForm({ ...form, risk_description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>المشروع المتأثر</Label><Input className="mt-1" value={form.affected_project} onChange={e => setForm({ ...form, affected_project: e.target.value })} /></div>
            <div>
              <Label>الفئة</Label>
              <select className="h-10 w-full mt-1 px-3 border border-input rounded-lg bg-white text-sm"
                value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>الاحتمالية (1-5) *</Label>
              <select className="h-10 w-full mt-1 px-3 border border-input rounded-lg bg-white text-sm"
                value={form.probability} onChange={e => setForm({ ...form, probability: parseInt(e.target.value) })}>
                <option value={1}>1 — نادر</option><option value={2}>2 — غير محتمل</option>
                <option value={3}>3 — محتمل</option><option value={4}>4 — مرجح</option><option value={5}>5 — مؤكد</option>
              </select>
            </div>
            <div>
              <Label>التأثير (1-5) *</Label>
              <select className="h-10 w-full mt-1 px-3 border border-input rounded-lg bg-white text-sm"
                value={form.impact} onChange={e => setForm({ ...form, impact: parseInt(e.target.value) })}>
                <option value={1}>1 — طفيف</option><option value={2}>2 — بسيط</option>
                <option value={3}>3 — متوسط</option><option value={4}>4 — شديد</option><option value={5}>5 — كارثي</option>
              </select>
            </div>
          </div>
          <div>
            <Label>مستوى الخطر (محسوب تلقائياً)</Label>
            <div className={`mt-1 inline-block px-4 py-2 rounded-lg font-bold border ${bucket.className}`}>
              {lvl} — {bucket.txt}
            </div>
          </div>
          <div><Label>خطة الاستجابة</Label><Textarea className="mt-1" value={form.response_plan} onChange={e => setForm({ ...form, response_plan: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>المسؤول</Label><Input className="mt-1" value={form.owner} onChange={e => setForm({ ...form, owner: e.target.value })} /></div>
            <div>
              <Label>الحالة</Label>
              <select className="h-10 w-full mt-1 px-3 border border-input rounded-lg bg-white text-sm"
                value={form.status} onChange={e => setForm({ ...form, status: e.target.value as RiskStatus })}>
                <option value="open">🔴 مفتوح</option>
                <option value="in_progress">🟡 قيد المعالجة</option>
                <option value="controlled">🟢 تحت السيطرة</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>إلغاء</Button>
            <Button type="submit" disabled={saving}>{saving ? '...' : 'حفظ'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
