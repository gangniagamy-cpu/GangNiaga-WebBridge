$logPath = "$env:USERPROFILE\.hermes\logs\gateway.log"
if (Test-Path $logPath) {
    Get-Content $logPath -Tail 30
} else {
    Write-Output "No gateway log found at $logPath"
}

$errPath = "$env:USERPROFILE\.hermes\logs\gateway-error.log"
if (Test-Path $errPath) {
    Write-Output "`n--- Error Log ---"
    Get-Content $errPath -Tail 20
} else {
    Write-Output "No gateway error log found at $errPath"
}
