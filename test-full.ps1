$ErrorActionPreference = 'Continue'
$baseUrl = 'http://127.0.0.1:10087'

# Read API key
$authFile = 'D:\GangNiaga-WebBridge\daemon\.webbridge-auth.json'
$apiKey = (Get-Content $authFile -Raw | ConvertFrom-Json).apiKey
Write-Host "API Key: $apiKey" -ForegroundColor Green
Write-Host ""

# Correct auth: "Bearer <apiKey>" — substring(7) skips "Bearer " (7 chars)
$authHeader = "Bearer $apiKey"
Write-Host "Auth Header: $authHeader"
Write-Host ""

$headers = @{ 'Authorization' = $authHeader }

# Test 1: /sites
Write-Host "=== TEST 1: /sites ===" -ForegroundColor Cyan
try {
    $r = Invoke-RestMethod -Uri "$baseUrl/sites" -Method GET -Headers $headers
    $r | ConvertTo-Json -Depth 3
    Write-Host "PASS" -ForegroundColor Green
} catch {
    Write-Host "FAIL: $_" -ForegroundColor Red
}

# Test 2: /sites/shopee.com.my
Write-Host "`n=== TEST 2: /sites/shopee.com.my ===" -ForegroundColor Cyan
try {
    $r = Invoke-RestMethod -Uri "$baseUrl/sites/shopee.com.my" -Method GET -Headers $headers
    Write-Host "Domain: $($r.domain)"
    Write-Host "YAML: $($r.yaml)"
    Write-Host "PASS" -ForegroundColor Green
} catch {
    Write-Host "FAIL: $_" -ForegroundColor Red
}

# Test 3: list_tabs
Write-Host "`n=== TEST 3: list_tabs ===" -ForegroundColor Cyan
try {
    $body = @{action='list_tabs'; args=@{}} | ConvertTo-Json
    $r = Invoke-RestMethod -Uri "$baseUrl/command" -Method POST -Headers ($headers + @{'Content-Type'='application/json'}) -Body $body
    $r | ConvertTo-Json -Depth 5
    Write-Host "PASS" -ForegroundColor Green
} catch {
    Write-Host "FAIL: $_" -ForegroundColor Red
}

# Test 4: os_screenshot
Write-Host "`n=== TEST 4: os_screenshot ===" -ForegroundColor Cyan
try {
    $body = @{action='os_screenshot'; args=@{path='D:/test_skill.png'}} | ConvertTo-Json
    $r = Invoke-RestMethod -Uri "$baseUrl/command" -Method POST -Headers ($headers + @{'Content-Type'='application/json'}) -Body $body
    $r | ConvertTo-Json -Depth 3
    if (Test-Path 'D:/test_skill.png') {
        Write-Host "Screenshot saved: $((Get-Item 'D:/test_skill.png').Length) bytes" -ForegroundColor Green
    }
    Write-Host "PASS" -ForegroundColor Green
} catch {
    Write-Host "FAIL: $_" -ForegroundColor Red
}

# Test 5: navigate
Write-Host "`n=== TEST 5: navigate to Google ===" -ForegroundColor Cyan
try {
    $body = @{action='navigate'; args=@{url='https://www.google.com'; newTab=$true}} | ConvertTo-Json
    $r = Invoke-RestMethod -Uri "$baseUrl/command" -Method POST -Headers ($headers + @{'Content-Type'='application/json'}) -Body $body
    $r | ConvertTo-Json -Depth 3
    Write-Host "PASS" -ForegroundColor Green
} catch {
    Write-Host "FAIL: $_" -ForegroundColor Red
}

# Test 6: snapshot
Write-Host "`n=== TEST 6: snapshot ===" -ForegroundColor Cyan
Start-Sleep -Seconds 3
try {
    $body = @{action='snapshot'; args=@{}} | ConvertTo-Json
    $r = Invoke-RestMethod -Uri "$baseUrl/command" -Method POST -Headers ($headers + @{'Content-Type'='application/json'}) -Body $body
    if ($r.data) {
        Write-Host "URL: $($r.data.url)"
        Write-Host "Title: $($r.data.title)"
    } else {
        $r | ConvertTo-Json -Depth 3
    }
    Write-Host "PASS" -ForegroundColor Green
} catch {
    Write-Host "FAIL: $_" -ForegroundColor Red
}

Write-Host "`n=== ALL TESTS DONE ===" -ForegroundColor Green
