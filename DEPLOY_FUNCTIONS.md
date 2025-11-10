# Deploying Firebase Cloud Functions

## Prerequisites

1. **Install Firebase CLI** (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**:
   ```bash
   firebase login
   ```

3. **Set your Firebase Project ID**:
   - Open `.firebaserc`
   - Replace `"your-project-id"` with your actual Firebase project ID
   - You can find your project ID in Firebase Console → Project Settings

## Step 1: Install Dependencies

Navigate to the functions directory and install dependencies:

```bash
cd functions
npm install
```

## Step 2: Build the Functions

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `lib/` directory.

## Step 3: Deploy

### Option A: Deploy from project root
```bash
cd ..  # Go back to project root
firebase deploy --only functions
```

### Option B: Deploy from functions directory
```bash
npm run deploy
```

## Step 4: Verify Deployment

1. Go to Firebase Console → Functions
2. You should see `checkTaskDueDates` function listed
3. Check the logs: `firebase functions:log`

## Testing the Function

### Test Locally (Optional)
```bash
npm run serve
```

### Trigger Manually (for testing)
```bash
firebase functions:shell
```
Then in the shell:
```javascript
checkTaskDueDates()
```

## Monitoring

- **View logs**: `firebase functions:log`
- **View in Console**: Firebase Console → Functions → Logs
- **Check execution**: The function runs every hour automatically

## Troubleshooting

1. **Build errors**: Make sure TypeScript is installed: `npm install -g typescript`
2. **Deployment errors**: Check that you're logged in: `firebase login`
3. **Permission errors**: Ensure your Firebase project has billing enabled (required for scheduled functions)

## Cost

- Free tier includes 2 million function invocations/month
- This function runs 24 times/day = ~720 invocations/month (well within free tier)

