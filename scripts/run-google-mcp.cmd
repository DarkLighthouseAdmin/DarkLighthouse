@echo off
REM Launch Google MCP with OAuth client env from Desktop credentials JSON.
setlocal
set "CLIENT_JSON=C:\Users\shue1\Downloads\client_secret_100153251402-p0ev117sl903r9cfqrm6m9jlr7sdd6sf.apps.googleusercontent.com.json"
set "MCP_JS=C:\Users\shue1\Projects\dark-lighthouse-store\tools\google-mcp\node_modules\@chieflatif\google-mcp\dist\index.js"

for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "$j=Get-Content -Raw '%CLIENT_JSON%'|ConvertFrom-Json; Write-Output $j.installed.client_id"`) do set "GOOGLE_CLIENT_ID=%%I"
for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "$j=Get-Content -Raw '%CLIENT_JSON%'|ConvertFrom-Json; Write-Output $j.installed.client_secret"`) do set "GOOGLE_CLIENT_SECRET=%%I"

set "MCP_CORE_TOOLS=1"
node "%MCP_JS%"
