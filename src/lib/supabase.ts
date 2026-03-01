import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Service role client — bypasuje RLS, plný přístup k DB
// Používat POUZE na server-side (API routes)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  db: { schema: "app" },
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
