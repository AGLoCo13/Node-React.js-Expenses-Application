@echo off
REM ─────────────────────────────────────────────────────────────────────────────
REM  UrbanSync v2 — seed-db.bat
REM  Seeds the secured MongoDB container with exported JSON collections.
REM  Run from the urbansync-v2/ directory.
REM ─────────────────────────────────────────────────────────────────────────────

SET CONTAINER=urbansync-v2-mongodb
SET DB=commons
SET USER=admin
SET PASS=admin123
SET JSON_DIR=..\JSON DB Collections

echo.
echo ================================================================
echo  UrbanSync v2 — MongoDB Seeder
echo ================================================================
echo  Container : %CONTAINER%
echo  Database  : %DB%
echo  Source    : %JSON_DIR%
echo ================================================================
echo.

echo [1/7] Importing apartments...
docker exec -i %CONTAINER% mongoimport -u %USER% -p %PASS% --authenticationDatabase admin -d %DB% -c apartments < "%JSON_DIR%\apartments.json"
echo.

echo [2/7] Importing buildings...
docker exec -i %CONTAINER% mongoimport -u %USER% -p %PASS% --authenticationDatabase admin -d %DB% -c buildings < "%JSON_DIR%\buildings.json"
echo.

echo [3/7] Importing consumptions...
docker exec -i %CONTAINER% mongoimport -u %USER% -p %PASS% --authenticationDatabase admin -d %DB% -c consumptions < "%JSON_DIR%\consumptions.json"
echo.

echo [4/7] Importing expenses...
docker exec -i %CONTAINER% mongoimport -u %USER% -p %PASS% --authenticationDatabase admin -d %DB% -c expenses < "%JSON_DIR%\expenses.json"
echo.

echo [5/7] Importing payments...
docker exec -i %CONTAINER% mongoimport -u %USER% -p %PASS% --authenticationDatabase admin -d %DB% -c payments < "%JSON_DIR%\payments.json"
echo.

echo [6/7] Importing profiles...
docker exec -i %CONTAINER% mongoimport -u %USER% -p %PASS% --authenticationDatabase admin -d %DB% -c profiles < "%JSON_DIR%\profiles.json"
echo.

echo [7/7] Importing users...
docker exec -i %CONTAINER% mongoimport -u %USER% -p %PASS% --authenticationDatabase admin -d %DB% -c users < "%JSON_DIR%\users.json"
echo.

echo ================================================================
echo  All imports complete!
echo ================================================================
echo.
