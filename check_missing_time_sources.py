with open("app/AvtogazApp.jsx", "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

# NewCashflowModal - umumiy kirim/chiqim (Pitaniya kabi qo'lda kiritilgan)
idx = c.find("function NewCashflowModal")
if idx > -1:
    seg = c[idx:idx+2000]
    onsave_idx = seg.find("onSave(")
    print("=== NewCashflowModal onSave ===")
    print(seg[onsave_idx:onsave_idx+500])
print()

# Umumiy chiqim/kirim qo'shish funksiyasi qayerda ishlaydi - "addCashEntry" yoki "saveCashflow"
idx2 = c.find("function saveCashflow")
if idx2 == -1:
    idx2 = c.find("function addCashEntry")
if idx2 == -1:
    idx2 = c.find("onSave={(entry)")
print("addCashEntry/saveCashflow topildimi:", idx2)
if idx2 > -1:
    print(c[idx2:idx2+400])
