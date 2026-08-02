Set-Location "C:\Users\Administrador\.gemini\antigravity\scratch\Black"
# O script Node grava o log dele mesmo (scripts\import-log.txt, em UTF-8) — aqui so descartamos a saida do npm
# pra nao depender da captura de stream do PowerShell, que embaralhava acentuacao e formatava mal os erros.
npm run import:appbarber *> $null
