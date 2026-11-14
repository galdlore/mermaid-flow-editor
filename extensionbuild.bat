@echo off
chcp 65001 > nul
setlocal
cd /d "%~dp0"

echo [1/2] Chrome拡張機能用のファイルをビルドしています...
call npm run build:extension
if errorlevel 1 (
  echo.
  echo ビルド中にエラーが発生しました。
  pause
  exit /b 1
)

echo.
echo [2/2] ストア提出用のZIPファイルを作成しています...
set "ZIP_PATH=%~dp0mermaid-flow-editor-extension.zip"
if exist "%ZIP_PATH%" del /f /q "%ZIP_PATH%"

pushd "%~dp0dist-extension"
tar.exe -a -c -f "%ZIP_PATH%" *
set "TAR_ERR=%errorlevel%"
popd

if not "%TAR_ERR%"=="0" (
  echo.
  echo ZIPファイルの作成に失敗しました。
  pause
  exit /b 1
)

echo.
echo 完了しました: %ZIP_PATH%
echo このZIPファイルをそのままChromeウェブストアへアップロードできます。
echo.
pause
