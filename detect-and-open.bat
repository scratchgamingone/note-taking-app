@echo off
REM Detect device serial and open Serene Notes with device ID in URL
SETLOCAL
cd /d "%~dp0"

necho Detecting device serial...
SET SERIAL=

n:: Try WMIC first (older Windows)
for /f "tokens=*" %%a in ('wmic bios get serialnumber ^| findstr /r /v "SerialNumber"') do set SERIAL=%%a

nif "%SERIAL%"=="" (
  echo WMIC failed, trying PowerShell...
  for /f "usebackq tokens=*" %%a in (`powershell -NoProfile -Command "(Get-CimInstance -ClassName Win32_BIOS).SerialNumber" 2^>nul`) do set SERIAL=%%a
)

nif "%SERIAL%"=="" (
  echo Could not detect serial. Opening app without serial.
  start "" "index.html"
  goto :eof
)

necho Found serial: %SERIAL%

n:: URL-encode minimal characters (space -> %20)
set SERIAL_ESC=%SERIAL: =%%20%

n:: Try to start server (python or py or npx) then open with device param; otherwise open file with hash
python -m http.server 8000 >nul 2>&1 &
if %ERRORLEVEL% EQU 0 (
  start "" "http://localhost:8000/?device=%SERIAL_ESC%"
  goto :eof
)
py -3 -m http.server 8000 >nul 2>&1 &
if %ERRORLEVEL% EQU 0 (
  start "" "http://localhost:8000/?device=%SERIAL_ESC%"
  goto :eof
)
npx http-server -c-1 -p 8000 >nul 2>&1 &
if %ERRORLEVEL% EQU 0 (
  start "" "http://localhost:8000/?device=%SERIAL_ESC%"
  goto :eof
)
start "" "index.html#device=%SERIAL_ESC%"
ENDLOCAL