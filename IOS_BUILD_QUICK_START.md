# iOS Build Quick Start Guide

## 🚀 Fast Track to App Store

### Step 1: Prepare Everything (5 minutes)
```bash
./build_ios.sh
```

This builds the frontend and creates a simulator build for testing.

---

### Step 2: Build for App Store (20 minutes)

⚠️ **You must use Xcode** for physical device builds (Tauri CLI has an architecture detection bug).

```bash
# 1. Open Xcode project
open src-tauri/gen/apple/leed-pdf.xcodeproj
```

**In Xcode:**
1. Select **leed-pdf_iOS** scheme (top-left)
2. Select **Any iOS Device** as destination
3. **Product** → **Archive**
4. Wait for build (~15 minutes first time)

---

### Step 3: Upload to App Store

When Archive completes:
1. **Xcode Organizer** opens automatically
2. Select your archive
3. Click **Distribute App**
4. Choose **App Store Connect**
5. Choose **Upload**
6. Select **Automatically manage signing**
7. Click **Upload**

---

### Step 4: Submit for Review

1. Go to [App Store Connect](https://appstoreconnect.apple.com/)
2. Select **LeedPDF**
3. Go to version 2.14.8
4. Click **+** to add your build
5. Fill in all required information
6. Submit for review

---

## 🧪 Test Before Submitting

### Test on Simulator:
```bash
pnpm tauri ios dev --config src-tauri/tauri.ios.json
```

### Test Checklist:
- [ ] App launches without crashes
- [ ] Can import PDF from Files
- [ ] Drawing tools work with touch
- [ ] Can export annotated PDF
- [ ] All buttons respond correctly

---

## ⚡ Common Issues

### "No signing identity found"
→ Download iOS Distribution certificate from Apple Developer Portal

### "Provisioning profile doesn't match"  
→ Download iOS App Store provisioning profile for `my.leed.pdf`

### "Build failed in Xcode"
→ Check the build log for specific errors
→ Ensure you're on the latest Xcode version

---

## 📚 Full Documentation

See [IOS_APP_STORE_SUBMISSION.md](IOS_APP_STORE_SUBMISSION.md) for complete details.

---

## ✅ What's Different from macOS

| Feature | macOS | iOS |
|---------|-------|-----|
| Build Tool | Tauri CLI ✅ | Xcode (CLI has bugs) |
| License Keys | ❌ Excluded | ❌ Excluded |
| Auto-Updater | ❌ Excluded | ❌ Excluded |
| File Dialogs | Native | iOS Files picker |
| All Drawing Tools | ✅ Yes | ✅ Yes |

---

**TL;DR:**
1. Run `./build_ios.sh`
2. Open Xcode: `open src-tauri/gen/apple/leed-pdf.xcodeproj`
3. Product → Archive
4. Distribute to App Store Connect
5. Submit in App Store Connect

🎉 You're ready to ship!

