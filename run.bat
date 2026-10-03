@echo off
setlocal
cd /d "%~dp0"

set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not exist "%NODE_EXE%" (
    echo Node.js was not found at "%NODE_EXE%".
    echo Install Node.js 20 or newer, then try again.
    pause
    exit /b 1
)

"%NODE_EXE%" scripts\local-review-runner.mjs start
if errorlevel 1 (
    echo.
    echo The Catch could not start. See .data\local-web.log for details.
    pause
    exit /b 1
)

echo You may close this window. Use stop.bat when you want to stop the preview.
timeout /t 4 /nobreak >nul
