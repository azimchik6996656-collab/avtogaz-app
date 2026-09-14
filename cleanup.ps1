$files = @(
    "patch_check.py","patch_check2.py","patch_check3.py","patch_check4.py",
    "patch_check5.py","patch_check6.py","patch_check7.py","patch_v62_stocklog.py",
    "patch-v61.ps1","patch_v61.py",
    "stockout.txt","worktime_output.txt","worktime2.txt","wh.txt","h",
    "AvtogazApp-togri.zip",
    "app\AvtogazApp.jsx.v60backup","app\AvtogazApp.jsx.v61backup"
)

foreach ($f in $files) {
    if (Test-Path $f) {
        git rm --cached "$f" -q 2>$null
        Remove-Item $f -Force -ErrorAction SilentlyContinue
        Write-Host "[OK] Ochirildi: $f" -ForegroundColor Green
    }
}

# .gitignore ga qo'shish
$gitignoreAdd = @"

# Debug / patch fayllari (repo'da kerak emas)
patch_*.py
patch-*.ps1
*.v60backup
*.v61backup
*.backup
*.txt
"@

if (Test-Path ".gitignore") {
    Add-Content -Path ".gitignore" -Value $gitignoreAdd
} else {
    Set-Content -Path ".gitignore" -Value $gitignoreAdd
}

Write-Host ""
Write-Host "[OK] .gitignore yangilandi" -ForegroundColor Green
Write-Host ""
Write-Host "Endi commit qiling:"
Write-Host "  git add ."
Write-Host "  git commit -m 'chore: tozalash - debug fayllarni olib tashlash'"
Write-Host "  git push"
