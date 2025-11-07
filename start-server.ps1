# Script to kill any process on port 5000 and start the server
Write-Host "Checking for processes on port 5000..." -ForegroundColor Yellow

$connection = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue
if ($connection) {
    $processId = $connection.OwningProcess
    Write-Host "Found process $processId using port 5000. Killing it..." -ForegroundColor Red
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    Write-Host "Process killed successfully!" -ForegroundColor Green
} else {
    Write-Host "Port 5000 is free!" -ForegroundColor Green
}

Write-Host "Starting server..." -ForegroundColor Cyan
node server.js



