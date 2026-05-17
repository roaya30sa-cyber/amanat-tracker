# =====================================================================
# deploy.ps1 - Cloudflare Pages + D1 deployment for amanat-tracker
# Run:  powershell -ExecutionPolicy Bypass -File .\deploy.ps1
# Optional: -ProjectName custom-name -DbName custom-db -SkipLogin
# =====================================================================

param(
    [string]$ProjectName = "amanat-tracker",
    [string]$DbName      = "projects-tracker",
    [switch]$SkipLogin   = $false
)

$ErrorActionPreference = 'Continue'
$PSNativeCommandUseErrorActionPreference = $false
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Force UTF-8 output so any console writes don't break
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

function Write-Section($title) {
    Write-Host ""
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host " $title" -ForegroundColor Cyan
    Write-Host "================================================================" -ForegroundColor Cyan
}
function Write-Step($n, $msg) { Write-Host "`n[$n] $msg" -ForegroundColor Yellow }
function Write-Ok($msg)        { Write-Host "  [OK]   $msg" -ForegroundColor Green }
function Write-Warn2($msg)     { Write-Host "  [WARN] $msg" -ForegroundColor Yellow }
function Write-Fail($msg)      { Write-Host "  [FAIL] $msg" -ForegroundColor Red; exit 1 }
function Write-Info($msg)      { Write-Host "  [INFO] $msg" -ForegroundColor Cyan }

Write-Section "Deploying amanat-tracker to Cloudflare Pages + D1"
Write-Info "Project name : $ProjectName"
Write-Info "D1 database  : $DbName"

# ---------------------------------------------------------------------
# [1] Prerequisites
# ---------------------------------------------------------------------
Write-Step 1 "Checking prerequisites..."
try { $nodeV = (node --version) } catch { Write-Fail "Node.js not installed. Get it from https://nodejs.org (v20+)" }
$nodeMajor = [int]($nodeV -replace 'v(\d+)\..*','$1')
if ($nodeMajor -lt 18) { Write-Fail "Node.js $nodeV is too old. Need v18 or higher." }
Write-Ok "Node.js $nodeV"

try { $npmV = (npm --version) } catch { Write-Fail "npm not available" }
Write-Ok "npm $npmV"

# ---------------------------------------------------------------------
# [2] Install dependencies
# ---------------------------------------------------------------------
Write-Step 2 "Installing dependencies..."
if (-not (Test-Path "node_modules")) {
    npm install
    if ($LASTEXITCODE -ne 0) { Write-Fail "npm install failed" }
}
Write-Ok "All packages installed"

# ---------------------------------------------------------------------
# [3] Cloudflare login
# ---------------------------------------------------------------------
Write-Step 3 "Logging in to Cloudflare..."
if (-not $SkipLogin) {
    Write-Info "Browser will open for authorization. Approve then return here."
    npx wrangler login
    if ($LASTEXITCODE -ne 0) { Write-Fail "Cloudflare login failed" }
}
$whoami = (npx wrangler whoami 2>&1 | Out-String)
if ($whoami -match "logged in") {
    Write-Ok "Connected to Cloudflare"
} else {
    Write-Warn2 "Could not verify login - continuing anyway"
}

# ---------------------------------------------------------------------
# [4] D1 database - create or reuse
# ---------------------------------------------------------------------
Write-Step 4 "Setting up D1 database '$DbName'..."

$dbList = (npx wrangler d1 list 2>&1 | Out-String)
$dbId = $null

# Pattern as separate variable to avoid PowerShell parsing of {N} inside strings
$uuidPattern = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}'
$searchPattern = [regex]::Escape($DbName) + '.*?(' + $uuidPattern + ')'

if ($dbList -match $searchPattern) {
    $dbId = $Matches[1]
    Write-Info "Found existing database with same name"
    Write-Ok "database_id = $dbId"
} else {
    Write-Info "Creating new D1 database..."
    $createOutput = (npx wrangler d1 create $DbName 2>&1 | Out-String)
    Write-Host $createOutput
    $idMatch = [regex]::Match($createOutput, 'database_id\s*=\s*"([^"]+)"')
    if (-not $idMatch.Success) {
        $idMatch = [regex]::Match($createOutput, '"uuid":\s*"(' + $uuidPattern + ')"')
    }
    if (-not $idMatch.Success) {
        $idMatch = [regex]::Match($createOutput, '(' + $uuidPattern + ')')
    }
    if (-not $idMatch.Success) { Write-Fail "Could not extract database_id from wrangler output" }
    $dbId = $idMatch.Groups[1].Value
    Write-Ok "Created D1 database with id = $dbId"
}

# ---------------------------------------------------------------------
# [5] Update wrangler.toml with database_id + project name
# ---------------------------------------------------------------------
Write-Step 5 "Updating wrangler.toml..."
$wrConfig = Get-Content "wrangler.toml" -Raw -Encoding UTF8
$wrConfig = $wrConfig -replace 'REPLACE_WITH_YOUR_D1_DATABASE_ID', $dbId
$wrConfig = $wrConfig -replace '(?m)^name\s*=\s*".*"', ('name = "' + $ProjectName + '"')
$wrConfig = $wrConfig -replace '(?m)^database_name\s*=\s*".*"', ('database_name = "' + $DbName + '"')
[System.IO.File]::WriteAllText((Join-Path $scriptDir "wrangler.toml"), $wrConfig, (New-Object System.Text.UTF8Encoding $false))
Write-Ok "wrangler.toml updated"

# ---------------------------------------------------------------------
# [6] Run migration on REMOTE D1
# ---------------------------------------------------------------------
Write-Step 6 "Running migration on remote D1..."
Write-Info "This will create all tables and seed 42 tasks + 30 risks + 5 users..."
npx wrangler d1 execute $DbName --remote --file=./migrations/0001_init.sql
if ($LASTEXITCODE -ne 0) {
    Write-Warn2 "Migration failed. If tables already exist, this is expected."
    $continue = Read-Host "Continue without re-running migration? (y/n)"
    if ($continue -ne 'y') { Write-Fail "Deployment cancelled" }
}

# Verify
$verifyOut = (npx wrangler d1 execute $DbName --remote --command "SELECT COUNT(*) AS n FROM tasks" --json 2>&1 | Out-String)
if ($verifyOut -match '"n":\s*42') {
    Write-Ok "Verified: 42 tasks in database"
} else {
    Write-Warn2 "Could not auto-verify data"
}

# ---------------------------------------------------------------------
# [7] Generate AUTH_SECRET
# ---------------------------------------------------------------------
Write-Step 7 "Setting up secrets..."
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$authSecret = [Convert]::ToBase64String($bytes)
Write-Ok "Generated AUTH_SECRET (will be saved as Cloudflare secret)"

# ---------------------------------------------------------------------
# [8] Build for Cloudflare Pages
# ---------------------------------------------------------------------
Write-Step 8 "Building app for Cloudflare Pages..."
Write-Info "This may take 1-2 minutes..."

# Create .env.local for the build
$envContent = "AUTH_SECRET=$authSecret`nNEXTAUTH_URL=http://localhost:3000`n"
[System.IO.File]::WriteAllText((Join-Path $scriptDir ".env.local"), $envContent, (New-Object System.Text.UTF8Encoding $false))

npx @cloudflare/next-on-pages
if ($LASTEXITCODE -ne 0) { Write-Fail "Build failed" }
if (-not (Test-Path ".vercel/output/static")) { Write-Fail "Output folder .vercel/output/static missing" }
Write-Ok "Build complete"

# ---------------------------------------------------------------------
# [9] Create Pages project if needed
# ---------------------------------------------------------------------
Write-Step 9 "Creating/verifying Pages project..."
$projectsList = (npx wrangler pages project list 2>&1 | Out-String)
if ($projectsList -match [regex]::Escape($ProjectName)) {
    Write-Ok "Project '$ProjectName' exists"
} else {
    Write-Info "Creating new Pages project..."
    npx wrangler pages project create $ProjectName --production-branch main
    if ($LASTEXITCODE -ne 0) {
        Write-Warn2 "Project creation failed - it may already exist - continuing"
    } else {
        Write-Ok "Project created"
    }
}

# ---------------------------------------------------------------------
# [10] Set secrets via wrangler
# ---------------------------------------------------------------------
Write-Step 10 "Setting secrets on Cloudflare Pages..."
Write-Info "AUTH_SECRET will be piped to wrangler..."

# Pipe via PowerShell - cross-version compatible
$authSecret | npx wrangler pages secret put AUTH_SECRET --project-name $ProjectName
if ($LASTEXITCODE -eq 0) {
    Write-Ok "AUTH_SECRET set"
} else {
    Write-Warn2 "AUTH_SECRET setting failed - set it manually from Dashboard"
    Write-Warn2 "Value: $authSecret"
}

# ---------------------------------------------------------------------
# [11] Deploy
# ---------------------------------------------------------------------
Write-Step 11 "Deploying app to Cloudflare Pages..."
$deployOutput = (npx wrangler pages deploy .vercel/output/static --project-name $ProjectName --commit-dirty=true 2>&1 | Out-String)
Write-Host $deployOutput

# Extract URL
$urlMatch = [regex]::Match($deployOutput, 'https://[a-z0-9-]+\.pages\.dev')
if ($urlMatch.Success) {
    $deployUrl = $urlMatch.Value
    Write-Ok "Deployed successfully!"
} else {
    Write-Warn2 "Could not extract URL - check output above"
    $deployUrl = "https://$ProjectName.pages.dev"
}

# ---------------------------------------------------------------------
# [12] Final instructions
# ---------------------------------------------------------------------
Write-Section "DEPLOYMENT COMPLETE!"
Write-Host ""
Write-Host " App URL:" -ForegroundColor Green
Write-Host "      $deployUrl" -ForegroundColor White
Write-Host ""
Write-Host " IMPORTANT MANUAL STEPS:" -ForegroundColor Yellow
Write-Host ""
Write-Host " [A] Bind D1 database to Pages project:" -ForegroundColor Cyan
Write-Host "     1. Go to: https://dash.cloudflare.com -> Workers & Pages -> $ProjectName"
Write-Host "     2. Settings -> Functions -> D1 database bindings -> Add binding"
Write-Host "     3. Variable name: DB"
Write-Host "     4. D1 database: $DbName"
Write-Host "     5. Save"
Write-Host ""
Write-Host " [B] Set NEXTAUTH_URL to the actual URL:" -ForegroundColor Cyan
Write-Host "     1. Same page -> Settings -> Environment Variables"
Write-Host "     2. Add Production variable:"
Write-Host "        NEXTAUTH_URL = $deployUrl"
Write-Host "     3. Save -> then Redeploy from Deployments"
Write-Host ""
Write-Host " [C] Open the app and log in:" -ForegroundColor Cyan
Write-Host "     Username: admin"
Write-Host "     Password: Amanat@2026"
Write-Host "     IMPORTANT: You will be forced to change password - do it immediately!"
Write-Host ""
Write-Section "DONE!"

# Save deployment info
$infoContent = @"
# Deployment Info

- Project name: $ProjectName
- D1 database: $DbName ($dbId)
- Deployment URL: $deployUrl
- Deployed at: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
- AUTH_SECRET: (saved as Cloudflare Pages secret)

## Next steps (manual)
1. Bind D1 database to Pages project (see deploy script output)
2. Set NEXTAUTH_URL = $deployUrl in Pages env vars
3. Redeploy after env var change
4. Login as admin / Amanat@2026 and change password

## Useful commands
- Re-deploy: npm run pages:deploy
- View logs: npx wrangler pages deployment tail --project-name $ProjectName
- Query DB:  npx wrangler d1 execute $DbName --remote --command "SELECT * FROM users"
"@
[System.IO.File]::WriteAllText((Join-Path $scriptDir "DEPLOYMENT_INFO.md"), $infoContent, (New-Object System.Text.UTF8Encoding $false))

Write-Host " Deployment info saved to DEPLOYMENT_INFO.md" -ForegroundColor Gray
Write-Host ""
