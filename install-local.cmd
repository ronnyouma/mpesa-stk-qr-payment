@echo off
cd /d %~dp0
set "NODE_DIR=%~dp0.node\node-v20.16.0-win-x64"
"%NODE_DIR%\npm.cmd" install
