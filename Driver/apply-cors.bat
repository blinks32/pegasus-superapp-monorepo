@echo off
echo ========================================
echo Firebase Storage CORS Configuration
echo ========================================
echo.
echo Step 1: Authenticating with Google Cloud...
call gcloud auth login
echo.
echo Step 2: Setting project...
call gcloud config set project pegasus-2be94
echo.
echo Step 3: Applying CORS configuration...
call gsutil cors set cors.json gs://pegasus-2be94.appspot.com
echo.
echo Step 4: Verifying CORS configuration...
call gsutil cors get gs://pegasus-2be94.appspot.com
echo.
echo ========================================
echo CORS Configuration Complete!
echo ========================================
pause
