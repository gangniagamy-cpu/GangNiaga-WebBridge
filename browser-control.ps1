#Requires -Version 5.1
<#
.SYNOPSIS
    GangNiaga WebBridge - OS Browser Control
    Controls Chrome via PowerShell COM + SendKeys (no daemon/extension needed)
    Run from Windows PowerShell: .\browser-control.ps1
#>

param(
    [Parameter()]
    [ValidateSet("open","navigate","click","fill","screenshot","snapshot","close","help")]
    [string]$Action = "help",

    [string]$Url,
    [string]$Selector,
    [string]$Text,
    [string]$ScreenshotPath = "D:\browser_screenshot.png"
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# ═══════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════

function Get-ChromeWindow {
    $chrome = Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -ne '' } | Select-Object -First 1
    if (-not $chrome) { Write-Host "ERROR: Chrome not running. Start Chrome first." -ForegroundColor Red; exit 1 }
    return $chrome
}

function Send-Keys {
    param([string]$keys, [int]$delay = 200)
    [System.Windows.Forms.SendKeys]::SendWait($keys)
    Start-Sleep -Milliseconds $delay
}

function Focus-Chrome {
    $chrome = Get-ChromeWindow
    $hwnd = $chrome.MainWindowHandle
    [void][Microsoft.VisualBasic.Interaction]::AppActivate($chrome.Id)
    Start-Sleep -Milliseconds 500
    Write-Host "Focused: $($chrome.MainWindowTitle)" -ForegroundColor DarkGray
}

# ═══════════════════════════════════════════════════════════
# ACTIONS
# ═══════════════════════════════════════════════════════════

function Invoke-Open {
    if ($Url) {
        Start-Process "chrome.exe" $Url
    } else {
        Start-Process "chrome.exe"
    }
    Start-Sleep -Seconds 3
    Write-Host "Chrome opened: $Url" -ForegroundColor Green
}

function Invoke-Navigate {
    Focus-Chrome
    Send-Keys "^l" 300   # Ctrl+L = address bar
    Send-Keys "$Url" 100
    Send-Keys "{ENTER}" 3000
    Write-Host "Navigated to: $Url" -ForegroundColor Green
}

function Invoke-Click {
    param([string]$selector)
    Focus-Chrome
    # Try CDP evaluate via temp file approach
    # Fallback: use Tab + Enter for basic interaction
    if ($selector -match "^#") {
        # For ID-based selectors, we'd need CDP
        # Fallback: click by position (requires image matching)
        Write-Host "Click by selector requires CDP. Use fill + tab approach." -ForegroundColor Yellow
    } else {
        Send-Keys "{TAB}" 200
        Send-Keys "{ENTER}" 500
    }
}

function Invoke-Fill {
    param([string]$selector, [string]$text)
    Focus-Chrome
    Send-Keys "^f" 500   # Ctrl+F to find on page
    Send-Keys $selector.Substring(0, [Math]::Min(30, $selector.Length)) 100
    Send-Keys "{ESC}" 200
    Send-Keys "{TAB}" 200
    Send-Keys $text 100
    Write-Host "Filled '$text' near selector" -ForegroundColor Green
}

function Invoke-Screenshot {
    Focus-Chrome
    # Use PrintScreen + clip
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing

    $screen = [System.Windows.Forms.Screen]::PrimaryScreen
    $bounds = $screen.Bounds
    $bitmap = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
    $bitmap.Save($ScreenshotPath)
    $graphics.Dispose(); $bitmap.Dispose()
    Write-Host "Screenshot saved: $ScreenshotPath ($((Get-Item $ScreenshotPath).Length) bytes)" -ForegroundColor Green
}

function Invoke-Snapshot {
    Focus-Chrome
    Send-Keys "^u" 1000   # Ctrl+View source
    Start-Sleep -Seconds 1
    Send-Keys "^a" 200
    Send-Keys "^c" 200
    $html = [System.Windows.Forms.Clipboard]::GetText()
    Send-Keys "^w" 500   # Close source tab
    Write-Host "Page source captured ($($html.Length) chars)" -ForegroundColor Green
    return $html
}

function Invoke-Close {
    Focus-Chrome
    Send-Keys "^w" 500  # Close current tab
    Write-Host "Tab closed" -ForegroundColor Green
}

# ═══════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════

switch ($Action) {
    "open"      { Invoke-Open }
    "navigate"  { Invoke-Navigate }
    "click"     { Invoke-Click -selector $Selector }
    "fill"      { Invoke-Fill -selector $Selector -text $Text }
    "screenshot"{ Invoke-Screenshot }
    "snapshot"  { Invoke-Snapshot | Out-Null }
    "close"     { Invoke-Close }
    default {
        Write-Host @"
GangNiaga WebBridge - OS Browser Control v2.5
Usage: .\browser-control.ps1 -Action <action> [options]

Actions:
  open        [-Url <url>]          Open Chrome
  navigate    -Url <url>            Navigate to URL
  click       -Selector <selector>  Click element (basic)
  fill        -Selector <sel> -Text <text>  Fill input
  screenshot  [-ScreenshotPath <path>]  Capture screen
  snapshot                        Get page HTML source
  close                           Close current tab

Examples:
  .\browser-control.ps1 -Action open -Url "https://notebooklm.google.com"
  .\browser-control.ps1 -Action navigate -Url "https://google.com"
  .\browser-control.ps1 -Action screenshot
"@
    }
}
