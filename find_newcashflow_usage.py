with open("app/AvtogazApp.jsx", "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

idx = c.find("<NewCashflowModal")
print(c[max(0,idx-100):idx+800])
