import shutil

FILE = "app/api/daily-report/route.js"
shutil.copy(FILE, FILE + ".v1backup")
print("[OK] Backup:", FILE + ".v1backup")

with open(FILE, "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

# ═══════════════════════════════════════════════════════════
# 1. generateFinancialReport funksiyasini qo'shamiz
#    (generateStockReport funksiyasidan oldin joylashtiramiz)
# ═══════════════════════════════════════════════════════════

MARKER = "const generateStockReport = (data) => {"

FINANCIAL_FN = '''const generateFinancialReport = (data) => {
  const today = new Date().toISOString().slice(0, 10);

  const todayFlow = (data.cashflow || []).filter((c) => c.date === today);
  const kirimlar = todayFlow.filter((c) => c.type === "kirim");
  const chiqimlar = todayFlow.filter((c) => c.type === "chiqim");

  const jamiKirim = kirimlar.reduce((s, c) => s + num(c.amountSum), 0);
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
  const cardsProfit = finishedToday.reduce((s, c) => s + num(c.profitSum), 0);

  let report = `\\ud83d\\udcb0 MOLIYAVIY HISOBOT - ${today}\\n`;
  report += `\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\n\\n`;

  report += `\\ud83d\\udcc8 KIRIM (${kirimlar.length} ta) \\u2014 Jami: ${formatSum(jamiKirim)}\\n`;
  if (kirimByCategory.length > 0) {
    kirimByCategory.slice(0, 6).forEach(([cat, sum], idx) => {
      const isLast = idx === Math.min(kirimByCategory.length, 6) - 1;
      report += `${isLast ? "\\u2514\\u2500" : "\\u251c\\u2500"} ${cat}: ${formatSum(sum)}\\n`;
    });
  }

  report += `\\n\\ud83d\\udcc9 CHIQIM (${chiqimlar.length} ta) \\u2014 Jami: ${formatSum(jamiChiqim)}\\n`;
  if (chiqimByCategory.length > 0) {
    chiqimByCategory.slice(0, 6).forEach(([cat, sum], idx) => {
      const isLast = idx === Math.min(chiqimByCategory.length, 6) - 1;
      report += `${isLast ? "\\u2514\\u2500" : "\\u251c\\u2500"} ${cat}: ${formatSum(sum)}\\n`;
    });
  }

  report += `\\n\\ud83d\\ude97 XIZMAT KARTALARI\\n`;
  report += `\\u251c\\u2500 Yakunlangan: ${finishedToday.length} ta\\n`;
  report += `\\u251c\\u2500 Tushum: ${formatSum(cardsRevenue)}\\n`;
  report += `\\u2514\\u2500 Foyda: ${formatSum(cardsProfit)}\\n`;

  report += `\\n\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\n`;
  report += `\\ud83d\\udcb5 SOF FOYDA (kirim \\u2212 chiqim): ${formatSum(sofFoyda)}\\n`;
  report += `\\u23f0 ${new Date().toLocaleTimeString("uz-UZ")}\\n`;

  return report;
};

'''

if MARKER in c and "generateFinancialReport" not in c:
    c = c.replace(MARKER, FINANCIAL_FN + MARKER)
    print("[OK] PATCH 1: generateFinancialReport funksiyasi qo'shildi")
else:
    print("[WARN] PATCH 1: marker topilmadi yoki funksiya allaqachon bor")

# ═══════════════════════════════════════════════════════════
# 2. POST handlerda ikkala hisobotni birlashtirib yuborish
# ═══════════════════════════════════════════════════════════

OLD2 = '''    const appData = JSON.parse(staffData.data);

    // Hisobot yaratish
    const report = generateStockReport(appData);'''

NEW2 = '''    const appData = JSON.parse(staffData.data);

    // Hisobot yaratish — sklad + moliyaviy, ikkalasi bitta xabarda
    const stockReport = generateStockReport(appData);
    const financialReport = generateFinancialReport(appData);
    const report = financialReport + "\\n\\n" + stockReport;'''

if OLD2 in c:
    c = c.replace(OLD2, NEW2)
    print("[OK] PATCH 2: POST handler ikkala hisobotni birlashtiradi")
else:
    print("[WARN] PATCH 2: mos kelmadi")

with open(FILE, "w", encoding="utf-8", newline="\r\n") as f:
    f.write(c)
print("\n[OK] Fayl yozildi.")
