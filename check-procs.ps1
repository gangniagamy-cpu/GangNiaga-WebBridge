Get-Process node -ErrorAction SilentlyContinue | ForEach-Object {
    try {
        $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)").CommandLine
        Write-Host "PID: $($_.Id) | $cmd"
    } catch {
        Write-Host "PID: $($_.Id) | (cannot read command line)"
    }
}
