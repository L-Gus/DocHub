@echo off
echo Starting DocHub...
cd /d "%~dp0"
if exist "core-backend\target\release\core-backend.exe" (
    start "" "C:\Program Files\nodejs\npm.cmd" start
) else (
    echo Error: Rust backend not found. Please run npm run build first.
    pause
)