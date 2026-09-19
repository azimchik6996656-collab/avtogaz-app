FILE = "app/api/daily-report/route.js"

with open(FILE, "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

OLD = '''  const todayFlow = (data.cashflow || []).filter((c) => c.date === today);
  const kirimlar = todayFlow.filter((c) => c.type === "kirim");
  const chiqimlar = todayFlow.filter((c) => c.type === "chiqim");'''

NEW = '''  const allFlow = data.cashflow || [];
  const todayFlow = allFlow.filter((c) => c.date === today);
  const kirimlar = todayFlow.filter((c) => c.type === "kirim");
  const chiqimlar = todayFlow.filter((c) => c.type === "chiqim");

  // Kassa balansi: bugungacha bo'lgan BARCHA harakatlar yig'indisi = ERTALABKI qoldiq
  const oldingiFlow = allFlow.filter((c) => c.date < today);
  const boshlangichQoldiq = oldingiFlow.reduce(
    (s, c) => s + (c.type === "kirim" ? num(c.amountSum) : -num(c.amountSum)), 0
  );'''

if OLD in c:
    c = c.replace(OLD, NEW)
    print("[OK] PATCH A: boshlang'ich qoldiq hisoblandi")
else:
    print("[WARN] PATCH A mos kelmadi")

# Hisobotga qo'shamiz - eng boshiga (KIRIM bo'limidan oldin)
OLD2 = '''  let report = `\\ud83d\\udcb0 MOLIYAVIY HISOBOT - ${today}\\n`;
  report += `\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\n\\n`;

  report += `\\ud83d\\udcc8 KIRIM'''

NEW2 = '''  let report = `\\ud83d\\udcb0 MOLIYAVIY HISOBOT - ${today}\\n`;
  report += `\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\u2501\\n\\n`;

  report += `\\ud83c\\udfe6 Ertalabki qoldiq: ${formatSum(boshlangichQoldiq)}\\n\\n`;

  report += `\\ud83d\\udcc8 KIRIM'''

if OLD2 in c:
    c = c.replace(OLD2, NEW2)
    print("[OK] PATCH B: ertalabki qoldiq hisobotga qo'shildi")
else:
    print("[WARN] PATCH B mos kelmadi")

# Sof foyda qatoridan keyin, yakuniy qoldiqni qo'shamiz
OLD3 = '''  report += `\\ud83d\\udcb5 SOF FOYDA (operatsion, Rahbar ulushisiz): ${formatSum(sofFoyda)}\\n`;
  report += `\\u23f0 ${new Date().toLocaleTimeString("uz-UZ")}\\n`;

  return report;
};'''

NEW3 = '''  report += `\\ud83d\\udcb5 SOF FOYDA (operatsion, Rahbar ulushisiz): ${formatSum(sofFoyda)}\\n`;

  const yakuniyQoldiq = boshlangichQoldiq + jamiKirim - jamiChiqim - rahbarOlgan;
  report += `\\ud83c\\udfe6 Kechqurungi qoldiq: ${formatSum(yakuniyQoldiq)}\\n`;
  report += `\\u23f0 ${new Date().toLocaleTimeString("uz-UZ")}\\n`;

  return report;
};'''

if OLD3 in c:
    c = c.replace(OLD3, NEW3)
    print("[OK] PATCH C: kechqurungi qoldiq qo'shildi")
else:
    print("[WARN] PATCH C mos kelmadi")

with open(FILE, "w", encoding="utf-8", newline="\r\n") as f:
    f.write(c)
print("\n[OK] Fayl yozildi")
