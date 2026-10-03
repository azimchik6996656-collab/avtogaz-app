with open("app/AvtogazApp.jsx", "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

idx = c.find("function CashierTab")
segment = c[idx:idx+24506]

import re
for pattern in ["DateGroupedList", "<Tbl", "cols={", "category\", h:"]:
    positions = [m.start() for m in re.finditer(re.escape(pattern), segment)]
    print(f"{pattern}: {len(positions)} ta topildi, pozitsiyalar: {positions[:5]}")

# Birinchi "cols=" ni ko'ramiz
idx2 = segment.find("cols={")
if idx2 > -1:
    print()
    print("=== Birinchi jadval cols ===")
    print(segment[idx2-200:idx2+500])
