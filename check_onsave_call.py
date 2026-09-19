with open("app/AvtogazApp.jsx", "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

idx = c.find("function FinalizeModal")
segment = c[idx:idx+6000]
onsave_idx = segment.find("onSave({")
print(segment[onsave_idx:onsave_idx+600])
