@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 (
  py -3 -c "import sys; sys.exit(sys.version_info < (3, 8))" >nul 2>nul
  if not errorlevel 1 (
    py -3 launch.py %*
    if errorlevel 1 pause
    exit /b
  )
)
where python >nul 2>nul
if not errorlevel 1 (
  python -c "import sys; sys.exit(sys.version_info < (3, 8))" >nul 2>nul
  if not errorlevel 1 (
    python launch.py %*
    if errorlevel 1 pause
    exit /b
  )
)
where python3 >nul 2>nul
if not errorlevel 1 (
  python3 -c "import sys; sys.exit(sys.version_info < (3, 8))" >nul 2>nul
  if not errorlevel 1 (
    python3 launch.py %*
    if errorlevel 1 pause
    exit /b
  )
)
echo Python 3.8 or newer is needed for automatic folder backups.
echo You can still open Writing Studio.html and use Back up projects to save copies.
if exist "Writing Studio.html" start "" "Writing Studio.html"
pause
