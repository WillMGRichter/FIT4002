-- Student join feature: per-project attempts setting.
-- Each project defines how many attempts an anonymous student gets when they
-- join via the shareable link. Defaults to 1 to preserve existing behaviour.
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS default_max_attempts INT NOT NULL DEFAULT 1;
