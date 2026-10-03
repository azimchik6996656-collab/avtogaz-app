with open("app/AvtogazApp.jsx", "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

idx = c.find(".ch {")
if idx == -1:
    idx = c.find(".ch:hover")
if idx == -1:
    idx = c.find("function GlobalStyles")
print(c[max(0,idx-50):idx+500])
