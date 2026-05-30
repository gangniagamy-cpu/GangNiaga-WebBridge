@echo off
set NODE_PATH=%~dp0node_modules
node "%~dp0gangniaga-daemon.js" --native %*
