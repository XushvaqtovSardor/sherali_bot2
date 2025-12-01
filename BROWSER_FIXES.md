# 🔧 Browser Stability Fixes - Screenshot Service

## ❌ Muammolar

Loglardan ko'rilgan muammolar:
1. **Page crashed!** - Chrome renderer crashes
2. **Navigation timeout** - 30s timeout issues  
3. **Target closed** - Browser connection lost
4. **Connection closed** - Protocol errors
5. **Memory leaks** - Too many pages open

## ✅ Yechimlar

### 1. Browser Launch Arguments (browser.service.ts)

```typescript
// Added stability flags:
"--single-process"           // Prevents multi-process crashes in containers
"--no-zygote"               // Reduces memory overhead
"--disable-features=IsolateOrigins,site-per-process"
"--disable-background-timer-throttling"
"--disable-backgrounding-occluded-windows"
"--disable-renderer-backgrounding"

// Increased timeouts:
protocolTimeout: 60000      // 60s instead of default 30s
```

### 2. Page Lifecycle Management

**Before:**
- Pages never cleaned up
- No event listeners
- No memory management

**After:**
```typescript
// Event handlers for crashes:
page.on("error", (error) => { ... })
page.on("pageerror", (error) => { ... })

// Request interception to block unnecessary resources:
page.on("request", (request) => {
  if (["font", "media", "websocket"].includes(resourceType)) {
    request.abort(); // Save memory & bandwidth
  }
})

// Timeouts increased:
page.setDefaultTimeout(60000)
page.setDefaultNavigationTimeout(60000)
```

### 3. Page Cleanup with Event Listener Removal

```typescript
async closePage(key: string): Promise<void> {
  if (page && !page.isClosed()) {
    page.removeAllListeners(); // Prevent memory leaks!
    await page.close();
  }
  this.pages.delete(key);
}
```

### 4. Automatic Idle Page Cleanup

```typescript
// Limit max open pages to prevent memory issues
async cleanupIdlePages(maxPages: number = 10): Promise<void> {
  if (this.pages.size > maxPages) {
    // Close oldest pages
  }
}
```

### 5. Screenshot Processing Retry Logic

**Before:** 1 attempt → fail

**After:**
```typescript
let retries = 2;
while (retries >= 0) {
  try {
    // Cleanup idle pages first
    await this.browserService.cleanupIdlePages(5);
    
    // Navigate with fallback
    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    } catch (navError) {
      // Retry with less strict condition
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    }
    
    // Screenshot with timeout
    await page.screenshot({ timeout: 60000 });
    
    return; // Success!
  } catch (error) {
    retries--;
    await this.browserService.closePage(cacheKey); // Clean up crashed page
    await new Promise(r => setTimeout(r, 5000)); // Wait before retry
  }
}
```

## 📊 Expected Improvements

| Metric | Before | After |
|--------|--------|-------|
| Success Rate | ~60% | ~95%+ |
| Page Crashes | Frequent | Rare |
| Memory Usage | Growing | Stable |
| Timeout Errors | Common | Uncommon |
| Navigation Failures | 30s hard fail | 60s + retry |

## 🚀 Deployment

### Option 1: Git Push (Render/Railway auto-deploy)

```bash
git add .
git commit -m "fix: browser stability improvements with retry logic"
git push origin main
```

Render/Railway will auto-deploy when detecting changes.

### Option 2: Manual Deploy

1. Build locally:
```bash
pnpm run build
```

2. Upload `dist/` folder to server

3. Restart service:
```bash
pm2 restart tsue-bot
# OR
systemctl restart tsue-bot
```

## 🔍 Monitoring

After deployment, check logs for:

```bash
# Good signs:
✅ "Browser initialized successfully"
✅ "Screenshot saved to Firebase: ..."
✅ "Cleaned up idle page: ..."

# Should be rare now:
⚠️ "Page crashed!"
⚠️ "Navigation timeout"
⚠️ "All retries exhausted"
```

## 🎯 Next Steps

1. **Deploy changes**
2. **Monitor for 24 hours**
3. If still seeing crashes:
   - Increase `protocolTimeout` to 90000
   - Reduce `PUPPETEER_CONCURRENCY` from 7 to 5
   - Add more aggressive page cleanup (max 3 pages)

## 📝 Configuration Tuning

If you have limited memory (< 2GB):

```env
# .env
PUPPETEER_CONCURRENCY=3  # Reduce from 7
```

In `browser.service.ts`:
```typescript
await this.browserService.cleanupIdlePages(3); // Reduce from 5
```
