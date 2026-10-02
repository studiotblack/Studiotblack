@echo off
chcp 65001 >nul
rem Importa as planilhas do AppBarber (comissoes e taxa de ocupacao) de Downloads\AppBarber para o sistema.
rem Se copiar este arquivo para a Area de Trabalho, ajuste a linha abaixo com o caminho do projeto.
set "PROJETO=%~dp0.."
if not exist "%PROJETO%\package.json" set "PROJETO=%USERPROFILE%\.gemini\antigravity\scratch\Black"

cd /d "%PROJETO%"
echo Importando planilhas do AppBarber...
echo.
call npm run import:appbarber
echo.
echo Concluido. Veja o resultado acima.
pause
