; ==============================================================================
; installer.nsi — NSIS installer for 简思 (Lumina) on Windows
;
; Usage: makensis /DVERSION=1.0.0 /DARCH=amd64 installer.nsi
; ==============================================================================

Unicode true
ManifestDPIAware true

!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"

; ---- 元数据 ----
!define PRODUCT_NAME "简思 (Lumina)"
!define PRODUCT_PUBLISHER "牧云 (Mu Yun)"
!define PRODUCT_WEB_SITE "https://github.com/xixixiaoyu/lumina"
!define APP_EXECUTABLE "Lumina.exe"

!ifndef VERSION
  !define VERSION "1.0.0.0"
!endif
!ifndef ARCH
  !define ARCH "amd64"
!endif

Name "${PRODUCT_NAME}"
OutFile "..\bin\Lumina-Setup-${VERSION}-${ARCH}.exe"
InstallDir "$PROGRAMFILES64\Lumina"
InstallDirRegKey HKLM "Software\Lumina" "InstallDir"
RequestExecutionLevel admin
SetCompressor /SOLID lzma

; ---- Interface ----
!define MUI_ABORTWARNING
!define MUI_ICON "..\appicon.png"
!define MUI_UNICON "..\appicon.png"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "..\..\..\..\LICENSE"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "SimpChinese"
!insertmacro MUI_LANGUAGE "English"

; ---- 安装 ----
Section "Install"
  SetOutPath "$INSTDIR"

  ; 关闭正在运行的应用
  DetailPrint "Closing running instances..."
  nsExec::ExecToLog `taskkill /F /IM "${APP_EXECUTABLE}"`
  Sleep 1000

  ; 安装文件
  DetailPrint "Installing application files..."
  File "..\bin\Lumina.exe"
  File "..\appicon.png"
  ; Sidecar 运行时
  SetOutPath "$INSTDIR\sidecar"
  File /r /x "*.log" "..\bin\sidecar\*.*"
  SetOutPath "$INSTDIR"

  ; 开始菜单快捷方式
  CreateDirectory "$SMPROGRAMS\Lumina"
  CreateShortcut "$SMPROGRAMS\Lumina\简思.lnk" "$INSTDIR\${APP_EXECUTABLE}"
  CreateShortcut "$SMPROGRAMS\Lumina\Uninstall.lnk" "$INSTDIR\uninstall.exe"

  ; 桌面快捷方式
  CreateShortcut "$DESKTOP\简思.lnk" "$INSTDIR\${APP_EXECUTABLE}"

  ; 写入卸载信息
  WriteUninstaller "$INSTDIR\uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Lumina" \
    "DisplayName" "${PRODUCT_NAME}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Lumina" \
    "DisplayVersion" "${VERSION}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Lumina" \
    "Publisher" "${PRODUCT_PUBLISHER}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Lumina" \
    "UninstallString" "$INSTDIR\uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Lumina" \
    "DisplayIcon" "$INSTDIR\${APP_EXECUTABLE}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Lumina" \
    "URLInfoAbout" "${PRODUCT_WEB_SITE}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Lumina" \
    "InstallLocation" "$INSTDIR"
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Lumina" \
    "NoModify" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Lumina" \
    "NoRepair" 1

  ; 估算大小
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Lumina" \
    "EstimatedSize" "$0"

  WriteRegStr HKLM "Software\Lumina" "InstallDir" "$INSTDIR"
SectionEnd

; ---- 卸载 ----
Section "Uninstall"
  ; 关闭正在运行的实例
  nsExec::ExecToLog `taskkill /F /IM "${APP_EXECUTABLE}"`
  Sleep 1000

  ; 移除文件
  RMDir /r "$INSTDIR\sidecar"
  Delete "$INSTDIR\${APP_EXECUTABLE}"
  Delete "$INSTDIR\appicon.png"
  Delete "$INSTDIR\uninstall.exe"
  RMDir "$INSTDIR"

  ; 移除快捷方式
  Delete "$SMPROGRAMS\Lumina\简思.lnk"
  Delete "$SMPROGRAMS\Lumina\Uninstall.lnk"
  RMDir "$SMPROGRAMS\Lumina"
  Delete "$DESKTOP\简思.lnk"

  ; 移除注册表
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Lumina"
  DeleteRegKey HKLM "Software\Lumina"
SectionEnd
