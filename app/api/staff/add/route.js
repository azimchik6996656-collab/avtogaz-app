import { verifyGoogleStaff } from "../../../../lib/staffAuth";
import { serverClient } from "../../../../lib/supabaseServer";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["kassir", "sklad"];

/**
 * Yangi ofis xodimini (kassir/sklad) Google orqali kirish ro'yxatiga qo'shish — faqat "azim".
 * Body: { email, fullName, role }. "azim" yoki "rahbar" bu yerdan qo'shilmaydi
 * (azim — tizim egasi, rahbar — 4 xonali PIN orqali kiradi).
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
    const fullName = String(body?.fullName || "").trim();
    const role = String(body?.role || "").trim();
    if (!email || !email.includes("@")) return Response.json({ ok: false, error: "To'g'ri email kiriting" }, { status: 400 });
    if (!fullName) return Response.json({ ok: false, error: "Ism kiritilmagan" }, { status: 400 });
    if (!ALLOWED_ROLES.includes(role)) return Response.json({ ok: false, error: "Noto'g'ri rol" }, { status: 400 });

    const supabase = serverClient();
    const { error } = await supabase
      .from("staff")
      .insert({ email, full_name: fullName, role });
    if (error) {
      if (error.code === "23505") return Response.json({ ok: false, error: "Bu email allaqachon ro'yxatda bor" }, { status: 409 });
      throw error;
    }

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
