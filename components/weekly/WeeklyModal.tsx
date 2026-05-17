'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { todayIso } from '@/lib/utils';
import type { WeeklyReport, Region, Priority } from '@/lib/types';

interface Props {
  open: boolean; onOpenChange: (v: boolean) => void;
  item: WeeklyReport | null; regions: Region[];
  isAdmin: boolean; userRegionId: number | null;
  onSaved: (r: WeeklyReport) => void;
}

export function WeeklyModal({ open, onOpenChange, item, regions, isAdmin, userRegionId, onSaved }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    region_id: userRegionId ?? (regions[0]?.id ?? 1),
    report_date: todayIso(),
    current_task: '',
    priority: 'medium' as Priority,
    obstacles: '',
    solution_plan: '',
    required_resources: '',
    follow_up_date: '',
  });

  useEffect(() => {
    if (item) setForm({
      region_id: item.region_id, report_date: item.report_date,
      current_task: item.current_task, priority: (item.priority ?? 'medium'),
      obstacles: item.obstacles ?? '', solution_plan: item.solution_plan ?? '',
      required_resources: item.required_resources ?? '', follow_up_date: item.follow_up_date ?? '',
    });
    else setForm(f => ({ ...f, region_id: userRegionId ?? (regions[0]?.id ?? 1) }));
  }, [item, open, userRegionId, regions]);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    const url = item ? `/api/weekly-reports/${item.id}` : '/api/weekly-reports';
    const method = item ? 'PATCH' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setSaving(false);
    if (res.ok) { onSaved(await res.json()); toast({ title: item ? 'تم التحديث' : 'تمت الإضافة' }); onOpenChange(false); }
    else { const err = (await res.json().catch(() => ({}))) as { error?: string }; toast({ title: 'فشل الحفظ', description: err.error, variant: 'destructive' }); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{item ? 'تعديل التقرير' : 'إضافة عائق أسبوعي'}</DialogTitle></DialogHeader>
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
          <div className="grid grid-cols-2 gap-3">
            <div><Label>التاريخ *</Label><Input type="date" required className="mt-1" value={form.report_date} onChange={e => setForm({ ...form, report_date: e.target.value })} /></div>
            <div>
              <Label>الأولوية</Label>
              <select className="h-10 w-full mt-1 px-3 border border-input rounded-lg bg-white text-sm"
                value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as Priority })}>
                <option value="high">عالي</option><option value="medium">متوسط</option><option value="low">منخفض</option>
              </select>
            </div>
          </div>
          <div><Label>المهمة الحالية *</Label><Input required className="mt-1" value={form.current_task} onChange={e => setForm({ ...form, current_task: e.target.value })} /></div>
          <div><Label>معوقات التنفيذ *</Label><Textarea required className="mt-1" value={form.obstacles} onChange={e => setForm({ ...form, obstacles: e.target.value })} /></div>
          <div><Label>خطة الحل</Label><Textarea className="mt-1" value={form.solution_plan} onChange={e => setForm({ ...form, solution_plan: e.target.value })} /></div>
          <div><Label>الموارد المطلوبة</Label><Textarea className="mt-1" value={form.required_resources} onChange={e => setForm({ ...form, required_resources: e.target.value })} /></div>
          <div><Label>تاريخ المتابعة</Label><Input type="date" className="mt-1" value={form.follow_up_date} onChange={e => setForm({ ...form, follow_up_date: e.target.value })} /></div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>إلغاء</Button>
            <Button type="submit" disabled={saving}>{saving ? '...' : 'حفظ'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
