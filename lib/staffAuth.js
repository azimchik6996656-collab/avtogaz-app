import { serverClient } from "./supabaseServer";

/**
 * Google orqali kirgan foydalanuvchining Supabase access_token'ini tekshiradi
 * va uning email'i `staff` jadvalida, aynan shu FILIAL (branchId) uchun
 * ro'yxatdan o'tganini tasdiqlaydi. Faqat shu tasdiqdan keyin office roli
 * (azim/rahbar/kassir/sklad) beriladi.
 *
 * `staff` jadvalining kaliti endi (email, branch_id) — bitta email bir nechta
 * filialda (masalan tizim egasi ikkala filialda ham) alohida qatorlar bilan
 * ro'yxatdan o'tishi mumkin. branchId filtri shu yerda qo'llanadi — mijoz
 * boshqa filial nomini yuborsa ham, faqat shu email ANIQ o'sha filialga
 * ro'yxatdan o'tgan bo'lsagina ruxsat beriladi (xavfsizlik shu filtrga tayanadi).
 */
export async function verifyGoogleStaff(token, branchId) {
  if (!token) return { ok: false, status: 401, error: "Token kerak" };
  const branch = branchId || "main";
  try {
    const supabase = serverClient();
    const { data: userData, error } = await supabase.auth.getUser(token);
    if (error || !userData?.user?.email) {
      return { ok: false, status: 401, error: "Yaroqsiz sessiya" };
    }
    const email = userData.user.email.toLowerCase();
    const { data: staffRow, error: staffErr } = await supabase
      .from("staff")
      .select("role, full_name, pin_hash")
      .eq("email", email)
      .eq("branch_id", branch)
      .maybeSingle();
    if (staffErr) throw staffErr;
    if (!staffRow) return { ok: false, status: 403, error: "Sizga ruxsat berilmagan. Administratorga murojaat qiling." };
    return {
      ok: true, role: staffRow.role, email, fullName: staffRow.full_name || null,
      pinHash: staffRow.pin_hash || null, branchId: branch,
    };
  } catch (e) {
    return { ok: false, status: 500, error: String(e.message || e) };
  }
}
