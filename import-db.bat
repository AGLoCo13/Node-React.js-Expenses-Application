@echo off
echo ========================================
echo Importing MongoDB Collections
echo ========================================
echo.

cd "JSON DB Collections"

echo Importing users...
mongoimport --db commons-db --collection users --file users.json --jsonArray
echo.

echo Importing profiles...
mongoimport --db commons-db --collection profiles --file profiles.json --jsonArray
echo.

echo Importing buildings...
mongoimport --db commons-db --collection buildings --file buildings.json --jsonArray
echo.

echo Importing apartments...
mongoimport --db commons-db --collection apartments --file apartments.json --jsonArray
echo.

echo Importing expenses...
mongoimport --db commons-db --collection expenses --file expenses.json --jsonArray
echo.

echo Importing consumptions...
mongoimport --db commons-db --collection consumptions --file consumptions.json --jsonArray
echo.

echo Importing payments...
mongoimport --db commons-db --collection payments --file payments.json --jsonArray
echo.

echo ========================================
echo Database import completed!
echo ========================================
pause
