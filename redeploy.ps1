# =====================================================================
# redeploy.ps1 — إعادة نشر سريعة بعد التعديلات
# =====================================================================
param([string]$ProjectName = "amanat-tracker")

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host "`n🔄 إعادة نشر $ProjectName...`n" -ForegroundColor Cyan

Write-Host "[1/2] بناء..." -ForegroundColor Yellow
npx @cloudflare/next-on-pages
if ($LASTEXITCODE -ne 0) { Write-Host "❌ فشل البناء" -ForegroundColor Red; exit 1 }

Write-Host "`n[2/2] نشر..." -ForegroundColor Yellow
npx wrangler pages deploy .vercel/output/static --project-name $ProjectName --commit-dirty=true

Write-Host "`n✅ تم!" -ForegroundColor Green
