Start-Sleep -Seconds 3
try {
    $resp = Invoke-WebRequest -Uri 'http://127.0.0.1:9222/json' -UseBasicParsing -TimeoutSec 5
    Write-Output $resp.Content
} catch {
    Write-Output "Error: $_"
}
