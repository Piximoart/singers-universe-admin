import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || "service-role-key-not-set";

// Service role client — bypasuje RLS, plný přístup k DB
// Používat POUZE na server-side (API routes)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  db: { schema: process.env.SUPABASE_DB_SCHEMA || "app" },
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
