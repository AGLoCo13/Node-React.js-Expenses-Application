@echo off
echo ========================================
echo Git Cleanup - Remove node_modules from tracking
echo ========================================
echo.
echo This script will:
echo 1. Remove node_modules from Git tracking
echo 2. Remove .env files from Git tracking
echo 3. Update .gitignore files
echo.
echo Press Ctrl+C to cancel or
pause

echo.
echo Step 1: Checking Git status before cleanup...
git status

echo.
echo Step 2: Removing node_modules from Git tracking...
git rm -r --cached node_modules 2>nul
git rm -r --cached backend/node_modules 2>nul
git rm -r --cached frontend/node_modules 2>nul
echo Done!

echo.
echo Step 3: Removing .env file from Git tracking...
git rm --cached backend/.env 2>nul
echo Done!

echo.
echo Step 4: Staging .gitignore files...
git add .gitignore
git add backend/.gitignore
git add frontend/.gitignore
echo Done!

echo.
echo Step 5: Checking what will be committed...
git status

echo.
echo ========================================
echo Ready to commit!
echo ========================================
echo.
echo Run this command to commit the changes:
echo git commit -m "Fix: Update .gitignore and remove node_modules from tracking"
echo.
echo Then:
echo git push
echo.
pause
