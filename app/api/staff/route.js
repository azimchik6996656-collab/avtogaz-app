import { verifyGoogleStaff } from "../../../lib/staffAuth";
import { serverClient } from "../../../lib/supabaseServer";

export const dynamic = "force-dynamic";

/**
 * Xodimlar (staff) ro'yxati — faqat "azim" roli uchun. 2FA PIN sozlash oynasida
 * ishlatiladi. Haqiqiy PIN qiymati (hash) hech qachon qaytarilmaydi — faqat
 * "PIN o'rnatilganmi" degan boolean.
 */
export async function GET(request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const auth = await verifyGoogleStaff(token);
  if (!auth.ok) return Response.json({ ok: false, error: auth.error }, { status: auth.status });
  if (auth.role !== "azim") return Response.json({ ok: false, error: "Ruxsat yo'q" }, { status: 403 });

  try {
    const supabase = serverClient();
    const { data, error } = await supabase
      .from("staff")
      .select("email, role, full_name, pin_hash")
      .order("role", { ascending: true });
    if (error) throw error;

    const staff = (data || []).map((s) => ({
      email: s.email, role: s.role, fullName: s.full_name, hasPin: !!s.pin_hash,
    }));
    return Response.json({ ok: true, staff }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return Response.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
