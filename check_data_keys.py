with open("app/AvtogazApp.jsx", "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

# "key=" yoki "apiGet"/"loadKey" kabi chaqiruvlarni qidiramiz
import re
idx = c.find("branchId")
print("=== branchId birinchi ishlatilishi ===")
print(c[idx-200:idx+400])
print()

idx2 = c.find("/api/data")
print("=== /api/data chaqiruvi ===")
print(c[idx2-300:idx2+500])
