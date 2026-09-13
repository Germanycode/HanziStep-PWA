@echo off
setlocal

rem Daily launcher: installs, builds data and app when missing, then serves
rem http://localhost:4173 and opens Microsoft Edge. Pass -Rebuild to rebuild the app.
set "APP_ROOT=%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%APP_ROOT%scripts\start-local.ps1" %*

endlocal
