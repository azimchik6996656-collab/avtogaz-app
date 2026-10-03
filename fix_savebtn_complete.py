FILE = "app/AvtogazApp.jsx"

with open(FILE, "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

OLD = '''function SaveBtn({ onClick, disabled, children = "Saqlash", color }) {
  return (
    <button onClick={onClick} disabled={disabled} type="button" className="btn" style={{
      width: "100%", marginTop: 18, padding: "12px", borderRadius: 10, border: "none",
      background: disabled
        ? T.s3
        : color
          ? `linear-gradient(180deg,${color}F2,${color} 55%,${color}CC)`
          : `linear-gradient(180deg,#E4682A,${T.flame} 55%,#C74E12)`,
      color: disabled ? T.muted : "#fff", fontWeight: 700, fontSize: 13.5,
      cursor: disabled ? "not-allowed" : "pointer",
      boxShadow: disabled
        ? "none"
        : `inset 0 1px 0 rgba(255,255,255,.22), 0 2px 4px rgba(62,50,30,.10), 0 6px 18px ${(color || T.flame)}38`,
      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    }}>{children}</button>
  );
}'''

NEW = '''function SaveBtn({ onClick, disabled, children = "Saqlash", color }) {
  // MUHIM: ikki marta bosishdan himoya — bosilgan zahoti tugma darhol
  // o'chadi, shuning uchun tez ketma-ket ikkinchi bosish (masalan "Ta'minotchiga
  // to'lov" kabi joylarda) ikki marta yozuv/to'lov yaratmaydi. Modal odatda
  // onSave ichida yopiladi va komponent unmount bo'ladi, lekin har ehtimolga
  // qarshi 2 soniyadan keyin avtomatik qayta yoqiladi.
  const [justClicked, setJustClicked] = useState(false);
  const isDisabled = disabled || justClicked;
  const handleClick = (e) => {
    if (isDisabled) return;
    setJustClicked(true);
    setTimeout(() => setJustClicked(false), 2000);
    onClick && onClick(e);
  };
  return (
    <button onClick={handleClick} disabled={isDisabled} type="button" className="btn" style={{
      width: "100%", marginTop: 18, padding: "12px", borderRadius: 10, border: "none",
      background: isDisabled
        ? T.s3
        : color
          ? `linear-gradient(180deg,${color}F2,${color} 55%,${color}CC)`
          : `linear-gradient(180deg,#E4682A,${T.flame} 55%,#C74E12)`,
      color: isDisabled ? T.muted : "#fff", fontWeight: 700, fontSize: 13.5,
      cursor: isDisabled ? "not-allowed" : "pointer",
      boxShadow: isDisabled
        ? "none"
        : `inset 0 1px 0 rgba(255,255,255,.22), 0 2px 4px rgba(62,50,30,.10), 0 6px 18px ${(color || T.flame)}38`,
      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    }}>{children}</button>
  );
}'''

if OLD in c:
    c = c.replace(OLD, NEW)
    with open(FILE, "w", encoding="utf-8", newline="\r\n") as f:
        f.write(c)
    print("[OK] TUZATILDI: SaveBtn to'liq himoyalangan (funktsional + vizual)")
else:
    print("[XATO] Mos kelmadi, joriy holatni tekshiring")
