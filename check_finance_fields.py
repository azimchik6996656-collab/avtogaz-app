with open("app/AvtogazApp.jsx", "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

# Karta yakunlash joyini topamiz - qanday maydonlar bor
idx = c.find("finalTotal")
print("=== finalTotal atrofi ===")
print(c[idx-200:idx+400])
print()

idx2 = c.find("finishedAt")
if idx2 == -1:
    idx2 = c.find("closedAt")
if idx2 == -1:
    idx2 = c.find("status: \"tugallangan\"")
if idx2 == -1:
    idx2 = c.find("Tugallangan")
print("=== Yakunlanish holati/sana maydoni ===")
print(c[idx2-200:idx2+300] if idx2 > -1 else "TOPILMADI")
