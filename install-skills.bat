@echo off
echo =========================================
echo 🧠 GANGNIAGA AI SKILLS AUTO-INSTALLER
echo =========================================

set "SKILLS_DIR=%USERPROFILE%\.gemini\skills"

if not exist "%SKILLS_DIR%" (
    echo [INFO] Folder kemahiran AI tidak dijumpai. Membuat folder baru: %SKILLS_DIR%
    mkdir "%SKILLS_DIR%"
)

echo [INFO] Menyalin kemahiran (skills) AI ke dalam otak agen...
xcopy "%~dp0skills\*" "%SKILLS_DIR%\" /E /I /Y

echo.
echo ✅ Pemasangan Kemahiran Selesai! Ejen AI anda kini mempunyai akses kepada:
echo - gangniaga-webbridge-pro
echo - gangniaga-site-mapper
echo - sovereign-ai-developer-pro
echo.
pause
