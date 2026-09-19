with open("app/AvtogazApp.jsx", "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

idx = c.find("function closeCard")
print("=== closeCard funksiyasi ===")
print(c[idx:idx+1200])
