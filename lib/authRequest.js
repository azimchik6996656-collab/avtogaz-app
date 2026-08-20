import { verifySession } from "./pinSession";
import { verifyGoogleStaff } from "./staffAuth";

/**
 * Har bir API route uchun umumiy avtorizatsiya + filial (branch) aniqlash.
 *
 * Ikki xil token bo'lishi mumkin:
 *  - PIN-sessiya tokeni (usta/ta'minotchi/hamkor/rahbar, yoki 2FA'dan o'tgan
 *    ofis xodimi) — filial shu tokenning o'zida IMZOLANGAN, shuning uchun
 *    mijoz so'rovga boshqa filial nomi yozib qo'ysa ham e'tiborga olinmaydi.
 *  - Google (Supabase Auth) access_token — bu tokenning o'zida filial haqida
 *    hech narsa yo'q, shuning uchun `requestedBranchId` ishlatiladi, LEKIN
 *    xavfsizlik shu bilan ta'minlanadi: `verifyGoogleStaff` faqat shu email
 *    ANIQ o'sha filial uchun `staff` jadvalida ro'yxatdan o'tgan bo'lsagina
 *    muvaffaqiyat qaytaradi — mijoz filial nomini o'zgartirib "yolg'on"
 *    so'rasa, staff qatori topilmay, ruxsat rad etiladi.
 */
export async function resolveAuth(request, requestedBranchId) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return { ok: false, status: 401, error: "Avtorizatsiya kerak" };

  const pinPayload = verifySession(token);
  if (pinPayload) {
    return { ok: true, role: pinPayload.role, name: pinPayload.name, branchId: pinPayload.branchId || "main" };
  }

  const branchId = requestedBranchId || "main";
  const g = await verifyGoogleStaff(token, branchId);
  if (!g.ok) return g;
  return { ok: true, role: g.role, name: g.fullName, email: g.email, branchId, pinHash: g.pinHash };
}
