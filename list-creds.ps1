$creds = & cmdkey /list
foreach ($line in $creds) {
    if ($line -match 'google|gmail|megat|bothugdd|shazree|user|email' -and $line -notmatch 'Target|Type|Comment|Written') {
        Write-Output $line
    }
}
