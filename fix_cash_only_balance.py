FILE = "app/api/daily-report/route.js"

with open(FILE, "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

OLD = '''  const allFlow = data.cashflow || [];
  const todayFlow = allFlow.filter((c) => c.date === today);
  const kirimlar = todayFlow.filter((c) => c.type === "kirim");
  const chiqimlar = todayFlow.filter((c) => c.type === "chiqim");

  // Kassa balansi: bugungacha bo'lgan BARCHA harakatlar yig'indisi = ERTALABKI qoldiq
  const oldingiFlow = allFlow.filter((c) => c.date < today);
  const boshlangichQoldiq = oldingiFlow.reduce(
    (s, c) => s + (c.type === "kirim" ? num(c.amountSum) : -num(c.amountSum)), 0
  );'''

NEW = '''  const allFlow = data.cashflow || [];
  // MUHIM: kassa (naqd pul) balansi faqat "Naqd pul" to'lovlarini hisobga oladi.
  // Karta/Bank o'tkazma orqali kelgan pul jismoniy kassada emas, bankda turadi.
  // paymentType ko'rsatilmagan yozuvlar (masalan usta/rahbar haqi) odatda naqd
  // hisoblanadi, shuning uchun default sifatida "naqd" deb olinadi.
  const isCash = (c) => !c.paymentType || c.paymentType === "Naqd pul";

  const todayFlow = allFlow.filter((c) => c.date === today);
  const todayCashFlow = todayFlow.filter(isCash);
  const kirimlar = todayCashFlow.filter((c) => c.type === "kirim");
  const chiqimlar = todayCashFlow.filter((c) => c.type === "chiqim");

  // Naqd bo'lmagan (karta/bank) kirimlar — alohida ko'rsatish uchun
  const nonCashKirim = todayFlow.filter((c) => c.type === "kirim" && !isCash(c))
    .reduce((s, c) => s + num(c.amountSum), 0);

  // Kassa balansi: bugungacha bo'lgan BARCHA NAQD harakatlar yig'indisi = ERTALABKI qoldiq
  const oldingiFlow = allFlow.filter((c) => c.date < today && isCash(c));
  const boshlangichQoldiq = oldingiFlow.reduce(
    (s, c) => s + (c.type === "kirim" ? num(c.amountSum) : -num(c.amountSum)), 0
  );'''

if OLD in c:
    c = c.replace(OLD, NEW)
    print("[OK] PATCH A: faqat naqd pul hisoblanadigan bo'ldi")
else:
    print("[WARN] PATCH A mos kelmadi")

# Non-cash kirimni hisobotga qo'shamiz (KIRIM bo'limi oxirida)
OLD2 = '''  report += `\\n\\ud83d\\udcc9 CHIQIM'''

NEW2 = '''  if (nonCashKirim > 0) {
    report += `\\n\\ud83d\\udcb3 (Naqd emas — karta/bank): ${formatSum(nonCashKirim)}\\n`;
  }

  report += `\\n\\ud83d\\udcc9 CHIQIM'''

if OLD2 in c:
    c = c.replace(OLD2, NEW2)
    print("[OK] PATCH B: naqd bo'lmagan kirim ko'rsatildi")
else:
    print("[WARN] PATCH B mos kelmadi")

with open(FILE, "w", encoding="utf-8", newline="\r\n") as f:
    f.write(c)
print("\n[OK] Fayl yozildi")
