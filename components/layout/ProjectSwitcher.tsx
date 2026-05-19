'use client';

// Project switcher — visible only to admins.
// Reads the list of projects, lets admin pick one (or "All projects"), persists choice via cookie.

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Project } from '@/lib/types';

interface Props {
  /** The active project_id from the cookie (server-rendered). `null` means "all projects". */
  activeProjectId: number | null;
}

export function ProjectSwitcher({ activeProjectId }: Props) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isPending, startTransition] = useTransition();
  const [val, setVal] = useState<string>(activeProjectId ? String(activeProjectId) : 'all');

  useEffect(() => {
    fetch('/api/projects', { cache: 'no-store' })
      .then(r => r.json())
      .then((rows: Project[]) => setProjects(Array.isArray(rows) ? rows.filter(p => p.is_active) : []))
      .catch(() => setProjects([]));
  }, []);

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    setVal(v);
    await fetch('/api/projects/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: v }),
    });
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="project-switcher" className="text-xs text-muted-foreground whitespace-nowrap">المشروع:</label>
      <select
        id="project-switcher"
        value={val}
        onChange={onChange}
        disabled={isPending}
        className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-navy disabled:opacity-50 min-w-[180px]"
      >
        <option value="all">— جميع المشاريع —</option>
        {projects.map(p => (
          <option key={p.id} value={p.id}>{p.name_ar}</option>
        ))}
      </select>
    </div>
  );
}
