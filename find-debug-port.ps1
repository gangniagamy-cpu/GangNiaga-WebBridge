$chromeProcesses = Get-Process chrome -ErrorAction SilentlyContinue
$debuggingPort = $null

foreach ($proc in $chromeProcesses) {
    try {
        $cmdLine = $proc.CommandLine
        if ($cmdLine -match 'remote-debugging-port=(\d+)') {
            $debuggingPort = $Matches[1]
            Write-Host "Found Chrome with remote debugging port: $debuggingPort (PID: $($proc.Id))"
        }
    } catch {
        # Access denied, skip
    }
}

if (-not $debuggingPort) {
    Write-Host "No Chrome with remote-debugging-port found"
    Write-Host ""
    Write-Host "All Chrome PIDs:"
    foreach ($proc in $chromeProcesses) {
        try {
            Write-Host "  PID $($proc.Id): $($proc.MainWindowTitle)"
        } catch {}
    }
}
