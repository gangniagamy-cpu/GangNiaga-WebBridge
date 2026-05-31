@echo off
echo ============================================
echo  GangNiaga WebBridge - Native Messaging Setup
echo ============================================
echo.

set REG_KEY=HKCU\Software\Google\Chrome\NativeMessagingHosts\com.gangniaga.webbridge
set MANIFEST_PATH=%~dp0daemon\com.gangniaga.webbridge.json

REM ---- Step 1: Update manifest with absolute path ----
echo [1/3] Updating manifest path...
powershell -Command "$json = Get-Content '%MANIFEST_PATH%' -Raw | ConvertFrom-Json; $json.path = '%~dp0daemon\native-wrapper.bat'; $json | ConvertTo-Json | Set-Content '%MANIFEST_PATH%' -Encoding UTF8"
echo   Updated: %MANIFEST_PATH%

REM ---- Step 2: Register Native Messaging Host ----
echo [2/3] Registering Native Messaging Host...
reg add "%REG_KEY%" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f >nul 2>&1
if %ERRORLEVEL% EQU 0 (
  echo   Registry key added successfully
) else (
  echo   [WARN] Registry add failed. Try running as Administrator.
)

REM ---- Step 3: Verify extension ID ----
echo [3/3] Checking extension ID...
for /f "tokens=*" %%a in ('type "%MANIFEST_PATH%" ^| findstr "chrome-extension://"') do (
  set EXT_LINE=%%a
)
echo   Found: %EXT_LINE%
echo.
echo ⚠️  IMPORTANT: Make sure the extension ID matches your installed extension!
echo    1. Open chrome://extensions
echo    2. Enable Developer mode
echo    3. Load unpacked from: %~dp0extension
echo    4. Copy the Extension ID shown
echo    5. Update daemon\com.gangniaga.webbridge.json if different
echo.
echo ============================================
echo  Setup Complete!
echo ============================================
pause
