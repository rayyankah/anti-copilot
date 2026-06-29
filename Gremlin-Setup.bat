@echo off
REM ============================================================
REM   GREMLIN  -  one-click setup + launch
REM   Double-click this file. It installs everything that's
REM   missing (Node.js, VS Code, dependencies, the VS Code
REM   sensor) and then boots the Gremlin overlay, which
REM   connects to the hosted cloud brain.
REM ============================================================
title Gremlin Setup
echo.
echo   Starting Gremlin setup...
echo.

REM Run the PowerShell installer that lives next to this file.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-Gremlin.ps1" %*

echo.
echo   Setup script finished. You can close this window.
pause
