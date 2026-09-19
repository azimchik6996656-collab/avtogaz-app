with open("app/AvtogazApp.jsx", "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

idx = c.find("function FinalizeModal")
end_idx = c.find("\nfunction ", idx + 20)
segment = c[idx:end_idx]
print(f"FinalizeModal uzunligi: {len(segment)} belgi")
print()

# todayISO() ishlatilgan barcha joylarni topamiz
import re
for m in re.finditer(r'.{60}todayISO\(\).{60}', segment):
    print(m.group(0))
    print("---")
