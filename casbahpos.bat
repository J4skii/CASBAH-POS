@echo off
setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR%"=="" set "SCRIPT_DIR=.\"

set "JAVA_CMD=java"
if defined JAVA_HOME (
	if exist "%JAVA_HOME%\bin\java.exe" (
		set "JAVA_CMD=%JAVA_HOME%\bin\java.exe"
	)
)

if defined JAVA_HOME (
	echo Using JAVA_HOME=%JAVA_HOME% (expected JDK 21 or later)
) else (
	echo JAVA_HOME not set. Falling back to java in PATH — ensure it is JDK 21 or later.
)

set "APP_JAR=%SCRIPT_DIR%casbahpos.jar"
if not exist "%APP_JAR%" (
	echo ERROR: Unable to locate application jar at %APP_JAR%
	endlocal & exit /b 1
)

"%JAVA_CMD%" -jar "%APP_JAR%"
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
	echo Application exited with code %EXIT_CODE%
)

endlocal & exit /b %EXIT_CODE%
