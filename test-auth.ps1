$ErrorActionPreference = 'Continue'
$baseUrl = 'http://127.0.0.1:10087'

# Read API key
$authFile = 'D:\GangNiaga-WebBridge\daemon\.webbridge-auth.json'
$apiKey = (Get-Content $authFile -Raw | ConvertFrom-Json).apiKey
Write-Host "API Key: $($apiKey.Substring(0,20))..." -ForegroundColor Green

# Test different auth methods
Write-Host "`n=== TEST 1: Bearer only ===" -ForegroundColor Cyan
try {
    $headers = @{ 'Authorization' = "Bearer ***" }
    $r = Invoke-RestMethod -Uri "$baseUrl/sites" -Method GET -Headers $headers
    $r | ConvertTo-Json -Depth 3
} catch {
    Write-Host "FAIL: $_" -ForegroundColor Red
}

Write-Host "`n=== TEST 2: x-gangniaga-token only ===" -ForegroundColor Cyan
try {
    $headers = @{ 'x-gangniaga-token' = $apiKey }
    $r = Invoke-RestMethod -Uri "$baseUrl/sites" -Method GET -Headers $headers
    $r | ConvertTo-Json -Depth 3
} catch {
    Write-Host "FAIL: $_" -ForegroundColor Red
}

Write-Host "`n=== TEST 3: Both headers ===" -ForegroundColor Cyan
try {
    $headers = @{ 'Authorization' = "Bearer ***"; 'x-gangniaga-token' = $apiKey }
    $r = Invoke-RestMethod -Uri "$baseUrl/sites" -Method GET -Headers $headers
    $r | ConvertTo-Json -Depth 3
} catch {
    Write-Host "FAIL: $_" -ForegroundColor Red
}

Write-Host "`n=== TEST 4: Bearer with 'Token' prefix ===" -ForegroundColor Cyan
try {
    $headers = @{ 'Authorization' = "Token ***" }
    $r = Invoke-RestMethod -Uri "$baseUrl/sites" -Method GET -Headers $headers
    $r | ConvertTo-Json -Depth 3
} catch {
    Write-Host "FAIL: $_" -ForegroundColor Red
}

Write-Host "`n=== TEST 5: Basic Auth ===" -ForegroundColor Cyan
try {
    $cred = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("`:$apiKey"))
    $headers = @{ 'Authorization' = "Basic $cred" }
    $r = Invoke-RestMethod -Uri "$baseUrl/sites" -Method GET -Headers $headers
    $r | ConvertTo-Json -Depth 3
} catch {
    Write-Host "FAIL: $_" -ForegroundColor Red
}

# Check how daemon v2 reads the auth
Write-Host "`n=== Checking daemon auth code ===" -ForegroundColor Cyan
$daemonCode = Get-Content 'D:\GangNiaga-WebBridge\daemon\gangniaga-daemon.js' -Raw
# Find the auth check section
$authSection = [regex]::Match($daemonCode, 'Authenticate incoming request.*?return.*?}', [System.Text.RegularExpressions.RegexOptions]::Singleline)
if ($authSection.Success) {
    Write-Host "Auth code section:"
    Write-Host $authSection.Value.Substring(0, [Math]::Min(500, $authSection.Value.Length))
} else {
    # Try to find the auth pattern
    $lines = $daemonCode -split "`n"
    $authLines = $lines | Select-String -Pattern 'auth|token|Bearer|Authorization|401' | Select-Object -First 10
    $authLines | ForEach-Object { Write-Host $_.Line }
}
