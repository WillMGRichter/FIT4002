import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

/** Validates that required environment variables exist */
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase env vars');
}

/** Pre-configured Supabase admin client with service role permissions */
export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);