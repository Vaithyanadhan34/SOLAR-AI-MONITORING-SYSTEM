@echo off
echo ========================================================
echo Starting Solar AI Monitoring System
echo ========================================================

echo Starting Backend Server on http://127.0.0.1:5000 ...
start "Solar AI Backend" cmd /k "py app.py"

timeout /t 3 /nobreak >nul

echo Starting Frontend UI on http://localhost:5173 ...
cd solar-ai-frontend
start "Solar AI Frontend" cmd /k "npm run dev"

timeout /t 2 /nobreak >nul
start http://localhost:5173

echo ========================================================
echo Solar AI is now running!
echo Backend:  http://127.0.0.1:5000
echo Frontend: http://localhost:5173
echo ========================================================
