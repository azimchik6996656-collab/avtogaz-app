import re
import shutil

FILE = "app/AvtogazApp.jsx"
shutil.copy(FILE, FILE + ".v67backup")
print("[OK] Backup:", FILE + ".v67backup")

with open(FILE, "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

# Har bir "cashflow.unshift({" yoki "cashflow.push({" dan keyin, birinchi
# "date:" so'zidan OLDIN "time: nowTime(), " qo'shamiz (agar hali yo'q bo'lsa)
pattern = re.compile(r'(cashflow\.(?:unshift|push)\(\{)(.*?)(date:)', re.DOTALL)

count = 0
def replacer(m):
    global count
    prefix, middle, date_kw = m.group(1), m.group(2), m.group(3)
    if "time:" in middle:
        return m.group(0)  # allaqachon bor, tegmaymiz
    count += 1
    return prefix + middle + "time: nowTime(), " + date_kw

new_c = pattern.sub(replacer, c)

with open(FILE, "w", encoding="utf-8", newline="\r\n") as f:
    f.write(new_c)

print(f"[OK] {count} ta cashflow yozuviga vaqt (time) qo'shildi")
