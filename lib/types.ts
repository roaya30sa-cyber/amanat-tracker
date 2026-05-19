// Core domain types — match the D1 schema in migrations/0001_init.sql + 0002_multi_project.sql

export type RegionCode = 'JAZ' | 'EST' | 'NOR';

export interface Project {
  id: number;
  code: string;
  name_ar: string;
  is_active: 0 | 1;
  created_at: number;
}

export interface Region {
  id: number;
  code: RegionCode;
  name_ar: string;
  color_hex: string | null;
  project_id: number | null;
}

export type Role = 'admin' | 'regional_manager' | 'viewer';

export interface User {
  id: number;
  username: string;
  email: string | null;
  full_name: string | null;
  role: Role;
  region_id: number | null;
  project_id: number | null;       // NULL for super-admin
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
  project_id: number;
  project_name_ar?: string;
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
  project_id: number;
  project_name_ar?: string;
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
  project_id: number;
  project_name_ar?: string;
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

// =====================================================================
// Phase 2: Obstacles (العوائق التشغيلية) + Notifications
// =====================================================================

export type ObstacleStatus =
  | 'pending_approval'   // region manager opened, admin hasn't approved due date
  | 'approved'           // admin approved (or auto-approved when admin opens) — work can start
  | 'in_progress'        // recipient is working on it
  | 'resolved'           // done
  | 'rejected';          // admin rejected; closed

/** Computed-at-read-time pseudo-status: true when approved_due_date < today AND status not in resolved/rejected. */
export interface Obstacle {
  id: number;
  project_id: number;
  project_name_ar?: string;
  region_id: number | null;
  region_name_ar?: string | null;
  from_user_id: number;
  from_user_name?: string | null;
  from_user_role?: Role;
  to_user_id: number;
  to_user_name?: string | null;
  to_user_role?: Role;
  statement: string;
  request: string | null;
  notes: string | null;
  status: ObstacleStatus;
  proposed_due_date: string | null;       // YYYY-MM-DD
  approved_due_date: string | null;
  approved_by: number | null;
  approved_at: number | null;
  resolved_at: number | null;
  rejected_reason: string | null;
  created_at: number;
  updated_at: number;
  // Derived (filled by API GET responses):
  is_overdue?: boolean;
  days_remaining?: number | null;          // negative if overdue
}

export type NotificationKind =
  | 'obstacle_new'
  | 'obstacle_approved'
  | 'obstacle_rejected'
  | 'obstacle_in_progress'
  | 'obstacle_resolved'
  | 'obstacle_overdue';

export interface Notification {
  id: number;
  user_id: number;
  kind: NotificationKind;
  obstacle_id: number | null;
  title: string;
  body: string | null;
  is_read: 0 | 1;
  created_at: number;
}
