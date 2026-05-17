// Centralised formula logic — mirrors the Excel workbook so the numbers match exactly.

import type { Task, Risk } from './types';

// ---------- Performance bucket (لوحة التحكم — تصنيف الأداء) ----------
export type PerformanceBucket = 'excellent' | 'good' | 'medium' | 'low';

export function performanceLabel(avg01: number): { txt: string; bucket: PerformanceBucket; className: string } {
  if (avg01 >= 0.9) return { txt: '✅ ممتاز',       bucket: 'excellent', className: 'bg-emerald-100 text-emerald-800' };
  if (avg01 >= 0.7) return { txt: '🟢 جيد',         bucket: 'good',      className: 'bg-blue-100 text-blue-800' };
  if (avg01 >= 0.4) return { txt: '🟡 متوسط',       bucket: 'medium',    className: 'bg-amber-100 text-amber-800' };
  return                    { txt: '🔴 يحتاج تدخل', bucket: 'low',       className: 'bg-red-100 text-red-800' };
}

export function performanceEval(avg01: number): string {
  if (avg01 >= 0.9) return 'أداء ممتاز';
  if (avg01 >= 0.7) return 'ضمن الهدف';
  if (avg01 >= 0.4) return 'يحتاج مراجعة';
  return 'تدخل عاجل';
}

// ---------- Risk level bucket (Risk Register — مستوى الخطر) ----------
export type RiskBucket = 'critical' | 'high' | 'medium' | 'low';

export function riskBucket(level: number): { txt: string; bucket: RiskBucket; className: string } {
  if (level >= 20) return { txt: '🔴 حرج',   bucket: 'critical', className: 'bg-red-100 text-red-800 border-red-300' };
  if (level >= 13) return { txt: '🟠 عالٍ',  bucket: 'high',     className: 'bg-orange-100 text-orange-800 border-orange-300' };
  if (level >=  6) return { txt: '🟡 متوسط', bucket: 'medium',   className: 'bg-amber-100 text-amber-800 border-amber-300' };
  return                    { txt: '🟢 منخفض', bucket: 'low',     className: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
}

// ---------- Days remaining (worksheet formula: deadline - TODAY) ----------
export function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(dateStr); d.setHours(0,0,0,0);
  if (isNaN(d.getTime())) return null;
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

// ---------- Task status classification (column J in region sheets) ----------
export function statusClassification(task: Pick<Task, 'status' | 'deadline'>): string {
  if (task.status === 'completed') return 'منجزة';
  const d = daysUntil(task.deadline);
  if (d === null) return '—';
  if (d < 0) return 'متأخرة';
  if (d <= 7) return 'قريبة';
  return 'ضمن الجدول';
}

// ---------- Aggregations ----------
export interface TaskStats {
  total: number;
  completed: number;
  in_progress: number;
  not_started: number;
  avg_completion_01: number;      // 0..1
  avg_completion_pct: number;     // 0..100
}

export function computeTaskStats(tasks: Pick<Task, 'status' | 'completion_percent'>[]): TaskStats {
  const total = tasks.length;
  const completed   = tasks.filter(t => t.status === 'completed').length;
  const in_progress = tasks.filter(t => t.status === 'in_progress').length;
  const not_started = tasks.filter(t => t.status === 'not_started').length;
  const sum         = tasks.reduce((s, t) => s + (t.completion_percent ?? 0), 0);
  const avgPct      = total ? sum / total : 0;
  return { total, completed, in_progress, not_started, avg_completion_pct: avgPct, avg_completion_01: avgPct / 100 };
}

export interface RiskStats {
  total: number;
  critical: number;       // ≥ 20
  high: number;           // 13..19
  medium: number;         // 6..12
  low: number;            // 1..5
  avg_level: number;
  max_level: number;
}

export function computeRiskStats(risks: Pick<Risk, 'risk_level' | 'probability' | 'impact'>[]): RiskStats {
  const levels = risks.map(r => r.risk_level ?? (r.probability * r.impact));
  const total = levels.length;
  return {
    total,
    critical: levels.filter(l => l >= 20).length,
    high:     levels.filter(l => l >= 13 && l < 20).length,
    medium:   levels.filter(l => l >= 6  && l < 13).length,
    low:      levels.filter(l => l >= 1  && l < 6).length,
    avg_level: total ? +(levels.reduce((s,l)=>s+l,0) / total).toFixed(2) : 0,
    max_level: total ? Math.max(...levels) : 0,
  };
}

// ---------- Arabic display helpers ----------
export const STATUS_AR: Record<string, string> = {
  completed:   'مكتمل ✓',
  in_progress: 'قيد التنفيذ',
  not_started: 'لم يبدأ',
};
export const PRIORITY_AR: Record<string, string> = {
  high: 'عالي', medium: 'متوسط', low: 'منخفض',
};
export const RISK_STATUS_AR: Record<string, string> = {
  open:        '🔴 مفتوح',
  in_progress: '🟡 قيد المعالجة',
  controlled:  '🟢 تحت السيطرة',
};
