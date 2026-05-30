#Requires -Version 5.1
<#
.SYNOPSIS
    GangNiaga WebBridge Unified Test Suite v2.0
.DESCRIPTION
    Comprehensive test for daemon, auth, sites KB, OS commands, and browser DOM.
    Run from Windows PowerShell: powershell -ExecutionPolicy Bypass -File test-webbridge.ps1
#>

$ErrorActionPreference = 'Continue'
$baseUrl = 'http://127.0.0.1:10087'
$authFile = 'D:\GangNiaga-WebBridge\daemon\.webbridge-auth.json'
$testResults = @()

function Write-TestHeader($name) { Write-Host "`n=== $name ===" -ForegroundColor Cyan }
function Write-Pass($msg) { Write-Host "  PASS: $msg" -ForegroundColor Green; $script:testResults += @{ Name = $msg; Result = 'PASS' } }
function Write-Fail($msg) { Write-Host "  FAIL: $msg" -ForegroundColor Red; $script:testResults += @{ Name = $msg; Result = 'FAIL' } }
function Write-Warn($msg) { Write-Host "  WARN: $msg" -ForegroundColor Yellow }

# Read API key
if (Test-Path $authFile) {
    $apiKey = (Get-Content $authFile -Raw | ConvertFrom-Json).apiKey
    Write-Host "API Key loaded: $($apiKey.Substring(0,16))..." -ForegroundColor Green
} else {
    Write-Host "No auth file found. Daemon will generate one on first run." -ForegroundColor Yellow
    $apiKey = $null
}
$headers = @{ 'Content-Type' = 'application/json' }
if ($apiKey) { $headers['Authorization'] = "Bearer $apiKey" }

# ─── TEST 1: Daemon Status ───────────────────────────────────────────────
Write-TestHeader "TEST 1: Daemon Status"
try {
    $r = Invoke-RestMethod -Uri "$baseUrl/status" -Method GET -TimeoutSec 5
    $r | ConvertTo-Json -Depth 3
    if ($r.ok) { Write-Pass "Daemon running (v$($r.version))" } else { Write-Fail "Daemon not OK" }
    $extConnected = $r.extension_connected
    Write-Host "  Extension connected: $extConnected" -ForegroundColor $(if($extConnected){"Green"}else{"Yellow"})
} catch {
    Write-Fail "Daemon not responding: $_"
    Write-Host "`nStart daemon first: cd D:\GangNiaga-WebBridge && npm run daemon" -ForegroundColor Yellow
    exit 1
}

# ─── TEST 2: Sites Knowledge Base ────────────────────────────────────────
Write-TestHeader "TEST 2: Sites Knowledge Base"
try {
    $r = Invoke-RestMethod -Uri "$baseUrl/sites" -Method GET -Headers $headers
    Write-Pass "Sites list: $($r.domains -join ', ')"
} catch {
    Write-Fail "Sites list: $_"
}

# ─── TEST 3: Shopee Selectors ────────────────────────────────────────────
Write-TestHeader "TEST 3: Shopee Selectors"
try {
    $r = Invoke-RestMethod -Uri "$baseUrl/sites/shopee.com.my" -Method GET -Headers $headers
    if ($r.ok) {
        Write-Pass "Shopee YAML loaded"
        $r.yaml -split "`n" | ForEach-Object { Write-Host "  $_" }
    } else {
        Write-Fail "Shopee YAML: $($r.error)"
    }
} catch {
    Write-Fail "Shopee YAML: $_"
}

# ─── TEST 4: OS Screenshot ───────────────────────────────────────────────
Write-TestHeader "TEST 4: OS Screenshot"
try {
    $body = @{ action = 'os_screenshot'; args = @{ path = 'D:\wb_test.png' } } | ConvertTo-Json
    $r = Invoke-RestMethod -Uri "$baseUrl/command" -Method POST -Headers $headers -Body $body
    if (Test-Path 'D:\wb_test.png') {
        $size = (Get-Item 'D:\wb_test.png').Length
        Write-Pass "Screenshot saved ($size bytes)"
        Remove-Item 'D:\wb_test.png' -Force
    } else {
        Write-Fail "Screenshot file not found"
    }
} catch {
    Write-Fail "Screenshot: $_"
}

# ─── TEST 5: Hotkey ──────────────────────────────────────────────────────
Write-TestHeader "TEST 5: Hotkey (Ctrl+T)"
try {
    $body = @{ action = 'hotkey'; args = @{ keys = @('ctrl', 't') } } | ConvertTo-Json
    $r = Invoke-RestMethod -Uri "$baseUrl/command" -Method POST -Headers $headers -Body $body
    Write-Pass "Hotkey sent"
} catch {
    Write-Fail "Hotkey: $_"
}

# ─── TEST 6: list_tabs ───────────────────────────────────────────────────
Write-TestHeader "TEST 6: list_tabs"
try {
    $body = @{ action = 'list_tabs'; args = @{} } | ConvertTo-Json
    $r = Invoke-RestMethod -Uri "$baseUrl/command" -Method POST -Headers $headers -Body $body
    if ($r.success) {
        Write-Pass "Tabs found: $($r.data.Count)"
        $r.data | Select-Object -First 5 | ForEach-Object {
            Write-Host "  Title: $($_.title) | URL: $($_.url)" -ForegroundColor Gray
        }
    } else {
        Write-Fail "list_tabs: $($r.error)"
    }
} catch {
    Write-Fail "list_tabs: $_"
}

# ─── TEST 7: Navigate (requires extension) ───────────────────────────────
Write-TestHeader "TEST 7: Navigate to Google"
if (-not $extConnected) {
    Write-Warn "Extension not connected — skipping browser DOM tests"
} else {
    try {
        $body = @{ action = 'navigate'; args = @{ url = 'https://www.google.com'; newTab = $true } } | ConvertTo-Json
        $r = Invoke-RestMethod -Uri "$baseUrl/command" -Method POST -Headers $headers -Body $body
        if ($r.success) { Write-Pass "Navigate to Google (tab $($r.tabId))" } else { Write-Fail "Navigate: $($r.error)" }
    } catch {
        Write-Fail "Navigate: $_"
    }

    # ─── TEST 8: Snapshot ─────────────────────────────────────────────────
    Write-TestHeader "TEST 8: Snapshot"
    Start-Sleep -Seconds 3
    try {
        $body = @{ action = 'snapshot'; args = @{} } | ConvertTo-Json
        $r = Invoke-RestMethod -Uri "$baseUrl/command" -Method POST -Headers $headers -Body $body
        if ($r.data) {
            Write-Pass "Snapshot: $($r.data.title) ($($r.data.url))"
        } else {
            Write-Fail "Snapshot: no data returned"
        }
    } catch {
        Write-Fail "Snapshot: $_"
    }
}

# ─── SUMMARY ──────────────────────────────────────────────────────────────
Write-Host "`n========== TEST SUMMARY ==========" -ForegroundColor Green
$passed = ($testResults | Where-Object { $_.Result -eq 'PASS' }).Count
$failed = ($testResults | Where-Object { $_.Result -eq 'FAIL' }).Count
Write-Host "Passed: $passed / $($testResults.Count)" -ForegroundColor $(if($failed -eq 0){"Green"}else{"Yellow"})
if ($failed -gt 0) {
    Write-Host "Failed tests:" -ForegroundColor Red
    $testResults | Where-Object { $_.Result -eq 'FAIL' } | ForEach-Object { Write-Host "  - $($_.Name)" -ForegroundColor Red }
}
