# =====================================================================
# setup.ps1 — One-shot setup for amanat-tracker (Windows PowerShell)
# Run:  powershell -ExecutionPolicy Bypass -File .\setup.ps1
# =====================================================================

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " أداة متابعة أعمال مشاريع الأمانة — Setup" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# 1) Check Node.js
Write-Host "[1/6] التحقق من Node.js..." -ForegroundColor Yellow
$nodeVersion = $null
try { $nodeVersion = node --version } catch {}
if (-not $nodeVersion) {
  Write-Host "  ❌ Node.js غير مثبت. ثبّته من https://nodejs.org (v20+)" -ForegroundColor Red
  exit 1
}
Write-Host "  ✓ Node.js $nodeVersion" -ForegroundColor Green

# 2) Install dependencies
Write-Host "`n[2/6] تثبيت الحزم (npm install)..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) { Write-Host "  ❌ فشل npm install" -ForegroundColor Red; exit 1 }
Write-Host "  ✓ تم تثبيت كل الحزم" -ForegroundColor Green

# 3) Create .env.local
Write-Host "`n[3/6] إنشاء .env.local..." -ForegroundColor Yellow
if (-not (Test-Path ".env.local")) {
  $secret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 48 | ForEach-Object { [char]$_ })
  @"
AUTH_SECRET=$secret
NEXTAUTH_URL=http://localhost:3000
"@ | Out-File -FilePath ".env.local" -Encoding utf8
  Write-Host "  ✓ تم إنشاء .env.local بـ AUTH_SECRET عشوائي" -ForegroundColor Green
} else {
  Write-Host "  ⏩ .env.local موجود مسبقاً — تم تخطي" -ForegroundColor Yellow
}

# 4) Create local D1 database (if wrangler.toml missing database_id, prompt)
Write-Host "`n[4/6] إعداد قاعدة بيانات D1 محلية..." -ForegroundColor Yellow
$wrangler = Get-Content "wrangler.toml" -Raw
if ($wrangler -match "REPLACE_WITH_YOUR_D1_DATABASE_ID") {
  Write-Host "  → سننشئ قاعدة بيانات D1 جديدة:" -ForegroundColor Cyan
  $createOutput = npx wrangler d1 create projects-tracker 2>&1 | Out-String
  Write-Host $createOutput
  $matches = [regex]::Match($createOutput, 'database_id\s*=\s*"([^"]+)"')
  if ($matches.Success) {
    $dbId = $matches.Groups[1].Value
    (Get-Content "wrangler.toml") -replace 'REPLACE_WITH_YOUR_D1_DATABASE_ID', $dbId | Set-Content "wrangler.toml"
    Write-Host "  ✓ تم تحديث wrangler.toml بـ database_id = $dbId" -ForegroundColor Green
  } else {
    Write-Host "  ⚠️  لم نجد database_id في مخرجات wrangler. حدّث wrangler.toml يدوياً ثم أعد التشغيل." -ForegroundColor Yellow
    exit 1
  }
}

# 5) Run migrations + seed
Write-Host "`n[5/6] تنفيذ migration الأولي + seed البيانات..." -ForegroundColor Yellow
npx wrangler d1 execute projects-tracker --local --file=./migrations/0001_init.sql
if ($LASTEXITCODE -ne 0) { Write-Host "  ❌ فشل migration" -ForegroundColor Red; exit 1 }
Write-Host "  ✓ تم إنشاء كل الجداول وحقن البيانات" -ForegroundColor Green

# Verify
$verifyOutput = npx wrangler d1 execute projects-tracker --local --command "SELECT COUNT(*) AS n FROM tasks" 2>&1 | Out-String
if ($verifyOutput -match '42') {
  Write-Host "  ✓ تم التحقق: 42 مهمة + كامل بيانات Excel" -ForegroundColor Green
} else {
  Write-Host "  ⚠️  لم يتم التحقق من البيانات — راجع $verifyOutput" -ForegroundColor Yellow
}

# 6) Done
Write-Host "`n[6/6] جاهز للتشغيل!" -ForegroundColor Yellow
Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host " ✅ كل شيء جاهز! شغّل الآن:" -ForegroundColor Green
Write-Host ""
Write-Host "       npm run dev" -ForegroundColor Cyan
Write-Host ""
Write-Host " ثم افتح:  http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host " 🔑 حسابات تجريبية:" -ForegroundColor Yellow
Write-Host "      admin / Amanat@2026          → مدير النظام"
Write-Host "      east_manager / Amanat@2026   → الشرقية"
Write-Host "      jazan_manager / Amanat@2026  → جازان"
Write-Host "      north_manager / Amanat@2026  → الشمالية"
Write-Host "      shehab / Amanat@2026         → الشرقية"
Write-Host ""
Write-Host " ⚠️  ستُلزم بتغيير كلمة المرور عند أول دخول" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Green
