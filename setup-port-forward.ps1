# GangNiaga WebBridge - Port Forward Setup
# Run as Administrator in PowerShell
# Forwards Windows localhost:10087 -> WSL2 daemon

$wslIp = (wsl hostname -I).Trim().Split(" ")[0]
Write-Host "WSL IP: $wslIp"

# Remove old rule
netsh interface portproxy delete v4tov4 listenport=10087 listenaddress=0.0.0.0 2>$null

# Add new rule
netsh interface portproxy add v4tov4 listenport=10087 listenaddress=0.0.0.0 connectport=10087 connectaddress=$wslIp

# Firewall
New-NetFirewallRule -DisplayName "GangNiaga WebBridge" -Direction Inbound -Protocol TCP -LocalPort 10087 -Action Allow -ErrorAction SilentlyContinue

# Verify
netsh interface portproxy show v4tov4

Write-Host ""
Write-Host "Done! Extension can now connect to ws://127.0.0.1:10087/ws"
