#!/usr/bin/env tsx
/**
 * One-time CSV import script.
 *
 * Reads the Arabic-headered CSV files under ./data/ and bulk-inserts them into the
 * local (or remote) D1 database via wrangler.
 *
 * USAGE:
 *   npx tsx scripts/import-from-sheets.ts            # local D1
 *   npx tsx scripts/import-from-sheets.ts --remote   # remote D1 (production)
 *
 * The CSV column headers MUST be in Arabic and match the migration vocabulary
 * (see ./data/*.csv for examples). Status / priority values are auto-translated
 * from Arabic to the canonical English enum values stored in the DB.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';
import path from 'node:path';

const REMOTE = process.argv.includes('--remote');

const REGION_MAP: Record<string, number> = {
  'منطقة جازان':    1, 'جازان': 1, 'JAZ': 1,
  'المنطقة الشرقية': 2, 'الشرقية': 2, 'EST': 2,
  'الحدود الشمالية': 3, 'الشمالية': 3, 'NOR': 3,
};

const STATUS_MAP: Record<string, string> = {
  'مكتمل ✓': 'completed', 'مكتمل': 'completed',
  'قيد التنفيذ': 'in_progress',
  'لم يبدأ': 'not_started',
};
const PRIORITY_MAP: Record<string, string> = {
  'عالي': 'high', 'متوسط': 'medium', 'منخفض': 'low',
};
const RISK_STATUS_MAP: Record<string, string> = {
  '🔴 مفتوح': 'open',
  '🟡 قيد المعالجة': 'in_progress',
  '🟢 تحت السيطرة': 'controlled',
};

const escape = (v: any) =>
  v == null || v === '' ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;

function runSql(sql: string) {
  const args = ['wrangler', 'd1', 'execute', 'projects-tracker',
    REMOTE ? '--remote' : '--local',
    '--command', sql];
  execFileSync('npx', args, { stdio: 'inherit' });
}

function importTasks() {
  const csv = readFileSync(path.join(process.cwd(), 'data/tasks.csv'), 'utf-8');
  const rows = parse(csv, { columns: true, skip_empty_lines: true, bom: true }) as any[];
  console.log(`Importing ${rows.length} tasks…`);
  const statements: string[] = [];
  for (const r of rows) {
    const regionId = REGION_MAP[r['المنطقة']];
    if (!regionId) { console.warn('Unknown region:', r['المنطقة']); continue; }
    statements.push(
      `INSERT INTO tasks (region_id, task_name, phase, deadline, responsible_person, status, priority, completion_percent) ` +
      `VALUES (${regionId}, ${escape(r['اسم المهمة'])}, ${escape(r['المرحلة'])}, ` +
      `${escape(r['الموعد النهائي'])}, ${escape(r['الشخص المسؤول'])}, ` +
      `${escape(STATUS_MAP[r['الحالة']] ?? 'not_started')}, ` +
      `${escape(PRIORITY_MAP[r['مستوى الأولوية']] ?? 'medium')}, ` +
      `${parseInt(r['نسبة الإنجاز']) || 0});`
    );
  }
  for (const stmt of statements) runSql(stmt);
}

function importRisks() {
  const csv = readFileSync(path.join(process.cwd(), 'data/risks.csv'), 'utf-8');
  const rows = parse(csv, { columns: true, skip_empty_lines: true, bom: true }) as any[];
  console.log(`Importing ${rows.length} risks…`);
  for (const r of rows) {
    const regionId = REGION_MAP[r['المنطقة']];
    if (!regionId) continue;
    runSql(
      `INSERT INTO risks (region_id, risk_description, affected_project, category, probability, impact, response_plan, owner, status, notes) ` +
      `VALUES (${regionId}, ${escape(r['وصف الخطر'])}, ${escape(r['المشروع المتأثر'])}, ${escape(r['فئة الخطر'])}, ` +
      `${parseInt(r['الاحتمالية'])}, ${parseInt(r['التأثير'])}, ${escape(r['خطة الاستجابة'])}, ${escape(r['المسؤول'])}, ` +
      `${escape(RISK_STATUS_MAP[r['الحالة']] ?? 'open')}, ${escape(r['ملاحظات'])});`
    );
  }
}

function importWeekly() {
  const csv = readFileSync(path.join(process.cwd(), 'data/weekly_reports.csv'), 'utf-8');
  const rows = parse(csv, { columns: true, skip_empty_lines: true, bom: true }) as any[];
  console.log(`Importing ${rows.length} weekly reports…`);
  for (const r of rows) {
    const regionId = REGION_MAP[r['المنطقة']];
    if (!regionId) continue;
    runSql(
      `INSERT INTO weekly_reports (region_id, report_date, current_task, priority, obstacles, solution_plan, required_resources, follow_up_date) ` +
      `VALUES (${regionId}, ${escape(r['التاريخ'])}, ${escape(r['المهمة الحالية'])}, ` +
      `${escape(PRIORITY_MAP[r['مستوى الأولوية']] ?? 'medium')}, ${escape(r['معوقات التنفيذ'])}, ` +
      `${escape(r['خطة الحل'])}, ${escape(r['الموارد المطلوبة'])}, ${escape(r['تاريخ المتابعة'])});`
    );
  }
}

console.log(`\n📥 Importing CSV data into ${REMOTE ? 'REMOTE' : 'LOCAL'} D1\n`);
importTasks();
importRisks();
importWeekly();
console.log('\n✅ Done.\n');
