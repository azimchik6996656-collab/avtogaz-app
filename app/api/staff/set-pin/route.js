import { resolveAuth } from "../../../../lib/authRequest";
import { serverClient } from "../../../../lib/supabaseServer";
import { hashPin } from "../../../../lib/security";

export const dynamic = "force-dynamic";

/**
 * Bir xodimning 2FA PIN kodini o'rnatish/o'zgartirish/o'chirish — faqat "azim",
 * va faqat o'zi kirgan FILIALdagi xodim uchun. Body: { email, pin, branchId } —
 * pin bo'sh yuborilsa, PIN o'chiriladi (2FA o'chadi).
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const auth = await resolveAuth(request, body?.branchId);
    if (!auth.ok) return Response.json({ ok: false, error: auth.error }, { status: auth.status });
    if (auth.role !== "azim") return Response.json({ ok: false, error: "Ruxsat yo'q" }, { status: 403 });

    const email = String(body?.email || "").toLowerCase().trim();
    const pin = String(body?.pin || "").trim();
    if (!email) return Response.json({ ok: false, error: "email kerak" }, { status: 400 });
    if (pin && !/^\d{4,8}$/.test(pin)) {
      return Response.json({ ok: false, error: "PIN 4-8 xonali raqam bo'lishi kerak" }, { status: 400 });
    }

    const supabase = serverClient();
    const pinHash = pin ? await hashPin(pin) : null;
    const { error } = await supabase
      .from("staff")
      .update({ pin_hash: pinHash })
      .eq("email", email)
      .eq("branch_id", auth.branchId);
    if (error) throw error;

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
