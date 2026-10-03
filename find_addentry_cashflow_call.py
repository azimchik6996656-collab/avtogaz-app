with open("app/AvtogazApp.jsx", "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

idx = c.find("function addEntry")
seg = c[idx:idx+3000]
cf_idx = seg.find("cashflow.")
print(seg[max(0,cf_idx-100):cf_idx+400])
