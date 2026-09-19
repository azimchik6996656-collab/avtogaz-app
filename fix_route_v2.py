FILE = "app/api/daily-report/route.js"

with open(FILE, "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

OLD = '''    const { data: staffData, error } = await supabase
      .from("staff")
      .select("data")
      .eq("id", "main")
      .single();

    if (error || !staffData?.data) {
      return new Response("Data not found", { status: 404 });
    }

    const appData = JSON.parse(staffData.data);
    const stockReport = generateStockReport(appData);'''

NEW = '''    // MUHIM: jadval "app_data", id = filial ("main"), haqiqiy ilova state'i
    // "data" ustuni ichida STORAGE_KEY ("avtogaz-v2") kaliti ostida saqlanadi.
    const STORAGE_KEY = "avtogaz-v2";
    const branchId = "main";

    const { data: row, error } = await supabase
      .from("app_data")
      .select("data")
      .eq("id", branchId)
      .single();

    if (error || !row?.data) {
      return new Response(JSON.stringify({ error: "Data not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const bag = row.data || {};
    const appData = bag[STORAGE_KEY];

    if (!appData) {
      return new Response(JSON.stringify({ error: "App state not found under STORAGE_KEY" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const stockReport = generateStockReport(appData);'''

if OLD in c:
    c = c.replace(OLD, NEW)
    with open(FILE, "w", encoding="utf-8", newline="\r\n") as f:
        f.write(c)
    print("[OK] TUZATILDI: app_data jadvali va avtogaz-v2 kaliti orqali to'g'ri o'qiladi")
else:
    print("[XATO] Hali mos kelmadi")
