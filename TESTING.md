# Testing on Mobile Devices

This guide explains how to test the workout app on your phone during development.

## Option 1: ngrok (Recommended)

ngrok creates a secure tunnel to your local development server, making it accessible from anywhere.

### Setup

1. **Install ngrok:**
   ```bash
   # macOS (using Homebrew)
   brew install ngrok/ngrok/ngrok
   
   # Or download from https://ngrok.com/download
   ```

2. **Sign up for a free account:**
   - Go to https://ngrok.com/signup
   - Get your authtoken from the dashboard

3. **Configure ngrok:**
   ```bash
   ngrok config add-authtoken YOUR_AUTHTOKEN
   ```

4. **Start your development server:**
   ```bash
   npm run dev
   ```
   Your app should be running on `http://localhost:3001`

5. **Start ngrok tunnel:**
   ```bash
   ngrok http 3001
   ```

6. **Access from your phone:**
   - ngrok will display a public URL like: `https://abc123.ngrok-free.app`
   - Open this URL on your phone's browser
   - You may need to click through a warning page (ngrok free tier)

### ngrok Tips

- **Keep ngrok running:** Leave the terminal open while testing
- **HTTPS:** ngrok provides HTTPS automatically (required for microphone access)
- **Free tier limitations:** 
  - Random URLs each time
  - Session timeout after 2 hours
  - ngrok branding page (can be bypassed)
- **Paid tier:** Custom domains, no timeout, no branding page

### Quick Script

Add this to your `package.json` scripts:
```json
"dev:tunnel": "ngrok http 3001"
```

Then run: `npm run dev:tunnel` in a separate terminal.

---

## Option 2: Vercel Preview Deployments (Best for Production Testing)

Since you're already using Vercel, you can push to a branch and get a preview URL.

### Setup

1. **Create a feature branch:**
   ```bash
   git checkout -b testing/mobile-test
   ```

2. **Push to GitHub:**
   ```bash
   git push origin testing/mobile-test
   ```

3. **Get preview URL:**
   - Vercel automatically creates a preview deployment
   - Check your Vercel dashboard or GitHub PR for the URL
   - URL format: `https://workout-app-git-testing-mobile-test.vercel.app`

### Advantages

- ✅ Permanent URL (until branch is deleted)
- ✅ HTTPS by default
- ✅ No local server needed
- ✅ Tests production-like environment
- ✅ Easy to share with others

### Disadvantages

- ❌ Requires git commit/push
- ❌ Slightly slower iteration (need to push changes)

---

## Option 3: localtunnel (Free Alternative)

localtunnel is a free, open-source alternative to ngrok.

### Setup

1. **Install localtunnel:**
   ```bash
   npm install -g localtunnel
   ```

2. **Start your development server:**
   ```bash
   npm run dev
   ```

3. **Start tunnel:**
   ```bash
   lt --port 3001
   ```

4. **Access from phone:**
   - localtunnel will display a URL like: `https://random-name.loca.lt`
   - Open this URL on your phone

### Advantages

- ✅ Completely free
- ✅ No account required
- ✅ Simple to use

### Disadvantages

- ❌ Less reliable than ngrok
- ❌ Random URLs
- ❌ May have connection issues

---

## Option 4: Same Network Access (Quick Testing)

If your phone and computer are on the same Wi-Fi network, you can access directly.

### Setup

1. **Find your computer's local IP:**
   ```bash
   # macOS
   ipconfig getifaddr en0
   
   # Or check System Settings > Network
   ```

2. **Start dev server with host binding:**
   ```bash
   # Modify package.json dev script temporarily:
   "dev": "next dev --turbo -p 3001 -H 0.0.0.0"
   ```

3. **Access from phone:**
   - Open `http://YOUR_LOCAL_IP:3001` on your phone
   - Example: `http://192.168.1.100:3001`

### Important Notes

- ⚠️ **HTTPS Required:** Microphone access requires HTTPS in production
- ⚠️ **Local testing only:** Won't work if phone is on different network
- ⚠️ **Security:** Only use on trusted networks

---

## Recommended Workflow

For mobile testing during development:

1. **Quick iterations:** Use ngrok (Option 1)
   - Fast setup
   - HTTPS for microphone testing
   - Easy to restart

2. **Stable testing:** Use Vercel preview (Option 2)
   - Test production-like environment
   - Share with others
   - No local server needed

---

## Troubleshooting

### Microphone Not Working

- **HTTPS Required:** Make sure you're using HTTPS (ngrok/Vercel provide this)
- **Browser Permissions:** Check phone browser settings for microphone permissions
- **Test URL:** Try accessing a simple test page first

### Connection Issues

- **Firewall:** Make sure your firewall allows connections on port 3001
- **Network:** Ensure phone and computer are on same network (for Option 4)
- **ngrok timeout:** Restart ngrok if connection drops (free tier limitation)

### CORS Issues

- Next.js API routes should handle CORS automatically
- If you see CORS errors, check your `next.config.js`

---

## Security Notes

⚠️ **Important:** When using ngrok or localtunnel:
- Your local server is publicly accessible
- Don't expose sensitive data
- Use environment variables for secrets
- Consider using ngrok's IP restrictions (paid feature)

---

## Quick Reference

```bash
# Start dev server
npm run dev

# In another terminal, start ngrok
ngrok http 3001

# Or use localtunnel
lt --port 3001
```

Then open the provided URL on your phone!
