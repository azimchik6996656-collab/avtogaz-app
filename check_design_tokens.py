with open("app/AvtogazApp.jsx", "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

idx = c.find("const T = ")
print("=== Rang sxemasi (T obyekti) ===")
print(c[idx:idx+800])
print()

idx2 = c.find("function ServicesTab")
print("=== ServicesTab boshlanishi ===")
print(c[idx2:idx2+600])
