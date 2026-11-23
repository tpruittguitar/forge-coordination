' Starts the live backlog worksheet on http://127.0.0.1:51415/ with no console window.
' Used by the TIMMAY logon task "Forge Live Backlog Worksheet". Output goes to %TEMP%\live-backlog-worksheet.log.
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName)))
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = root
sh.Run "cmd /c node tools\live-backlog\server.cjs > ""%TEMP%\live-backlog-worksheet.log"" 2>&1", 0, False
