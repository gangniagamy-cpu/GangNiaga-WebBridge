@echo off
echo Installing GangNiaga Native Messaging Host...
set REG_KEY=HKCU\Software\Google\Chrome\NativeMessagingHosts\com.gangniaga.webbridge
set MANIFEST_PATH=%~dp0daemon\com.gangniaga.webbridge.json

:: Convert path to double backslashes for JSON
set JSON_PATH=%MANIFEST_PATH:\=\\%

:: Update the manifest file with absolute path to the wrapper
powershell -Command "(Get-Content '%MANIFEST_PATH%') -replace 'native-wrapper.bat', '%~dp0daemon\native-wrapper.bat' | Set-Content '%MANIFEST_PATH%'"

:: Add registry key
reg add "%REG_KEY%" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f

echo.
echo Setup Complete!
echo Make sure your Extension ID matches in daemon\com.gangniaga.webbridge.json
pause

