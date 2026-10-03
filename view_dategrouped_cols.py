with open("app/AvtogazApp.jsx", "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

idx = c.find("function CashierTab")
segment = c[idx:idx+24506]

print(segment[14300:15600])
