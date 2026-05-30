Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.CommandLine -like "*gangniaga-daemon*" -or $_.CommandLine -like "*mcp-server*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Start-Sleep -Seconds 1
$remaining = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.CommandLine -like "*gangniaga-daemon*" -or $_.CommandLine -like "*mcp-server*" }
if ($remaining) {
    Write-Host "WARNING: Some WebBridge node processes still running:" 
    $remaining | Select-Object ProcessId, CommandLine
} else {
    Write-Host "GangNiaga WebBridge node processes killed."
}
