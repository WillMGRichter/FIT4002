// User roles
export enum UserRole {
  ORGANISATION = 'organisation',
  ADMIN = 'admin',
  TEACHER = 'teacher',
  STUDENT = 'student',
}

// Project visibility
export enum ProjectVisibility {
  PRIVATE = 'private',
  PUBLIC = 'public',
  SELECTIVE = 'selective',
}

// Database types
export interface Organisation {
  id: string;
  name: string;
  created_at: string;
}

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

export interface Project {
  id: string;
  name: string;
  description?: string;
  created_by: string; // teacher/admin user_id
  organisation_id: string;
  visibility: ProjectVisibility;
  excel_data?: any; // parsed excel data
  created_at: string;
  updated_at: string;
}

export interface ProjectParticipant {
  id: string;
  project_id: string;
  user_id: string;
  role: 'teacher' | 'student';
  created_at: string;
}

export interface SimulationProgress {
  id: string;
  project_id: string;
  user_id: string;
  state: any; // current values and progress
  saved_at: string;
  updated_at: string;
}

export interface ProjectResult {
  id: string;
  project_id: string;
  user_id: string;
  final_state: any;
  completed_at: string;
}

// API Response types
export interface AuthResponse {
  token: string;
  user: User;
}

export interface ErrorResponse {
  error: string;
  details?: string;
}
