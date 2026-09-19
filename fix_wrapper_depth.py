FILE = "app/api/daily-report/route.js"

with open(FILE, "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

OLD = '''    const bag = row.data || {};
    const appData = bag[STORAGE_KEY];'''

NEW = '''    const bag = row.data || {};
    const wrapper = bag[STORAGE_KEY];
    const appData = wrapper && wrapper.data;'''

if OLD in c:
    c = c.replace(OLD, NEW)
    with open(FILE, "w", encoding="utf-8", newline="\r\n") as f:
        f.write(c)
    print("[OK] TUZATILDI: appData = wrapper.data (to'g'ri chuqurlik)")
else:
    print("[XATO] Mos kelmadi")
