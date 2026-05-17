'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';

interface BarPoint { label: string; value: number; color?: string; }

export function CompletionBarChart({ data, title }: { data: BarPoint[]; title: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <h3 className="text-lg font-bold text-brand-navy mb-4 flex items-center gap-2">📈 {title}</h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} reversed />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" orientation="right" />
            <Tooltip
              formatter={(v: number) => [`${v}%`, 'نسبة الإنجاز']}
              contentStyle={{ direction: 'rtl', borderRadius: 8, border: '1px solid #e2e8f0' }}
            />
            <Bar dataKey="value" radius={[8,8,0,0]}>
              {data.map((d, i) => <Cell key={i} fill={d.color ?? '#1F3864'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function StatusDoughnut({ completed, inProgress, notStarted }: { completed: number; inProgress: number; notStarted: number }) {
  const data = [
    { name: 'مكتمل ✓',     value: completed,   color: '#27AE60' },
    { name: 'قيد التنفيذ', value: inProgress,  color: '#F39C12' },
    { name: 'لم يبدأ',     value: notStarted,  color: '#C0392B' },
  ].filter(d => d.value > 0);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <h3 className="text-lg font-bold text-brand-navy mb-4 flex items-center gap-2">🥧 توزيع حالات المهام</h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2}>
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <Tooltip contentStyle={{ direction: 'rtl' }} />
            <Legend verticalAlign="bottom" iconType="circle" />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
