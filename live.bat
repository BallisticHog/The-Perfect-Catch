@echo off
cd /d "%~dp0"
node scripts/local-review-runner.mjs start --no-browser
if errorlevel 1 goto failed
start "" "http://127.0.0.1:4318/live"
echo Keep this window open while following the regatta. Press Ctrl+C to stop polling.
call pnpm --filter @the-perfect-catch/worker live
:failed
pause
