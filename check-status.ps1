$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue
$chromeProcesses = Get-Process chrome -ErrorAction SilentlyContinue

Write-Host "=== Node Processes ==="
if ($nodeProcesses) {
    $nodeProcesses | ForEach-Object {
        $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)").CommandLine
        Write-Host "PID: $($_.Id) | Cmd: $($cmdLine.Substring(0, [Math]::Min(100, $cmdLine.Length)))"
    }
} else {
    Write-Host "No node processes running"
}

Write-Host ""
Write-Host "=== Chrome Processes ==="
if ($chromeProcesses) {
    $chromeProcesses | Select-Object -First 5 | ForEach-Object {
        Write-Host "PID: $($_.Id) | Title: $($_.MainWindowTitle)"
    }
    Write-Host "Total chrome processes: $($chromeProcesses.Count)"
} else {
    Write-Host "No chrome processes running"
}

Write-Host ""
Write-Host "=== GangNiaga Extension Check ==="
$extPath = "C:\Users\megat\AppData\Local\Google\Chrome\User Data\Default\Extensions"
$gangniagaId = "hinhmbbmelmmgiehkfmmkmfndadahmkk"
$extDir = Join-Path $extPath $gangniagaId
if (Test-Path $extDir) {
    Write-Host "GangNiaga extension IS installed at: $extDir"
    Get-ChildItem $extDir -Recurse -Filter "manifest.json" | ForEach-Object {
        $manifest = Get-Content $_.FullName -Raw | ConvertFrom-Json
        Write-Host "  Version: $($manifest.version)"
        Write-Host "  Name: $($manifest.name)"
    }
} else {
    Write-Host "GangNiaga extension NOT installed"
    Write-Host "Expected ID: $gangniagaId"
    Write-Host ""
    Write-Host "To install:"
    Write-Host "1. Open Chrome -> chrome://extensions"
    Write-Host "2. Enable Developer mode"
    Write-Host "3. Click Load unpacked"
    Write-Host "4. Select: D:\GangNiaga-WebBridge\extension"
}
