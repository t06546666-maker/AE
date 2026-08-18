@echo off
cd /d "%~dp0"
title Affiliate AE Local Server
echo Starting Affiliate AE local server...
echo.
"C:\Program Files\nodejs\node.exe" server.js
echo.
echo Server stopped. Copy any error above and send it to Codex.
pause
