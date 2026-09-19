FILE = "app/api/daily-report/route.js"

with open(FILE, "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

OLD = '''    const appData = JSON.parse(staffData.data);
    const report = generateStockReport(appData);'''

NEW = '''    const appData = JSON.parse(staffData.data);
    const stockReport = generateStockReport(appData);
    const financialReport = generateFinancialReport(appData);
    const report = financialReport + "\\n\\n" + stockReport;'''

if OLD in c:
    c = c.replace(OLD, NEW)
    with open(FILE, "w", encoding="utf-8", newline="\r\n") as f:
        f.write(c)
    print("[OK] PATCH 2 TUZATILDI: ikkala hisobot birlashtirildi")
else:
    print("[XATO] Hali ham mos kelmadi")
