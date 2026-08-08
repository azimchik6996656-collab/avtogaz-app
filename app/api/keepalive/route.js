import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    // Bazaga eng yengil so'rov — faqat "uyg'oq" turishi uchun, ma'lumotni o'zgartirmaydi
    await supabase.from("app_data").select("id").limit(1);
    return Response.json({ ok: true, time: new Date().toISOString() });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
