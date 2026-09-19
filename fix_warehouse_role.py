import shutil

FILE = "app/AvtogazApp.jsx"
shutil.copy(FILE, FILE + ".v65backup")
print("[OK] Backup:", FILE + ".v65backup")

with open(FILE, "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

OLD = '''{ id: "warehouse", label: "Sklad",         Icon: Package,    roles: ["azim", "kassir", "rahbar"] },'''
NEW = '''{ id: "warehouse", label: "Sklad",         Icon: Package,    roles: ["azim", "kassir", "rahbar", "sklad"] },'''

if OLD in c:
    c = c.replace(OLD, NEW)
    with open(FILE, "w", encoding="utf-8", newline="\r\n") as f:
        f.write(c)
    print("[OK] TUZATILDI: 'Sklad' bo'limiga 'sklad' roli qo'shildi")
else:
    print("[XATO] Mos kelmadi")
