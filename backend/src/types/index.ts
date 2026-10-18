/** Available user roles in the system hierarchy */
export enum UserRole {
  ORGANISATION = 'organisation',
  ADMIN = 'admin',
  TEACHER = 'teacher',
  STUDENT = 'student',
}

/** Visibility levels a project can have */
export enum ProjectVisibility {
  PRIVATE = 'private',
  PUBLIC = 'public',
  SELECTIVE = 'selective',
}

/** Represents an organisation (school or company) */
export interface Organisation {
  id: string;
  name: string;
  created_at: string;
}

/** Full user record including password hash (database-facing only) */
export interface User {
  id: string;
  username: string;
  password_hash: string;
  email?: string;
  role: UserRole;
  organisation_id?: string;
  created_at: string;
  updated_at: string;
}

/** A simulation project created by a teacher */
export interface Project {
  id: string;
  name: string;
  description?: string;
  created_by: string;
  organisation_id: string;
  visibility: ProjectVisibility;
  excel_data?: any;
  default_max_attempts?: number;
  created_at: string;
  updated_at: string;
}

/** Links a user to a project with a specific role and attempt limits */
export interface ProjectParticipant {
  id: string;
  project_id: string;
  user_id: string;
  role: 'teacher' | 'student';
  max_attempts: number;
  attempts_used: number;
  created_at: string;
}

/** Ongoing simulation progress saved mid-way */
export interface SimulationProgress {
  id: string;
  project_id: string;
  user_id: string;
  state: any;
  saved_at: string;
  updated_at: string;
}

/** A completed simulation submission */
export interface ProjectResult {
  id: string;
  project_id: string;
  user_id: string;
  final_state: any;
  completed_at: string;
}

/** A single page within a project's simulation canvas */
export interface ProjectPage {
  id: string;
  project_id: string;
  name: string;
  sort_order: number;
  elements: any;
  created_at: string;
  updated_at: string;
}

/** A student's simulation state for a specific attempt */
export interface StudentSimulationState {
  id: string;
  project_id: string;
  user_id: string;
  attempt_number: number;
  input_values: any;
  current_page_id?: string;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

/** User object with password_hash removed, safe for client response */
export type SafeUser = Omit<User, 'password_hash'>;

/** Standard authentication response containing JWT token and user data */
export interface AuthResponse {
  token: string;
  user: SafeUser;
}

/** Standard error response shape */
export interface ErrorResponse {
  error: string;
  details?: string;
}
