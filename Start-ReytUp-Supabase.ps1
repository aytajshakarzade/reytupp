# ReytUp 4.2 — secure temporary Supabase launcher for Windows PowerShell.
# Does not create, read, overwrite, or modify .env. The connection string exists only in this process tree.
$ErrorActionPreference = 'Stop'
$ProjectRef = 'weodeywbbvehgpigneto'
$PoolerHost = 'aws-0-eu-west-1.pooler.supabase.com'
$PoolerPort = 5432
$Database = 'postgres'
$DbUser = "postgres.$ProjectRef"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js tapılmadı. Node.js 22.5 və ya daha yeni versiyanı quraşdırın.'
}
$nodeVersionText = (& node --version).Trim().TrimStart('v')
try { $nodeVersion = [version]$nodeVersionText } catch { throw "Node.js versiyası oxunmadı: $nodeVersionText" }
if ($nodeVersion -lt [version]'22.5') {
    throw "ReytUp üçün Node.js 22.5+ lazımdır. Hazırkı versiya: $nodeVersionText"
}

$projectDir = $PSScriptRoot
if (-not (Test-Path (Join-Path $projectDir 'server.js'))) {
    throw 'server.js tapılmadı. Skript ReytUp layihəsinin əsas qovluğunda olmalıdır.'
}

Write-Host ''
Write-Host '  REYTUP 4.2  |  SUPABASE SECURE START' -ForegroundColor Cyan
Write-Host '  ------------------------------------' -ForegroundColor DarkCyan
Write-Host '  .env faylına toxunulmur.' -ForegroundColor Green
Write-Host '  SMTP və digər API parametrləri dəyişdirilmir.' -ForegroundColor Green
Write-Host '  Database şifrəsi fayla yazılmır.' -ForegroundColor Green
Write-Host ''
Write-Host "  Host: $PoolerHost`:$PoolerPort" -ForegroundColor Gray
Write-Host "  User: $DbUser" -ForegroundColor Gray
Write-Host '  Database: postgres' -ForegroundColor Gray
Write-Host ''

$securePassword = Read-Host 'Supabase Database Password (gizli daxil et)' -AsSecureString
if ($null -eq $securePassword -or $securePassword.Length -eq 0) {
    throw 'Database password boş ola bilməz.'
}

$bstr = [IntPtr]::Zero
$plainPassword = $null
$encodedPassword = $null
$hadOldDatabaseUrl = Test-Path Env:DATABASE_URL
$oldDatabaseUrl = $env:DATABASE_URL
$exitCode = 1
try {
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    $encodedPassword = [Uri]::EscapeDataString($plainPassword)
    $env:DATABASE_URL = "postgresql://${DbUser}:${encodedPassword}@${PoolerHost}:${PoolerPort}/${Database}"

    Push-Location $projectDir
    try {
        Write-Host ''
        Write-Host 'Supabase bağlantısı yoxlanılır və ReytUp başladılır...' -ForegroundColor Cyan
        & node (Join-Path $projectDir 'server.js')
        if ($null -ne $LASTEXITCODE) { $exitCode = $LASTEXITCODE } else { $exitCode = 0 }
    }
    finally { Pop-Location }
}
finally {
    if ($hadOldDatabaseUrl) { $env:DATABASE_URL = $oldDatabaseUrl }
    else { Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue }
    if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    $plainPassword = $null
    $encodedPassword = $null
    $securePassword.Dispose()
}
exit $exitCode
