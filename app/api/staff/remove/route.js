import { verifyGoogleStaff } from "../../../../lib/staffAuth";
import { serverClient } from "../../../../lib/supabaseServer";

export const dynamic = "force-dynamic";

/**
 * Xodimni Google orqali kirish ro'yxatidan o'chirish — faqat "azim". O'zini o'zi
 * (yoki boshqa "azim" rolini) o'chirib qo'ymasligi uchun himoya qilingan.
 * Body: { email }.
 */
export async function POST(request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const auth = await verifyGoogleStaff(token);
  if (!auth.ok) return Response.json({ ok: false, error: auth.error }, { status: auth.status });
  if (auth.role !== "azim") return Response.json({ ok: false, error: "Ruxsat yo'q" }, { status: 403 });

  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body?.email || "").toLowerCase().trim();
    if (!email) return Response.json({ ok: false, error: "email kerak" }, { status: 400 });
    if (email === auth.email) return Response.json({ ok: false, error: "O'zingizni o'chira olmaysiz" }, { status: 400 });

    const supabase = serverClient();
    const { error } = await supabase.from("staff").delete().eq("email", email).neq("role", "azim");
    if (error) throw error;

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
