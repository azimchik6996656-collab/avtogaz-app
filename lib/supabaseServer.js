import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client (SERVICE ROLE kaliti bilan) — API route'lar ichida
 * ishlatiladi, brauzerga hech qachon yuborilmaydi.
 */
export function serverClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
}
