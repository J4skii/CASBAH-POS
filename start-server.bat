@echo off
setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR%"=="" set "SCRIPT_DIR=.\"
set "LIB_DIR=%SCRIPT_DIR%lib"

set "CLASSPATH=%LIB_DIR%\derby.jar;%LIB_DIR%\derbynet.jar"

set "JAVA_CMD=java"
if defined JAVA_HOME (
	if exist "%JAVA_HOME%\bin\java.exe" (
		set "JAVA_CMD=%JAVA_HOME%\bin\java.exe"
	)
)

if defined JAVA_HOME (
	echo Using JAVA_HOME=%JAVA_HOME% (expected JDK 21 or later)
) else (
	echo JAVA_HOME not set. Falling back to java in PATH — ensure it resolves to JDK 21 or later.
)

if not exist "%LIB_DIR%\derby.jar" (
	echo ERROR: Unable to find derby.jar under %LIB_DIR%
	endlocal & exit /b 1
)

if not exist "%LIB_DIR%\derbynet.jar" (
	echo ERROR: Unable to find derbynet.jar under %LIB_DIR%
	endlocal & exit /b 1
)

"%JAVA_CMD%" -cp "%CLASSPATH%" org.apache.derby.drda.NetworkServerControl start -h localhost -p 1527
set "EXIT_CODE=%ERRORLEVEL%"

if "%EXIT_CODE%"=="0" (
	echo Derby Network Server started on port 1527.
) else (
	echo Derby Network Server failed with code %EXIT_CODE%.
)

pause
endlocal & exit /b %EXIT_CODE%