FILE = "app/api/daily-report/route.js"

with open(FILE, "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

OLD = '''  const jamiKirim = kirimlar.reduce((s, c) => s + num(c.amountSum), 0);
  const jamiChiqim = chiqimlar.reduce((s, c) => s + num(c.amountSum), 0);
  const sofFoyda = jamiKirim - jamiChiqim;

  // Kategoriya bo'yicha guruhlash
  const groupByCategory = (arr) => {
    const map = {};
    arr.forEach((c) => {
      const key = c.category || "Boshqa";
      map[key] = (map[key] || 0) + num(c.amountSum);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  };

  const kirimByCategory = groupByCategory(kirimlar);
  const chiqimByCategory = groupByCategory(chiqimlar);

  // Bugun yakunlangan xizmat kartalari
  const finishedToday = (data.serviceCards || []).filter(
    (card) => card.status && card.status !== "ochiq" && card.finalizedDate === today
  );
  const cardsRevenue = finishedToday.reduce((s, c) => s + num(c.finalTotal), 0);
  const cardsProfit = finishedToday.reduce((s, c) => s + num(c.profitSum), 0);'''

NEW = '''  const jamiKirim = kirimlar.reduce((s, c) => s + num(c.amountSum), 0);

  // "Rahbarga chiqim" — bu oddiy operatsion xarajat emas, balki rahbarning
  // ALLAQACHON topilgan foydadan shaxsan pul olishi (distribution). Shuning
  // uchun bu sof foyda hisobidan chiqarib tashlanadi, aks holda hisobot
  // noto'g'ri (haqiqatda ijobiy bo'lgan kun) manfiy ko'rsatishi mumkin.
  const chiqimOperatsion = chiqimlar.filter((c) => c.category !== "Rahbarga chiqim");
  const rahbarOlgan = chiqimlar.filter((c) => c.category === "Rahbarga chiqim").reduce((s, c) => s + num(c.amountSum), 0);
  const jamiChiqim = chiqimOperatsion.reduce((s, c) => s + num(c.amountSum), 0);
  const sofFoyda = jamiKirim - jamiChiqim;

  // Kategoriya bo'yicha guruhlash
  const groupByCategory = (arr) => {
    const map = {};
    arr.forEach((c) => {
      const key = c.category || "Boshqa";
      map[key] = (map[key] || 0) + num(c.amountSum);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  };

  const kirimByCategory = groupByCategory(kirimlar);
  const chiqimByCategory = groupByCategory(chiqimOperatsion);'''

if OLD in c:
    c = c.replace(OLD, NEW)
    print("[OK] PATCH A: hisoblash mantig'i tuzatildi (Rahbarga chiqim ajratildi)")
else:
    print("[WARN] PATCH A mos kelmadi")

OLD2 = '''  report += `\\n\\ud83d\\ude97 XIZMAT KARTALARI\\n`;
  report += `\\u251c\\u2500 Yakunlangan: ${finishedToday.length} ta\\n`;
  report += `\\u251c\\u2500 Tushum: ${formatSum(cardsRevenue)}\\n`;
  report += `\\u2514\\u2500 Foyda: ${formatSum(cardsProfit)}\\n`;

  report += `\\n\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\n`;
  report += `\\ud83d\\udcb5 SOF FOYDA (kirim \\u2212 chiqim): ${formatSum(sofFoyda)}\\n`;'''

NEW2 = '''  if (rahbarOlgan > 0) {
    report += `\\n\\ud83d\\udc64 Rahbar shaxsan oldi: ${formatSum(rahbarOlgan)} (sof foydadan, xarajat sifatida hisoblanmaydi)\\n`;
  }

  report += `\\n\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\n`;
  report += `\\ud83d\\udcb5 SOF FOYDA (operatsion, Rahbar ulushisiz): ${formatSum(sofFoyda)}\\n`;'''

if OLD2 in c:
    c = c.replace(OLD2, NEW2)
    print("[OK] PATCH B: Xizmat kartalari bo'limi olib tashlandi, Rahbar ulushi alohida ko'rsatiladi")
else:
    print("[WARN] PATCH B mos kelmadi")

with open(FILE, "w", encoding="utf-8", newline="\r\n") as f:
    f.write(c)
print("\n[OK] Fayl yozildi")
