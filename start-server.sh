#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="$SCRIPT_DIR/lib"
CLASSPATH="$LIB_DIR/derby.jar:$LIB_DIR/derbynet.jar"

if [[ -n "${JAVA_HOME:-}" && -x "$JAVA_HOME/bin/java" ]]; then
	JAVA_CMD="$JAVA_HOME/bin/java"
	echo "Using JAVA_HOME=$JAVA_HOME (expected JDK 21 or later)"
else
	JAVA_CMD="java"
	echo "JAVA_HOME not set — using java from PATH. Ensure it points to JDK 21 or later."
fi

for jar in derby.jar derbynet.jar; do
	if [[ ! -f "$LIB_DIR/$jar" ]]; then
		echo "ERROR: Unable to find $jar under $LIB_DIR" >&2
		exit 1
	fi
done

exec "$JAVA_CMD" -cp "$CLASSPATH" org.apache.derby.drda.NetworkServerControl start -h localhost -p 1527

