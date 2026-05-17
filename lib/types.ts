// Core domain types — match the D1 schema in migrations/0001_init.sql

export type RegionCode = 'JAZ' | 'EST' | 'NOR';

export interface Region {
  id: number;
  code: RegionCode;
  name_ar: string;
  color_hex: string | null;
}

export type Role = 'admin' | 'regional_manager' | 'viewer';

export interface User {
  id: number;
  username: string;
  email: string | null;
  full_name: string | null;
  role: Role;
  region_id: number | null;
  must_change_password: 0 | 1;
  last_login_at: number | null;
  is_active: 0 | 1;
  created_at: number;
  // NOTE: password_hash is intentionally NOT exposed to the client.
}

export type TaskStatus = 'completed' | 'in_progress' | 'not_started';
export type Priority   = 'high' | 'medium' | 'low';

export interface Task {
  id: number;
  region_id: number;
  region_code?: RegionCode;
  region_name_ar?: string;
  task_name: string;
  phase: string | null;
  deadline: string | null;        // YYYY-MM-DD
  responsible_person: string | null;
  status: TaskStatus;
  priority: Priority | null;
  completion_percent: number;     // 0-100
  notes: string | null;
  created_at: number;
  updated_at: number;
}

export type RiskStatus = 'open' | 'in_progress' | 'controlled';

export interface Risk {
  id: number;
  region_id: number;
  region_code?: RegionCode;
  region_name_ar?: string;
  risk_description: string;
  affected_project: string | null;
  category: string | null;
  probability: number;            // 1-5
  impact: number;                 // 1-5
  risk_level: number;             // computed: probability * impact
  response_plan: string | null;
  owner: string | null;
  status: RiskStatus;
  notes: string | null;
  created_at: number;
  updated_at: number;
}

export interface WeeklyReport {
  id: number;
  region_id: number;
  region_code?: RegionCode;
  region_name_ar?: string;
  report_date: string;
  current_task: string;
  priority: Priority | null;
  obstacles: string | null;
  solution_plan: string | null;
  required_resources: string | null;
  follow_up_date: string | null;
  created_at: number;
}

export interface TeamMember {
  id: number;
  full_name: string;
  job_title: string | null;
  task_category: string | null;
}
