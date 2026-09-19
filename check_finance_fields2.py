with open("app/AvtogazApp.jsx", "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

idx = c.find("function cardStatus")
print("=== cardStatus funksiyasi ===")
print(c[idx:idx+500])
print()

idx2 = c.find("onFinalize")
print("=== onFinalize / finalize logikasi (birinchi topilgan joy) ===")
print(c[idx2:idx2+600])
print()

idx3 = c.find("d.cashflow.unshift")
print("=== cashflow yozuvi namunasi ===")
print(c[idx3-100:idx3+400])
