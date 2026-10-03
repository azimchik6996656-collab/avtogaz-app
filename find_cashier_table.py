with open("app/AvtogazApp.jsx", "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

idx = c.find("function CashierTab")
segment = c[idx:idx+6000]

# "cols=" yoki "Tbl" yoki "DateGroupedList" bilan bog'liq jadval qismini topamiz
import re
for m in re.finditer(r'(DateGroupedList|<Tbl)', segment):
    print(f"--- {m.group(0)} at offset {m.start()} ---")
    print(segment[m.start():m.start()+400])
    print()
