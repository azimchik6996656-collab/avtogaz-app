import { resolveAuth } from "../../../lib/authRequest";
import { serverClient } from "../../../lib/supabaseServer";

export const dynamic = "force-dynamic";

/**
 * Xodimlar (staff) ro'yxati — faqat "azim" roli uchun, va faqat SO'RALGAN
 * FILIALGA tegishli xodimlar. 2FA PIN sozlash / "Xodim qo'shish" oynasida
 * ishlatiladi. Haqiqiy PIN qiymati (hash) hech qachon qaytarilmaydi — faqat
 * "PIN o'rnatilganmi" degan boolean.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const auth = await resolveAuth(request, searchParams.get("branchId"));
  if (!auth.ok) return Response.json({ ok: false, error: auth.error }, { status: auth.status });
  if (auth.role !== "azim") return Response.json({ ok: false, error: "Ruxsat yo'q" }, { status: 403 });

  try {
    const supabase = serverClient();
    const { data, error } = await supabase
      .from("staff")
      .select("email, role, full_name, pin_hash")
      .eq("branch_id", auth.branchId)
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
