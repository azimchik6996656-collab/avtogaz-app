FILE = "app/AvtogazApp.jsx"

with open(FILE, "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

OLD = '''const res = await fetch("/api/daily-report", { method: "POST", headers: { "Content-Type": "application/json", "authorization": "Bearer test" } });'''

NEW = '''const res = await fetch("/api/daily-report", { method: "POST", headers: { "Content-Type": "application/json", "authorization": "Bearer " + (process.env.NEXT_PUBLIC_CRON_SECRET || "") } });'''

if OLD in c:
    c = c.replace(OLD, NEW)
    with open(FILE, "w", encoding="utf-8", newline="\r\n") as f:
        f.write(c)
    print("[OK] TUZATILDI: 'Bearer test' -> haqiqiy CRON_SECRET ishlatiladi")
else:
    print("[XATO] Mos kelmadi")
