@echo off
setlocal
cd /d "%~dp0"

set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
set "PNPM_JS=%APPDATA%\npm\node_modules\pnpm\bin\pnpm.cjs"
if not exist "%NODE_EXE%" (
    echo Node.js was not found at "%NODE_EXE%".
    pause
    exit /b 1
)
if not exist "%PNPM_JS%" (
    echo pnpm was not found at "%PNPM_JS%".
    pause
    exit /b 1
)

echo Refreshing the complete championship catalogue from Regatta Results.
echo This intentionally makes one polite request at a time and may take several minutes.
"%NODE_EXE%" "%PNPM_JS%" catalog:refresh-local
if errorlevel 1 (
    echo.
    echo The refresh failed. The previous working catalogue has been kept.
    pause
    exit /b 1
)

echo.
echo Refresh complete. Run stop.bat and then run.bat to load the new capture.
pause
