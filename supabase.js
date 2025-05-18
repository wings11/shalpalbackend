import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL; // e.g., https://<project-id>.supabase.co
const supabaseKey = process.env.SUPABASE_KEY; // Your Supabase anon key
const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;