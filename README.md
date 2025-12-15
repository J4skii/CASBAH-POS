# CASBAH POS — Java 21 Build & Runtime Guide

This repository contains the CASBAH POS back-office + front-of-house Swing application. The legacy Ant build now targets **Java 21 LTS** while keeping the original Ant project layout intact.

## Prerequisites
- **JDK 21** installed locally. All instructions below assume `JAVA_HOME` points to the JDK 21 root (e.g. `C:\Users\User\.jdks\ms-21.0.7`).
- **Apache Maven 3.9+** (the repo uses a lightweight `pom.xml` that drives the existing `build.xml` through the Maven AntRun plugin).
- Windows PowerShell (recommended) or any modern shell. Bash scripts are also provided for Linux/macOS users.

## Building
```powershell
cd C:\Users\User\Documents\GitHub\CASBAH-POS
set JAVA_HOME=C:\Users\User\.jdks\ms-21.0.7   # or export on Linux/macOS
mvn clean package
```
The Maven build simply delegates to `build.xml` to compile sources into `antbin/` and produce distribution artifacts under `dist/`.

## Running the Application
### 1. Start the embedded Derby server (optional but recommended)
```powershell
cd C:\Users\User\Documents\GitHub\CASBAH-POS
set JAVA_HOME=C:\Users\User\.jdks\ms-21.0.7
./start-server.bat        # Windows
# or ./start-server.sh    # Linux/macOS
```
This script launches Derby in network mode so both Schema Manager and the POS client share the same database.

### 2. Launch the POS client
```powershell
cd C:\Users\User\Documents\GitHub\CASBAH-POS
./casbahpos.bat           # Windows
# or ./casbahpos.sh       # Linux/macOS
```
The script validates `JAVA_HOME`, resolves all jars in `lib/`, and starts the Swing UI.

### 3. (Optional) Run Schema Manager
If you need to upgrade the database schema or perform maintenance without the full POS UI, run `schema-manager.exe` (Windows) or `java -cp dist/casbahpos.jar com.floreantpos.main.SchemaManager` from the command line.

## Importing Menu Data from SQL/CSV
1. **Prepare your data** in SQL or CSV form. Column names must align with the Hibernate mappings located in `src/com/floreantpos/model/*.hbm.xml`.
2. **If using CSV**, convert it to SQL or `menu.json`:
   - SQL path: generate `INSERT` statements and execute them with Derby's `ij` tool (see step 4 below).
   - JSON path: translate the CSV into the `menu.json` structure and use Back Office → Tools → Import Menu.
3. **Back up the database** (`data/posdb` folder) or run Back Office → Data Tools → Backup.
4. **(Optional) Reset the stock menu** if you want a clean slate before loading new data:
   ```powershell
   set JAVA_HOME=C:\Users\User\.jdks\ms-21.0.7
   $cp = "$PWD/lib/derbytools.jar;$PWD/lib/derbyclient.jar;$PWD/lib/derbyshared.jar;$PWD/lib/derby.jar"
   & "$env:JAVA_HOME\bin\java.exe" -cp $cp org.apache.derby.tools.ij scripts/menu-reset.sql
   ```
   The helper script wipes `MENU_ITEM`, `MENU_GROUP`, and `MENU_CATEGORY` in a single transaction.
5. **Execute SQL** with Derby tools:
   ```powershell
   set JAVA_HOME=C:\Users\User\.jdks\ms-21.0.7
    $cp = "$PWD/lib/derbytools.jar;$PWD/lib/derbyclient.jar;$PWD/lib/derbyshared.jar;$PWD/lib/derby.jar"
    & "$env:JAVA_HOME\bin\java.exe" -cp $cp org.apache.derby.tools.ij scripts/menu-import.sql
   ```
   The checked-in `scripts/menu-import.sql` already connects to `data/posdb`, populates the Hibernate `MODIFIED_TIME` columns required by Derby's optimistic locking, and finishes with `commit`/`disconnect`/`exit`. If you craft your own SQL ensure every insert supplies `MODIFIED_TIME` and respects column lengths (e.g., `MENU_GROUP.NAME` allows only 20 characters).
6. **Restart the POS client** so the Switchboard reloads its cached menu.

## Troubleshooting
- **`java.lang.module` errors**: add the necessary `--add-opens` flags inside the launcher scripts if a third-party library still reflects into JDK internals.
- **Derby lock timeouts**: stop all POS instances, delete `data/posdb/log/*.lck`, and restart the Derby server.
- **Menu not updating**: close the POS front screen and relaunch it or select Back Office → Tools → Reload Menu.

## Helpful Scripts
- `start-server.bat` / `.sh`: boots Derby.
- `casbahpos.bat` / `.sh`: launches the Swing application.
- `dist/`: contains packaged artifacts if you need to deploy on another machine.

## Packaging a Windows Installer

Use the root-level `build-exe.ps1` script to regenerate binaries and produce a standalone installer without any WiX/MSI dependencies. It performs the following automatically: stops leftover `java.exe` processes, deletes `dist/`, sets `JAVA_HOME`, runs `ant clean dist`, and then executes `jpackage` with the required arguments to emit `Casbah POS-1.0.2.exe` under `packaging/windows/output/`.

```powershell
cd C:\Users\User\Documents\GitHub\CASBAH-POS
.\build-exe.ps1 -JavaHome "C:\Users\User\.jdks\ms-21.0.7" -AppVersion 1.0.2
```

After the script finishes, share `packaging/windows/output/Casbah POS-1.0.2.exe` with your client. They can install it directly; no WiX tooling or extra scripts are required.

Feel free to extend this README with environment-specific steps or screenshots for your deployment.

## Team SOP: Build, Installer, and Derby

The following runbook is what every teammate should follow when producing deliverables for the client.

1. **Prep the workstation**
   - Clone this repo and stay on branch `appmod/java-migration-20251208200431` unless told otherwise.
   - Install prerequisites:
     - JDK 21 (set `JAVA_HOME`, e.g., `C:\Users\User\.jdks\ms-21.0.7`).
     - Maven 3.9+ (verify with `mvn -v`).
     - WiX Toolset 3.14+ and ensure `candle.exe`/`light.exe` are on `PATH`.

2. **Refresh build artifacts**
   - Optional but recommended: `git clean -xfd dist antbin bin target packaging/windows/output packaging/windows/.work` to purge stale binaries.
   - From repo root run:
     ```powershell
     set JAVA_HOME=C:\Users\User\.jdks\ms-21.0.7
     mvn clean package
     .\build-exe.ps1 -JavaHome "C:\Users\User\.jdks\ms-21.0.7" -AppVersion 1.0.3
     ```
   - The script compiles the app, builds the jlink runtime, creates an app-image with `app.runtime=$APPDIR\..\runtime`, and emits `Casbah POS-1.0.3.msi` at `packaging/windows/output/`.

3. **Validate the installer**
   - Uninstall any previous Casbah POS via Settings → Apps (or `msiexec /x`).
   - Install the new MSI (double-click or `msiexec /i "...\Casbah POS-1.0.3.msi"`).
   - Confirm `C:\Program Files\Casbah POS\runtime\bin` contains `java.exe` and `app\Casbah POS.cfg` has `app.runtime=$APPDIR\..\runtime`.
   - Launch “Casbah POS DerbyServer” followed by “Casbah POS” from the Start Menu to verify the login screen loads.

4. **Derby usage + menu management**
   - Derby data lives under `%PROGRAMDATA%\Casbah POS\data\posdb`. Back it up before imports.
   - Use `scripts/menu-reset.sql` or `scripts/menu-import.sql` with Derby `ij` when seeding menu data; documented earlier in this README.

5. **Handoff to client**
   - Deliver the MSI plus a short note: install → run DerbyServer shortcut → run Casbah POS → configure printers via Back Office → Configuration → Print Configuration.
   - If they need menu imports, share the SQL/CSV workflow and remind them to back up `%PROGRAMDATA%\Casbah POS\data` first.

Following this SOP ensures every engineer on the team can regenerate the installer, validate Derby, and hand off a working POS build without surprises.
