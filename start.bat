@echo off
:: GetaJob One-Click Startup Script
echo Starting GetaJob...

:: 1. Check Node.js installation
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Node.js is not installed or not in PATH.
    
    :: Check for Admin rights
    net session >nul 2>&1
    if errorlevel 1 (
        echo Requesting administrative privileges to install Node.js...
        powershell -Command "Start-Process '%~dpnx0' -Verb RunAs"
        exit /b
    )

    echo Installing Node.js LTS via winget...
    winget install OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
    
    echo =======================================================
    echo Node.js has been successfully installed!
    echo However, this command window needs to be refreshed.
    echo Please press any key to close this window, and then 
    echo double-click start.bat again to launch the project.
    echo =======================================================
    pause
    exit /b
)

:: 1.5. Install Dependencies
echo Installing dependencies...
call npm install

:: 2. Auto-DB Directory Initialization
if "%GETAJOB_DB_DIR%"=="" (
    set DB_DIR=%USERPROFILE%\.getajob
) else (
    set DB_DIR=%GETAJOB_DB_DIR%
)
if not exist "%DB_DIR%" (
    echo Creating database directory at %DB_DIR%...
    mkdir "%DB_DIR%"
)

:: 3. Port check (detect collision on port)
if "%PORT%"=="" (
    set PORT=3000
)
netstat -ano | findstr :%PORT% >nul 2>nul
if %errorlevel% equ 0 (
    echo Error: Port %PORT% is already in use.
    exit /b 2
)

:: 4. Start Next.js Server
echo Launching GetaJob Next.js Server on port %PORT%...
start /B npm run dev > "%DB_DIR%\server.log" 2>&1

:: 5. Wait for server to start
timeout /t 5 /nobreak >nul

:: 6. Auto-open Web UI
echo Opening web interface...
start http://localhost:%PORT%

echo GetaJob is running. Press Ctrl+C in this window to stop the server.
:loop
timeout /t 2 >nul
goto loop
