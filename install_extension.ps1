$chromePath = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$extPath = 'D:\GangNiaga-WebBridge'

Write-Host "=== GangNiaga WebBridge Extension Installer ==="
Write-Host ""

# Check if Chrome is running
$chromeRunning = Get-Process chrome -ErrorAction SilentlyContinue
if ($chromeRunning) {
    Write-Host "WARNING: Chrome is running. Extension install needs Chrome to be closed first."
    Write-Host "Option 1: Close Chrome and re-run this script"
    Write-Host "Option 2: Install manually via chrome://extensions"
    Write-Host ""
    Write-Host "Manual install steps:"
    Write-Host "1. Open Chrome"
    Write-Host "2. Go to chrome://extensions"
    Write-Host "3. Enable 'Developer mode' (top right toggle)"
    Write-Host "4. Click 'Load unpacked'"
    Write-Host "5. Select folder: D:\GangNiaga-WebBridge"
    Write-Host "6. Click extension icon in toolbar"
    Write-Host "7. Verify status shows 'Ready (Connected)'"
} else {
    Write-Host "Chrome not running. Starting with extension loaded..."
    Start-Process $chromePath -ArgumentList "--load-extension=`"$extPath`""
    Write-Host "Chrome started with GangNiaga WebBridge extension loaded."
}
