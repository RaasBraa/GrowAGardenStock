# Dual Notification System Deployment Guide

## Overview
This guide helps you deploy the new OneSignal system while keeping the existing Expo notifications working for users with older app versions.

## 🎯 **Deployment Strategy**

### **Phase 1: Dual System (Current)**
- ✅ **Old app users** → Get Expo notifications
- ✅ **New app users** → Get OneSignal notifications  
- ✅ **No disruption** → Everyone keeps getting notifications
- ✅ **Gradual migration** → Natural transition as users update

### **Phase 2: OneSignal Only (Future)**
- 🚀 **All users** → Get OneSignal notifications
- 🚀 **Better delivery** → Higher success rates
- 🚀 **Analytics** → Delivery reports and insights

---

## 🔧 **Environment Configuration**

### **Add to your `.env.local`:**
```bash
# OneSignal Configuration
ONESIGNAL_API_KEY=your_onesignal_rest_api_key_here

# Notification System Configuration
USE_ONESIGNAL=true                    # Enable OneSignal
ENABLE_DUAL_NOTIFICATIONS=true        # Keep Expo running too
```

### **Configuration Options:**

| **Setting** | **Value** | **Result** |
|---|---|---|
| `USE_ONESIGNAL=false` | `ENABLE_DUAL_NOTIFICATIONS=false` | **Expo only** (old system) |
| `USE_ONESIGNAL=true` | `ENABLE_DUAL_NOTIFICATIONS=true` | **Both systems** (current) |
| `USE_ONESIGNAL=true` | `ENABLE_DUAL_NOTIFICATIONS=false` | **OneSignal only** (future) |

---

## 📱 **How It Works**

### **Registration Flow:**
```javascript
// Old app (Expo)
{
  "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "device_type": "ios",
  "preferences": { "Carrot": true }
}

// New app (OneSignal)  
{
  "token": "device_identifier",
  "onesignal_player_id": "12345678-1234-1234-1234-123456789abc",
  "device_type": "ios", 
  "preferences": { "Carrot": true }
}
```

### **Notification Flow:**
```javascript
// When Carrot comes in stock:
1. Check device type (Expo token vs OneSignal Player ID)
2. Send Expo notification to Expo devices
3. Send OneSignal notification to OneSignal devices
4. Both systems respect user preferences
```

---

## 🚀 **Deployment Steps**

### **Step 1: Update Environment Variables**
```bash
# Add to your production .env file:
ONESIGNAL_API_KEY=your_production_onesignal_key
USE_ONESIGNAL=true
ENABLE_DUAL_NOTIFICATIONS=true
```

### **Step 2: Deploy Updated Code**
```bash
# Deploy the new notification-manager.ts and updated stock-manager.ts
git add .
git commit -m "Add dual notification system support"
git push
```

### **Step 3: Verify Both Systems**
```bash
# Test Expo notifications (old system)
curl -X POST http://your-server/api/register-push-token \
  -H "Content-Type: application/json" \
  -d '{"token": "ExponentPushToken[test]", "device_type": "ios", "preferences": {"Carrot": true}}'

# Test OneSignal notifications (new system)  
curl -X POST http://your-server/api/register-push-token \
  -H "Content-Type: application/json" \
  -d '{"token": "test_device", "onesignal_player_id": "test-player-id", "device_type": "ios", "preferences": {"Carrot": true}}'
```

### **Step 4: Monitor Logs**
```bash
# Check that both systems are working:
📤 Sending Carrot notification (OneSignal: true, Expo: true)
✅ OneSignal notification sent for Carrot
✅ Expo notification sent for Carrot
```

---

## 📊 **Monitoring & Migration**

### **Track Migration Progress:**
```bash
# Check token statistics
curl http://your-server/api/push-tokens

# Expected output during migration:
{
  "total": 150,
  "active": 142,
  "expo_tokens": 85,      # Old app users
  "onesignal_tokens": 57  # New app users
}
```

### **Migration Timeline:**
- **Week 1-2**: Deploy dual system, monitor both working
- **Week 3-4**: Encourage app updates, track OneSignal adoption
- **Week 5-6**: Consider disabling Expo if OneSignal adoption is high
- **Week 7+**: Switch to OneSignal only

---

## 🔄 **Switching to OneSignal Only**

### **When Ready (Future):**
```bash
# Update environment variables:
USE_ONESIGNAL=true
ENABLE_DUAL_NOTIFICATIONS=false  # Disable Expo

# Deploy the change
git commit -m "Switch to OneSignal only"
git push
```

### **Verification:**
```bash
# Check logs - should only see OneSignal:
📤 Sending Carrot notification (OneSignal: true, Expo: false)
✅ OneSignal notification sent for Carrot
```

---

## 🛠️ **Troubleshooting**

### **Both Systems Not Working:**
```bash
# Check environment variables
echo $ONESIGNAL_API_KEY
echo $USE_ONESIGNAL
echo $ENABLE_DUAL_NOTIFICATIONS

# Check logs for errors
tail -f logs/stock-manager.log
```

### **OneSignal Not Working:**
```bash
# Verify OneSignal API key
curl -H "Authorization: Basic $ONESIGNAL_API_KEY" \
  https://onesignal.com/api/v1/apps/7a3f0ef9-af93-4481-93e1-375183500d50
```

### **Expo Not Working:**
```bash
# Check Expo configuration
# Verify EXPO_ACCESS_TOKEN is set
# Check push-tokens.json file permissions
```

---

## 📈 **Benefits of This Approach**

### **✅ Zero Downtime**
- No users lose notifications during migration
- Seamless transition experience

### **✅ Risk Mitigation**
- Can rollback to Expo only if needed
- Gradual migration reduces risk

### **✅ User Experience**
- Users don't need to do anything
- Notifications continue working

### **✅ Analytics**
- Track migration progress
- Monitor OneSignal adoption rates

---

## 🎯 **Success Metrics**

### **Track These Numbers:**
- **Total active devices**
- **Expo vs OneSignal device count**
- **Notification delivery rates**
- **User engagement (app opens)**

### **Migration Complete When:**
- 90%+ devices using OneSignal
- OneSignal delivery rate > 95%
- No significant user complaints

---

## 📞 **Support**

If you encounter issues:
1. Check the logs for error messages
2. Verify environment variables are set correctly
3. Test both systems individually
4. Monitor OneSignal dashboard for delivery issues

The dual system ensures a smooth transition with zero disruption to your users! 🚀 