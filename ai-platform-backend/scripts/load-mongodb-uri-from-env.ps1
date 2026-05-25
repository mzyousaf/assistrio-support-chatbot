# Loads MONGODB_URI from ai-platform-backend/.env into the current process.
$envFile = Join-Path $PSScriptRoot '..' | Join-Path -ChildPath '.env'
if (-not (Test-Path $envFile)) {
  Write-Error ".env not found at $envFile"
  exit 1
}
$line = Get-Content $envFile | Where-Object { $_ -match '^\s*MONGODB_URI\s*=' } | Select-Object -First 1
if (-not $line) {
  Write-Error 'MONGODB_URI not found in .env'
  exit 1
}
$value = $line -replace '^\s*MONGODB_URI\s*=\s*', ''
$value = $value.Trim().Trim('"').Trim("'")
$env:MONGODB_URI = $value
