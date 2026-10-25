-- Project-scoped student accounts.
--
-- Previously `users.username` was globally UNIQUE and student login resolved a
-- username across the whole table. That made it impossible for two different
-- projects to each have a student with the same username, and meant student
-- accounts were not isolated per project.
--
-- This migration scopes student accounts to a single project while keeping real
-- accounts (organisation / admin / teacher) globally unique as before. All user
-- rows still live in one physical `users` table, but uniqueness and lookup are
-- now partitioned by project for students.

-- 1. Associate a user row with the project it belongs to.
--    NULL for real accounts (org/admin/teacher); set for project student accounts.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;

-- 2. Backfill project_id for existing student accounts from their participant
--    row. Every student created before this migration has exactly one
--    project_participants row (one student = one project), so this mapping is
--    unambiguous. Without it, legacy students would stay project_id = NULL and
--    be unreachable by the project-scoped student login.
UPDATE users u
SET project_id = pp.project_id
FROM project_participants pp
WHERE pp.user_id = u.id
  AND pp.role = 'student'
  AND u.role = 'student'
  AND u.project_id IS NULL;

-- 3. Drop the old global username uniqueness.
--    The constraint name created by `UNIQUE` on the column in 001 is users_username_key.
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_username_key;

-- 4. Real accounts (project_id IS NULL) keep GLOBAL username uniqueness.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_users_username_global
  ON users (username)
  WHERE project_id IS NULL;

-- 5. Student accounts are unique WITHIN a project, so the same username may be
--    reused across different projects without collision.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_users_username_per_project
  ON users (project_id, username)
  WHERE project_id IS NOT NULL;

-- 6. Fast lookup for the project-scoped student login path.
CREATE INDEX IF NOT EXISTS idx_users_project ON users (project_id);
