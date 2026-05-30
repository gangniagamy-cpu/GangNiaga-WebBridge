Stop-Process -Name chrome -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

$chromePath = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$extPath = 'D:\GangNiaga-WebBridge\extension'

Start-Process $chromePath -ArgumentList "--load-extension=`"$extPath`"", "--disable-extensions-except=`"$extPath`""

Start-Sleep -Seconds 5
Write-Host 'Chrome started with extension loaded'

# Check extension ID
$extDirs = Get-ChildItem 'C:\Users\megat\AppData\Local\Google\Chrome\User Data\Default\Extensions' -Directory | Where-Object { $_.Name -match 'gangniaga|webbridge' }
if ($extDirs) {
    Write-Host 'Extension ID:' $extDirs.Name
} else {
    Write-Host 'Checking all extensions...'
    Get-ChildItem 'C:\Users\megat\AppData\Local\Google\Chrome\User Data\Default\Extensions' -Directory | Select-Object Name, LastWriteTime | Format-Table -AutoSize
}
