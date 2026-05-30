Write-Host "Checking running node processes..."
$daemons = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.CommandLine -like "*gangniaga-daemon*" -or $_.CommandLine -like "*mcp-server*" }
if ($daemons) {
    Write-Host "Found WebBridge process(es) running:"
    $daemons | ForEach-Object { Write-Host "  PID: $($_.ProcessId) | CommandLine: $($_.CommandLine)" }
} else {
    Write-Host "No WebBridge daemon or MCP processes are running."
}
Write-Host ""

# Check if extension is installed
$extPath = "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Extensions"
$installed = Get-ChildItem $extPath -Directory | Where-Object { (Get-ChildItem $_.FullName -Filter "manifest.json" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1) -and (Get-Content (Get-ChildItem $_.FullName -Filter "manifest.json" -Recurse | Select-Object -First 1).FullName -Raw -ErrorAction SilentlyContinue) -match "GangNiaga" }
if ($installed) {
    Write-Host "GangNiaga extension IS installed. ID:" $installed.Name
} else {
    Write-Host "GangNiaga extension NOT installed."
}

# Check registry
$regPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.gangniaga.webbridge"
if (Test-Path $regPath) {
    Write-Host "Native Messaging registry key EXISTS."
    Get-ItemProperty $regPath | Select-Object '(Default)'
} else {
    Write-Host "Native Messaging registry key DOES NOT EXIST."
}
