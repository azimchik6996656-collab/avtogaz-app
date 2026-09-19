with open("app/AvtogazApp.jsx", "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

import re
count = 0
for m in re.finditer(r'cashflow\.(unshift|push)\(\{', c):
    idx = m.start()
    snippet = c[idx:idx+350]
    if "paymentType" in snippet or "Naqd" in snippet or "Karta" in snippet:
        count += 1
        print(f"--- topilma {count} ---")
        print(snippet)
        print()

print(f"\nJami cashflow.unshift/push chaqiruvlari: {len(re.findall(r'cashflow.(unshift|push)', c))}")
print(f"paymentType/Naqd/Karta bor: {count}")
