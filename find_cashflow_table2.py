with open("app/AvtogazApp.jsx", "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

idx = c.find("function CashierTab")
print("CashierTab topildimi:", idx)

if idx > -1:
    end_idx = c.find("\nfunction ", idx + 20)
    print("CashierTab uzunligi:", end_idx - idx if end_idx > -1 else "oxirigacha")

# "data.cashflow" render qilingan joylarni qidiramiz (rows={data.cashflow} yoki shunga o'xshash)
import re
for m in re.finditer(r'rows=\{[^}]*cashflow[^}]*\}', c):
    print(f"--- topildi at {m.start()} ---")
    print(c[max(0,m.start()-300):m.start()+50])
    print()
