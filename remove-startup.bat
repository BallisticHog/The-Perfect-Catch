@echo off
setlocal

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$shortcut = Join-Path ([Environment]::GetFolderPath('Startup')) 'The Catch.lnk'; Remove-Item -LiteralPath $shortcut -Force -ErrorAction SilentlyContinue"
echo The Catch Windows startup shortcut has been removed.
pause
