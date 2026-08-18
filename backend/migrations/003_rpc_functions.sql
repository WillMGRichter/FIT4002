-- RPC function to increment the attempts_used counter for a participant
CREATE OR REPLACE FUNCTION increment_attempts_used(
  p_project_id UUID,
  p_user_id UUID
) RETURNS void AS $$
BEGIN
  UPDATE project_participants
  SET attempts_used = attempts_used + 1
  WHERE project_id = p_project_id
    AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;
