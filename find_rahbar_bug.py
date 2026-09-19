import re

with open("app/AvtogazApp.jsx", "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

# "rahbar" so'zi qatnashgan, lekin "role === " yoki "const rahbar" bilan bog'liq bo'lmagan joylarni qidiramiz
lines = c.split("\n")
for i, line in enumerate(lines):
    if re.search(r'\brahbar\b', line) and "role" not in line and "const rahbar" not in line and '"rahbar"' not in line and "'rahbar'" not in line and "Rahbar" not in line:
        print(f"{i+1}: {line.strip()}")
