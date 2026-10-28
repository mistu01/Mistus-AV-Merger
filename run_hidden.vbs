' Mistus AV Merger - Silent Windows Launcher
' Launches application in the background without creating a floating command prompt window.
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "python -m mistus_av_merger", 0, False
Set WshShell = Nothing
