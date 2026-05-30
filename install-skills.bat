@echo off
echo =========================================
echo 🧠 GANGNIAGA AI SKILLS AUTO-INSTALLER
echo =========================================

set "GEMINI_SKILLS_DIR=%USERPROFILE%\.gemini\skills"
set "HERMES_SKILLS_DIR=%USERPROFILE%\.hermes\skills"

echo [INFO] Menyalin kemahiran (skills) AI ke dalam otak agen...

if not exist "%GEMINI_SKILLS_DIR%" (
    echo [INFO] Membuat folder kemahiran Gemini: %GEMINI_SKILLS_DIR%
    mkdir "%GEMINI_SKILLS_DIR%"
)
xcopy "%~dp0skills\*" "%GEMINI_SKILLS_DIR%\" /E /I /Y

if not exist "%HERMES_SKILLS_DIR%" (
    echo [INFO] Membuat folder kemahiran Hermes: %HERMES_SKILLS_DIR%
    mkdir "%HERMES_SKILLS_DIR%"
)
xcopy "%~dp0skills\*" "%HERMES_SKILLS_DIR%\" /E /I /Y

echo.
echo ✅ Pemasangan Kemahiran Selesai! Ejen AI anda kini mempunyai akses kepada:
echo - gangniaga-webbridge-pro
echo - gangniaga-site-mapper
echo - sovereign-ai-developer-pro
echo.
pause
