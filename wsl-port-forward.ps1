# WSL Port Forwarding Setup for GangNiaga WebBridge
# Run this ONCE in Windows PowerShell (as Administrator)
# This forwards Windows port 10087 to WSL port 10087 so the Chrome extension
# can reach the daemon running inside WSL.

# Get WSL IP dynamically
$wslIp = (wsl hostname -I).Trim().Split(' ')[0]
Write-Host "WSL IP: $wslIp"

# Remove existing rule
netsh interface portproxy delete v4tov4 listenport=10087 listenaddress=0.0.0.0 2>$null

# Add forwarded rule
netsh interface portproxy add v4tov4 listenport=10087 listenaddress=0.0.0.0 connectport=10087 connectaddress=$wslIp

# Open firewall
New-NetFirewallRule -DisplayName "GangNiaga WebBridge" -Direction Inbound -Protocol TCP -LocalPort 10087 -Action Allow -ErrorAction SilentlyContinue

Write-Host "Port forwarding set: Windows 10087 -> WSL $wslIp`:10087"
Write-Host "Chrome extension can now reach WSL daemon at 127.0.0.1:10087"
