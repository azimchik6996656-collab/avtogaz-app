import shutil

FILE = "app/AvtogazApp.jsx"
shutil.copy(FILE, FILE + ".v66backup")
print("[OK] Backup:", FILE + ".v66backup")

with open(FILE, "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

OLD = '''      {rahbar && <DailyReportSettings data={data} onUpdate={s => setData(p => ({...p, settings:s}))} />}'''

NEW = '''      {!readOnly && <DailyReportSettings data={data} onUpdate={(s) => patch((d) => { d.settings = s; return d; })} />}'''

if OLD in c:
    c = c.replace(OLD, NEW)
    with open(FILE, "w", encoding="utf-8", newline="\r\n") as f:
        f.write(c)
    print("[OK] TUZATILDI: 'rahbar' -> '!readOnly', 'setData' -> 'patch' ga almashtirildi")
else:
    print("[XATO] Mos kelmadi")
