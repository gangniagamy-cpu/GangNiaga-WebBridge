@echo off
REM Daemon Launcher for GangNiaga WebBridge
REM Starts the daemon and keeps it running

cd /d "%~dp0"

echo.
echo =====================================
echo GangNiaga WebBridge Daemon Launcher
echo =====================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Node.js not found. Please install Node.js first.
  exit /b 1
)

echo [INFO] Starting daemon on port 10087...
echo [INFO] Press Ctrl+C to stop
echo.

REM Start daemon
npm run daemon

REM If daemon exits abnormally, show error
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo [ERROR] Daemon exited with error code %ERRORLEVEL%
  echo [INFO] Check logs above for details
  pause
)
