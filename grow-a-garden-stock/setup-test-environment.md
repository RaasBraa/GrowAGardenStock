# Setup Guide: Test Notification Batching System

This guide helps you set up a local testing environment for the new OneSignal notification batching system.

## Prerequisites

1. **Node.js** (version 16 or higher)
2. **SQLite3** (usually comes with Node.js)
3. **Your OneSignal API Key** (optional, for real API testing)

## Step 1: Download Database File

### From your server, download the database file:

```bash
# SSH into your server
ssh your-server-ip

# Navigate to your project directory
cd /path/to/grow-a-garden-stock

# Copy the database file to your local machine
scp your-server-ip:/path/to/grow-a-garden-stock/push-tokens.db ./push-tokens.db
```

### Alternative: Use SCP directly

```bash
# From your local machine
scp your-server-ip:/path/to/grow-a-garden-stock/push-tokens.db ./grow-a-garden-stock/push-tokens.db
```

## Step 2: Set Environment Variables

### Option A: Set for current session
```bash
export ONESIGNAL_API_KEY="your_onesignal_rest_api_key_here"
```

### Option B: Create .env file
```bash
# Create .env file in project root
echo "ONESIGNAL_API_KEY=your_onesignal_rest_api_key_here" > .env
```

### Option C: Set inline when running
```bash
ONESIGNAL_API_KEY="your_key" node test-notification-batching.js
```

## Step 3: Run the Test

```bash
# Navigate to project directory
cd grow-a-garden-stock

# Run the test script
node test-notification-batching.js
```

## What the Test Does

The test script will:

1. **Load real user data** from your database
2. **Test various scenarios**:
   - Small notifications (100 users)
   - Medium notifications (1,500 users)
   - Large notifications (5,000 users)
   - Very large notifications (15,000 users)
   - Popular item simulation (25,000 users)
   - Weather alert simulation (30,000 users)

3. **Simulate batching logic**:
   - Split large user lists into batches of 2,000
   - Test concurrency limits (5 concurrent requests)
   - Simulate network errors and rate limits
   - Measure performance and success rates

4. **Test with real OneSignal API** (if API key provided):
   - Send a small test notification to 10 users
   - Verify the API integration works

## Expected Output

```
🧪 Testing OneSignal Notification Batching System
============================================================
📊 Loaded 15,234 test users from database

🎯 Testing: Small Notification (100 users)
📝 Test with small user count to ensure basic functionality
👥 Target users: 100
📤 Sending notification to 100 users...
📦 Split into 1 batches of max 2000 users each
📤 Sending batch 1/1 to 100 users...
✅ Mock API Success: 100 users, "Test Item" - This is a test notification
✅ Batch sending complete: 100 successful, 0 failed
⏱️  Duration: 156ms
📦 Batches sent: 1
✅ Success rate: 100.0%
⚡ Rate limit hits: 0
🎉 Scenario PASSED

🎯 Testing: Large Notification (5,000 users)
📝 Test with large user count, should require 3 batches
👥 Target users: 5000
📤 Sending notification to 5000 users...
📦 Split into 3 batches of max 2000 users each
📤 Sending batch 1/3 to 2000 users...
📤 Sending batch 2/3 to 2000 users...
📤 Sending batch 3/3 to 1000 users...
✅ Mock API Success: 2000 users, "Test Item" - This is a test notification
✅ Mock API Success: 2000 users, "Test Item" - This is a test notification
✅ Mock API Success: 1000 users, "Test Item" - This is a test notification
✅ Batch sending complete: 5000 successful, 0 failed
⏱️  Duration: 423ms
📦 Batches sent: 3
✅ Success rate: 100.0%
⚡ Rate limit hits: 0
🎉 Scenario PASSED

🌐 Testing with real OneSignal API...
✅ Real API test successful! Notification ID: abc123-def456
📊 Sent to 10 users

🎉 All tests completed successfully!

📋 Summary:
✅ Batching logic tested with various user counts
✅ Error handling and retry logic verified
✅ Concurrency limits tested
✅ Rate limiting scenarios simulated

🚀 Ready to deploy to production!
```

## Troubleshooting

### Database not found
```
❌ Database file not found: /path/to/push-tokens.db
📥 Please download push-tokens.db from your server and place it in the project root.
```

**Solution**: Make sure you've downloaded the database file and placed it in the project root directory.

### No users found
```
❌ No users found in database
```

**Solution**: Check that your database contains active users with valid OneSignal player IDs.

### API Key issues
```
⚠️  ONESIGNAL_API_KEY not set. Using mock API for testing.
```

**Solution**: Set your OneSignal API key as described in Step 2.

### Permission denied
```
Error: EACCES: permission denied, open 'push-tokens.db'
```

**Solution**: Check file permissions or copy the database file with proper permissions.

## Next Steps

After successful testing:

1. **Deploy the updated code** to your server
2. **Restart your services**:
   ```bash
   pm2 restart grow-app
   pm2 restart grow-websocket
   ```
3. **Monitor the logs** to see the batching in action
4. **Check OneSignal dashboard** for delivery reports

## Safety Notes

- The test script uses a **mock API** by default to avoid sending real notifications
- If you provide an API key, it will send a **small test notification** to 10 users only
- The mock API simulates realistic scenarios including failures and rate limits
- All test data is based on your real user database for accurate testing 