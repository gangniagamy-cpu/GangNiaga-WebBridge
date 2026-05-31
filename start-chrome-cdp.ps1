$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$userDataDir = "C:\Users\megat\AppData\Local\Google\Chrome\User Data"
Start-Process $chromePath -ArgumentList "--remote-debugging-port=9222", "--profile-directory=Default"
Start-Sleep -Seconds 5
try {
    $resp = Invoke-WebRequest -Uri "http://127.0.0.1:9222/json/version" -UseBasicParsing -TimeoutSec 5
    Write-Output "CDP OK: $($resp.Content)"
} catch {
    Write-Output "CDP not available: $_"
}
