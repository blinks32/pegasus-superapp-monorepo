# Manual CORS Setup Instructions

## Step 1: Install Google Cloud SDK
1. Download from: https://cloud.google.com/sdk/docs/install-windows
2. Run the installer and follow the setup wizard
3. Restart your command prompt/terminal

## Step 2: Authenticate and Apply CORS
After installing Google Cloud SDK, run these commands:

```bash
# Authenticate with Google Cloud
gcloud auth login

# Set your project
gcloud config set project pegasus-2be94

# Apply CORS configuration
gsutil cors set cors.json gs://pegasus-2be94.appspot.com

# Verify CORS configuration
gsutil cors get gs://pegasus-2be94.appspot.com
```

## Step 3: Test the Upload
After applying CORS, test your image upload functionality again.