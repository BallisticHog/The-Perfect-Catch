@echo off
setlocal
cd /d "%~dp0"
set "CATCH_ROOT=%~dp0"

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$shell = New-Object -ComObject WScript.Shell; $shortcut = $shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Startup')) 'The Catch.lnk')); $shortcut.TargetPath = (Join-Path $env:CATCH_ROOT 'run.bat'); $shortcut.WorkingDirectory = $env:CATCH_ROOT; $shortcut.WindowStyle = 7; $shortcut.Save()"
if errorlevel 1 (
    echo The startup shortcut could not be created.
    pause
    exit /b 1
)

echo The Catch will now start when you sign in to Windows.
pause
