// lib/savings.js
// Jamg'arma (omonat) hisobi — ilova (AvtogazApp.jsx) va avtomatik kunlik hisobot
// (app/api/daily-report/route.js) uchun UMUMIY hisob-kitob. Ikkalasi bir xil
// natija ko'rsatishi uchun mantiq faqat shu yerda turadi.
//
// Ma'lumot modeli:
//  - Kassadan jamg'armaga o'tkazma  -> cashflow: type "chiqim", category SAVINGS_OUT_CAT
//  - Jamg'armadan kassaga qaytarish -> cashflow: type "kirim",  category SAVINGS_IN_CAT
//  - Qarzdorlar ro'yxatidan ko'chirilgan eski jamg'arma -> data.savings.adjustments
//    (kassaga tegmaydi, chunki pul kassadan allaqachon chiqib ketgan)
//  - Oylik limit -> data.savings.monthlyTargets["YYYY-MM"] = summa
//
// Jamg'arma qoldig'i alohida saqlanmaydi, kassa yozuvlaridan HISOBLANADI —
// shuning uchun yozuv o'chirilsa yoki tahrirlansa, qoldiq o'zi to'g'rilanadi.

export const SAVINGS_OUT_CAT = "Jamg'armaga o'tkazma";
export const SAVINGS_IN_CAT = "Jamg'armadan qaytarish";

const num = (v) => Number(v) || 0;

export function isSavingsEntry(c) {
  return !!c && (c.category === SAVINGS_OUT_CAT || c.category === SAVINGS_IN_CAT);
}

export function monthKeyOf(iso) {
  return String(iso || "").slice(0, 7);
}

// Berilgan oy uchun limit: shu oyga qo'yilgan bo'lsa — o'sha, bo'lmasa eng
// yaqin oldingi oyning limiti (limit "davom etadi"), hech biri bo'lmasa 0.
export function targetForMonth(data, monthKey) {
  const targets = (data && data.savings && data.savings.monthlyTargets) || {};
  if (targets[monthKey] !== undefined && targets[monthKey] !== null && targets[monthKey] !== "") {
    return num(targets[monthKey]);
  }
  const earlier = Object.keys(targets).filter((k) => k < monthKey).sort();
  if (!earlier.length) return 0;
  return num(targets[earlier[earlier.length - 1]]);
}

export function isTargetExplicit(data, monthKey) {
  const targets = (data && data.savings && data.savings.monthlyTargets) || {};
  return targets[monthKey] !== undefined && targets[monthKey] !== null && targets[monthKey] !== "";
}

// monthKey = "YYYY-MM"; dateISO = "YYYY-MM-DD" (bugungi kun — "bugun qo'shildi" uchun)
export function savingsSummary(data, monthKey, dateISO) {
  const cf = (data && data.cashflow) || [];
  const adj = (data && data.savings && data.savings.adjustments) || [];

  const outs = cf.filter((c) => c.category === SAVINGS_OUT_CAT && c.type === "chiqim");
  const ins = cf.filter((c) => c.category === SAVINGS_IN_CAT && c.type === "kirim");

  const sum = (arr) => arr.reduce((s, c) => s + num(c.amountSum), 0);
  const inMonth = (arr) => arr.filter((c) => monthKeyOf(c.date) === monthKey);

  const deposits = sum(outs) + sum(adj);
  const withdrawals = sum(ins);
  const balance = deposits - withdrawals;

  // Oy bo'yicha: shu oy jamg'armaga QO'SHILGAN (sof: qo'shilgan − qaytarilgan)
  const monthAdded = sum(inMonth(outs)) + sum(inMonth(adj));
  const monthReturned = sum(inMonth(ins));
  const monthNet = monthAdded - monthReturned;

  const target = targetForMonth(data, monthKey);
  const remaining = Math.max(0, target - monthNet);
  const percent = target > 0 ? Math.min(100, Math.round((monthNet / target) * 100)) : 0;

  const todayAdded = dateISO
    ? sum(outs.filter((c) => c.date === dateISO)) + sum(adj.filter((c) => c.date === dateISO))
    : 0;

  return {
    balance, deposits, withdrawals,
    monthAdded, monthReturned, monthNet,
    target, remaining, percent,
    reached: target > 0 && monthNet >= target,
    over: target > 0 ? Math.max(0, monthNet - target) : 0,
    todayAdded,
    targetExplicit: isTargetExplicit(data, monthKey),
  };
}

// Barcha oylar bo'yicha tarix (yangi oy tepada)
export function savingsHistoryByMonth(data) {
  const cf = (data && data.cashflow) || [];
  const adj = (data && data.savings && data.savings.adjustments) || [];
  const months = new Set();
  cf.filter(isSavingsEntry).forEach((c) => months.add(monthKeyOf(c.date)));
  adj.forEach((a) => months.add(monthKeyOf(a.date)));
  Object.keys((data && data.savings && data.savings.monthlyTargets) || {}).forEach((k) => months.add(k));
  return [...months].filter(Boolean).sort().reverse().map((m) => ({ month: m, ...savingsSummary(data, m) }));
}
