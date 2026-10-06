FILE = "app/AvtogazApp.jsx"

with open(FILE, "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

OLD = '''      {canLeft && <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0, width: 36,
        background: "linear-gradient(90deg, rgba(255,255,255,.95), rgba(255,255,255,0))", pointerEvents: "none",
      }} />}
      {canRight && <div style={{
        position: "absolute", right: 0, top: 0, bottom: 0, width: 36,
        background: "linear-gradient(270deg, rgba(255,255,255,.95), rgba(255,255,255,0))", pointerEvents: "none",
      }} />}
    </div>
  );
}'''

NEW = '''      {canLeft && <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0, width: 36,
        background: "linear-gradient(90deg, rgba(255,255,255,.95), rgba(255,255,255,0))", pointerEvents: "none",
      }} />}
      {canRight && <div style={{
        position: "absolute", right: 0, top: 0, bottom: 0, width: 36,
        background: "linear-gradient(270deg, rgba(255,255,255,.95), rgba(255,255,255,0))", pointerEvents: "none",
      }} />}
      {canLeft && (
        <button
          onClick={() => scrollRef.current?.scrollBy({ left: -220, behavior: "smooth" })}
          style={{
            position: "absolute", left: 2, top: "50%", transform: "translateY(-50%)",
            width: 26, height: 26, borderRadius: "50%", border: `1px solid ${T.border}`,
            background: T.s1, color: T.flame, cursor: "pointer", display: "flex",
            alignItems: "center", justifyContent: "center", boxShadow: T.sh1, zIndex: 2,
          }}
          aria-label="Chapga"
        >
          <ChevronLeft size={15} />
        </button>
      )}
      {canRight && (
        <button
          onClick={() => scrollRef.current?.scrollBy({ left: 220, behavior: "smooth" })}
          style={{
            position: "absolute", right: 2, top: "50%", transform: "translateY(-50%)",
            width: 26, height: 26, borderRadius: "50%", border: `1px solid ${T.border}`,
            background: T.s1, color: T.flame, cursor: "pointer", display: "flex",
            alignItems: "center", justifyContent: "center", boxShadow: T.sh1, zIndex: 2,
          }}
          aria-label="O'ngga"
        >
          <ChevronRight size={15} />
        </button>
      )}
    </div>
  );
}'''

if OLD in c:
    c = c.replace(OLD, NEW)
    with open(FILE, "w", encoding="utf-8", newline="\r\n") as f:
        f.write(c)
    print("[OK] TUZATILDI: navigatsiya qatoriga chap/o'ng scroll tugmalari qo'shildi")
else:
    print("[XATO] Mos kelmadi")

# Import qatoriga ChevronLeft/ChevronRight qo'shamiz
with open(FILE, "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

OLD_IMPORT = "Package, Wallet, Plus, X, TrendingUp, TrendingDown, ChevronDown, Trash2,"
NEW_IMPORT = "Package, Wallet, Plus, X, TrendingUp, TrendingDown, ChevronDown, ChevronLeft, ChevronRight, Trash2,"

if OLD_IMPORT in c:
    c = c.replace(OLD_IMPORT, NEW_IMPORT)
    with open(FILE, "w", encoding="utf-8", newline="\r\n") as f:
        f.write(c)
    print("[OK] ChevronLeft/ChevronRight import qilindi")
else:
    print("[WARN] import qatori mos kelmadi")
