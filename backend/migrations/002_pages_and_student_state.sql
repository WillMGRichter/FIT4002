ALTER TABLE project_participants ADD COLUMN IF NOT EXISTS max_attempts INT NOT NULL DEFAULT 1;
ALTER TABLE project_participants ADD COLUMN IF NOT EXISTS attempts_used INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS project_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Untitled',
  sort_order INT NOT NULL DEFAULT 0,
  elements JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS student_simulation_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attempt_number INT NOT NULL,
  input_values JSONB NOT NULL DEFAULT '{}',
  current_page_id UUID REFERENCES project_pages(id),
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, user_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS idx_pages_project ON project_pages(project_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_student_state_project ON student_simulation_state(project_id, user_id);
