# AVTOGAZ SERVICE - KUNLIK HISOBOT SETUP SCRIPT
# Loyiha ildizida ishlatng: powershell -ExecutionPolicy Bypass -File ".\setup-daily-report.ps1"

param(
    [string]$ProjectPath = (Get-Location).Path,
    [string]$SourceDir   = (Get-Location).Path
)

function Write-Step { param([string]$Msg) Write-Host "[INFO] $Msg" -ForegroundColor Cyan }
function Write-OK   { param([string]$Msg) Write-Host "[OK]   $Msg" -ForegroundColor Green }
function Write-Warn { param([string]$Msg) Write-Host "[WARN] $Msg" -ForegroundColor Yellow }
function Write-Err  { param([string]$Msg) Write-Host "[ERR]  $Msg" -ForegroundColor Red }

Write-Host ""
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "  AVTOGAZ - KUNLIK HISOBOT SETUP SCRIPT         " -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# --- 1. Loyiha tekshiruvi ---
if (-not (Test-Path "$ProjectPath\package.json")) {
    Write-Err "package.json topilmadi! Loyiha ildizida ishlatng."
    exit 1
}
Write-OK "Loyiha ildizi topildi: $ProjectPath"

# --- 2. API Route papkasi ---
Write-Step "API Route papkasi yaratilmoqda..."
$apiDir = "$ProjectPath\app\api\daily-report"
if (-not (Test-Path $apiDir)) {
    New-Item -ItemType Directory -Path $apiDir -Force | Out-Null
    Write-OK "Papka yaratildi: $apiDir"
} else {
    Write-Warn "Papka allaqachon bor: $apiDir"
}

# --- 3. route.js kopirlash ---
Write-Step "daily-report-route.js kopirlanyapti..."
$src = "$SourceDir\daily-report-route.js"
$dst = "$apiDir\route.js"
if (Test-Path $src) {
    Copy-Item -Path $src -Destination $dst -Force
    Write-OK "Kopilandi: $dst"
} else {
    Write-Err "Fayl topilmadi: $src"
    Write-Err "daily-report-route.js ni loyiha papkasiga qoyng!"
}

# --- 4. vercel.json yangilash ---
Write-Step "vercel.json yangilanmoqda..."
$vercelSrc = "$SourceDir\vercel.json"
$vercelDst = "$ProjectPath\vercel.json"
if (Test-Path $vercelSrc) {
    Copy-Item -Path $vercelSrc -Destination $vercelDst -Force
    Write-OK "vercel.json yangilandi"
} else {
    Write-Warn "vercel.json topilmadi, manual qoshng"
}

# --- 5. AvtogazApp.jsx backup + patch ---
Write-Step "AvtogazApp.jsx tekshirilmoqda..."
$appFile = "$ProjectPath\app\AvtogazApp.jsx"
if (-not (Test-Path $appFile)) {
    Write-Err "AvtogazApp.jsx topilmadi: $appFile"
} else {
    $content = Get-Content -Path $appFile -Raw -Encoding UTF8

    if ($content -match "DailyReportSettings") {
        Write-Warn "DailyReportSettings allaqachon bor - Skip"
    } else {
        # Backup
        Copy-Item -Path $appFile -Destination "$appFile.backup" -Force
        Write-OK "Backup yaratildi: $appFile.backup"

        # Component kodi (emoji yoq)
        $component = @'

// === KUNLIK HISOBOT SOZLAMALARI (v60) ===
function DailyReportSettings({ data, onUpdate }) {
  const settings = data.settings || {};
  const [method, setMethod] = React.useState(settings.dailyReportMethod || "");
  const [phone, setPhone] = React.useState(settings.dailyReportPhone || "");
  const [chatId, setChatId] = React.useState(settings.dailyReportChat || "");
  const [showTest, setShowTest] = React.useState(false);
  const [testStatus, setTestStatus] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const handleSave = () => {
    onUpdate({ ...settings, dailyReportMethod: method, dailyReportPhone: phone, dailyReportChat: chatId });
  };

  const sendTestReport = async () => {
    setLoading(true); setTestStatus("Yuborilmoqda...");
    try {
      const res = await fetch("/api/daily-report", { method: "POST", headers: { "Content-Type": "application/json", "authorization": "Bearer test" } });
      const result = await res.json();
      if (res.ok) {
        if (method === "whatsapp" && result.sentWhatsApp) setTestStatus("OK - WhatsApp yuborildi!");
        else if (method === "telegram" && result.sentTelegram) setTestStatus("OK - Telegram yuborildi!");
        else setTestStatus("Hisobot yaratildi, lekin yuborilmadi (sozlamani tekshiring)");
      } else { setTestStatus("Xato: " + (result.error || "Noma'lum")); }
    } catch (e) { setTestStatus("Xato: " + e.message); }
    setLoading(false);
  };

  const isChanged = method !== (settings.dailyReportMethod || "") ||
                    phone !== (settings.dailyReportPhone || "") ||
                    chatId !== (settings.dailyReportChat || "");

  return (
    <Card title="Kunlik Sklad Hisoboti" pad={true}>
      <p style={{ fontSize: 13, color: T.muted, marginBottom: 12 }}>
        Har kuni 00:30 da sklad kirim/chiqim hisobotini avtomatik yuboradi.
      </p>
      <F label="Yuborish usuli">
        <div style={{ display: "flex", gap: 16 }}>
          {["whatsapp","telegram",""].map(v => (
            <label key={v} style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer" }}>
              <input type="radio" value={v} checked={method===v} onChange={e=>setMethod(e.target.value)} />
              <span>{v==="whatsapp"?"WhatsApp":v==="telegram"?"Telegram":"O'chirilgan"}</span>
            </label>
          ))}
        </div>
      </F>
      {method === "whatsapp" && (
        <F label="WhatsApp telefon (+998...)">
          <input type="tel" style={iSt} placeholder="+998901234567" value={phone} onChange={e=>setPhone(e.target.value)} />
        </F>
      )}
      {method === "telegram" && (
        <F label="Telegram Chat ID">
          <input type="text" style={iSt} placeholder="123456789" value={chatId} onChange={e=>setChatId(e.target.value)} />
        </F>
      )}
      <div style={{ display:"flex", gap:10, marginTop:14 }}>
        <SaveBtn onClick={handleSave} disabled={!isChanged} color={T.blue}>
          <Save size={14}/> Saqlash
        </SaveBtn>
        {(method==="whatsapp"||method==="telegram") && (
          <SaveBtn onClick={()=>setShowTest(p=>!p)} color={T.purple}>
            <RefreshCw size={14}/> Test
          </SaveBtn>
        )}
      </div>
      {showTest && (
        <div style={{ marginTop:12, padding:10, backgroundColor:"#f5f5f5", borderRadius:6, fontSize:13 }}>
          <div style={{ marginBottom:8 }}>{testStatus || "Test yuborish uchun bosing"}</div>
          <button onClick={sendTestReport} disabled={loading} style={{ padding:"6px 12px", backgroundColor:"#2196F3", color:"#fff", border:"none", borderRadius:4, cursor:"pointer", fontSize:12 }}>
            {loading ? "Yuborilmoqda..." : "Hozir yuborish"}
          </button>
        </div>
      )}
    </Card>
  );
}
// === KUNLIK HISOBOT OXIRI ===

'@

        # Append to file before last export/render line
        $newContent = $content + $component
        Set-Content -Path $appFile -Value $newContent -Encoding UTF8
        Write-OK "DailyReportSettings component qoshildi"

        Write-Host ""
        Write-Warn "MUHIM: AvtogazApp.jsx da Settings bolimini topib qoshng:"
        Write-Host '  {rahbar && <DailyReportSettings data={data} onUpdate={s => setData(p => ({...p, settings:s}))} />}' -ForegroundColor Yellow
    }
}

# --- 6. .env.local ---
Write-Step ".env.local tekshirilmoqda..."
$envFile = "$ProjectPath\.env.local"
if (Test-Path $envFile) {
    $envContent = Get-Content $envFile -Raw
    if ($envContent -notmatch "CRON_SECRET") {
        Add-Content -Path $envFile -Value "`r`n# Kunlik hisobot`r`nCRON_SECRET=your-secret-here`r`nTELEGRAM_BOT_TOKEN=`r`nTWILIO_ACCOUNT_SID=`r`nTWILIO_AUTH_TOKEN=`r`nTWILIO_WHATSAPP_FROM=wa:+998"
        Write-OK ".env.local ga CRON_SECRET qoshildi"
    } else {
        Write-Warn ".env.local da CRON_SECRET allaqachon bor"
    }
} else {
    Write-Warn ".env.local topilmadi - manual yarating"
}

# --- 7. Natija ---
Write-Host ""
Write-Host "=================================================" -ForegroundColor Green
Write-Host "  SETUP TUGALLANDI!                             " -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Keyingi qadamlar:" -ForegroundColor Cyan
Write-Host "  1. .env.local da CRON_SECRET ni to'ldiring"
Write-Host "  2. WhatsApp (TWILIO_*) yoki Telegram (TELEGRAM_BOT_TOKEN) sozlang"
Write-Host "  3. AvtogazApp.jsx da Settings bolimiga DailyReportSettings qo'shing"
Write-Host "  4. git add . && git commit -m 'feat: daily report v60' && git push"
Write-Host ""
Write-Host "Backup fayl: app\AvtogazApp.jsx.backup" -ForegroundColor Yellow
Write-Host ""
