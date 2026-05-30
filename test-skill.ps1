$ErrorActionPreference = 'Stop'
$baseUrl = 'http://127.0.0.1:10087'

# Step 1: Read API key
$authFile = 'D:\GangNiaga-WebBridge\daemon\.webbridge-auth.json'
$apiKey = (Get-Content $authFile -Raw | ConvertFrom-Json).apiKey
Write-Host "API Key: $($apiKey.Substring(0,20))..." -ForegroundColor Green

$headers = @{
    'Authorization' = "Bearer ***"
    'x-gangniaga-token' = $apiKey
    'Content-Type' = 'application/json'
}

# Step 2: Status
Write-Host "`n=== Step 1: /status ===" -ForegroundColor Cyan
$r = Invoke-RestMethod -Uri "$baseUrl/status" -Method GET
$r | ConvertTo-Json -Depth 3

# Step 3: /sites
Write-Host "`n=== Step 2: /sites ===" -ForegroundColor Cyan
$r = Invoke-RestMethod -Uri "$baseUrl/sites" -Method GET -Headers $headers
$r | ConvertTo-Json -Depth 3

# Step 4: /sites/shopee.com.my
Write-Host "`n=== Step 3: /sites/shopee.com.my ===" -ForegroundColor Cyan
$r = Invoke-RestMethod -Uri "$baseUrl/sites/shopee.com.my" -Method GET -Headers $headers
Write-Host "Domain: $($r.domain)"
Write-Host "YAML:"
Write-Host $r.yaml

# Step 5: list_tabs
Write-Host "`n=== Step 4: list_tabs ===" -ForegroundColor Cyan
try {
    $body = @{action='list_tabs'; args=@{}} | ConvertTo-Json -Depth 3
    $r = Invoke-RestMethod -Uri "$baseUrl/command" -Method POST -Headers $headers -Body $body
    $r | ConvertTo-Json -Depth 3
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

# Step 6: os_screenshot
Write-Host "`n=== Step 5: os_screenshot ===" -ForegroundColor Cyan
try {
    $body = @{action='os_screenshot'; args=@{path='D:/test_skill.png'}} | ConvertTo-Json -Depth 3
    $r = Invoke-RestMethod -Uri "$baseUrl/command" -Method POST -Headers $headers -Body $body
    $r | ConvertTo-Json -Depth 3
    if (Test-Path 'D:/test_skill.png') {
        Write-Host "Screenshot saved: $((Get-Item 'D:/test_skill.png').Length) bytes" -ForegroundColor Green
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

# Step 7: hotkey Ctrl+T
Write-Host "`n=== Step 6: hotkey Ctrl+T ===" -ForegroundColor Cyan
try {
    $body = @{action='hotkey'; args=@{keys=@('ctrl','t')}} | ConvertTo-Json -Depth 3
    $r = Invoke-RestMethod -Uri "$baseUrl/command" -Method POST -Headers $headers -Body $body
    $r | ConvertTo-Json -Depth 3
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

# Step 8: navigate to Google
Write-Host "`n=== Step 7: navigate to Google ===" -ForegroundColor Cyan
try {
    $body = @{action='navigate'; args=@{url='https://www.google.com'; newTab=$true}} | ConvertTo-Json -Depth 3
    $r = Invoke-RestMethod -Uri "$baseUrl/command" -Method POST -Headers $headers -Body $body
    $r | ConvertTo-Json -Depth 3
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

# Step 9: snapshot
Write-Host "`n=== Step 8: snapshot ===" -ForegroundColor Cyan
Start-Sleep -Seconds 3
try {
    $body = @{action='snapshot'; args=@{}} | ConvertTo-Json -Depth 3
    $r = Invoke-RestMethod -Uri "$baseUrl/command" -Method POST -Headers $headers -Body $body
    if ($r.data) {
        Write-Host "URL: $($r.data.url)"
        Write-Host "Title: $($r.data.title)"
        $tree = $r.data.tree
        if ($tree) {
            Write-Host "Tree nodes: $($tree.Count)"
        }
    } else {
        $r | ConvertTo-Json -Depth 3
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host "`n=== TEST COMPLETE ===" -ForegroundColor Green
