with open("app/AvtogazApp.jsx", "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

import re
# "key=" yoki "key:" ishlatilgan joylarni, ayniqsa /api/data bilan bog'liqlarini topamiz
for m in re.finditer(r'key["\']?\s*[:=]\s*["\']([a-zA-Z_]+)["\']', c):
    print(m.group(0))
