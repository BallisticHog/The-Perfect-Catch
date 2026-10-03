@echo off
setlocal
cd /d "%~dp0"

set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not exist "%NODE_EXE%" (
    echo Node.js was not found at "%NODE_EXE%".
    pause
    exit /b 1
)

"%NODE_EXE%" scripts\local-review-runner.mjs stop
timeout /t 3 /nobreak >nul
