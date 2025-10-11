# iOS App Store Submission Guide for LeedPDF

## Version Information
- **App Version**: 2.14.8
- **Bundle ID**: my.leed.pdf
- **Target**: iOS App Store (iPhone + iPad)
- **Minimum iOS Version**: 13.0

---

## Prerequisites Checklist

Before you start, ensure you have:

- [ ] **Apple Developer Account** (paid membership - $99/year)
- [ ] **App Store Connect** app created with identifier `my.leed.pdf`
- [ ] **iOS App Distribution Certificate** installed in Keychain
- [ ] **iOS Provisioning Profile** for `my.leed.pdf` downloaded
- [ ] **Xcode** installed (latest version recommended)
- [ ] **Transporter** app installed (from Mac App Store) - Optional
- [ ] All dependencies installed (`pnpm install`)
- [ ] **Development Team ID**: 85PR7THRT2 (DoublOne Studios Limited)

---

## Step 1: Verify Certificates in Keychain

Open **Keychain Access** and verify you have:

```bash
# Check available certificates
security find-identity -v -p codesigning
```

You should see:
- `Apple Distribution: DoublOne Studios Limited (85PR7THRT2)`

If missing, download from [Apple Developer Portal](https://developer.apple.com/account/resources/certificates/list).

---

## Step 2: Download iOS Provisioning Profile

1. Go to [Apple Developer Portal - Profiles](https://developer.apple.com/account/resources/profiles/list)
2. Create/Download an **App Store** provisioning profile for `my.leed.pdf`
3. The profile will be automatically used by Xcode during the build process

**Note**: Unlike macOS, you don't need to manually place the provisioning profile. Xcode manages this automatically.

---

## Step 3: Configure App Store Connect

Before building, set up your app in App Store Connect:

1. Go to [App Store Connect](https://appstoreconnect.apple.com/)
2. Click **My Apps** → **+** → **New App**
3. Fill in:
   - **Platform**: iOS
   - **Name**: LeedPDF
   - **Primary Language**: English
   - **Bundle ID**: my.leed.pdf (select from dropdown)
   - **SKU**: leedpdf-ios (or any unique identifier)
   - **User Access**: Full Access

---

## Step 4: Update iOS Configuration

The iOS configuration is already set up in `src-tauri/tauri.ios.json`:

```json
{
  "$schema": "../node_modules/@tauri-apps/cli/config.schema.json",
  "identifier": "my.leed.pdf",
  "bundle": {
    "createUpdaterArtifacts": false,
    "iOS": {
      "developmentTeam": "85PR7THRT2",
      "minimumSystemVersion": "13.0"
    }
  },
  "plugins": {
    "updater": {
      "active": false
    }
  }
}
```

**IMPORTANT**: For App Store builds:
- ✅ `createUpdaterArtifacts` must be `false`
- ✅ `updater` plugin must be inactive
- ✅ License key system is **completely removed** for App Store compliance

---

## Step 5: Build the iOS App

### Part A: Prepare the Build Environment

```bash
# Run the automated build script to set everything up
./build_ios.sh
```

This will:
1. ✅ Check all prerequisites
2. ✅ Install dependencies
3. ✅ Build the web frontend
4. ✅ Install iOS Rust targets
5. ✅ Build for iOS simulator (for testing)
6. ✅ Show instructions for App Store build

### Part B: Build for App Store (Using Xcode)

⚠️ **IMPORTANT**: Due to a Tauri CLI limitation with architecture detection, you **must use Xcode** to build for physical iOS devices (App Store submission).

**Step-by-step:**

1. **Open the Xcode project:**
   ```bash
   open src-tauri/gen/apple/leed-pdf.xcodeproj
   ```

2. **Configure the build:**
   - At the top of Xcode, select the **leed-pdf_iOS** scheme
   - Select **Any iOS Device** (or your connected device) as the destination
   - Ensure **Release** configuration is selected

3. **Create Archive:**
   - Go to **Product** → **Archive**
   - Wait for build to complete (10-20 minutes first time)
   - The **Organizer** window will open automatically

4. **Distribute to App Store:**
   - In Organizer, select your archive
   - Click **Distribute App**
   - Choose **App Store Connect**
   - Choose **Upload**
   - Select **Automatically manage signing** (recommended)
   - Click **Upload**
   - Wait for upload to complete

**Build time**: 
- First build: 15-25 minutes
- Subsequent builds: 5-10 minutes

**Output location** (after archiving):
- Archive: Xcode Organizer → Archives tab
- IPA: Created automatically during distribution

---

## Step 6: Test on Simulator (Optional but Recommended)

Before submitting to the App Store, test on iOS Simulator:

```bash
# Open in Xcode
pnpm tauri ios dev --config src-tauri/tauri.ios.json
```

Or build for simulator:

```bash
pnpm tauri ios build --config src-tauri/tauri.ios.json --target aarch64-apple-ios-sim
```

Test the following:
- ✅ App launches successfully
- ✅ PDF loading from device
- ✅ Drawing tools work with touch/Apple Pencil
- ✅ Export functionality
- ✅ All menus and buttons respond correctly
- ✅ No crashes or errors

---

## Step 7: Upload to App Store Connect

### Option A: Using Xcode Organizer (Recommended)

1. Open **Xcode**
2. Go to **Window** → **Organizer** (or press `Cmd + Shift + 9`)
3. Select the **Archives** tab
4. Find your LeedPDF archive
5. Click **Distribute App**
6. Select **App Store Connect**
7. Select **Upload**
8. Choose automatic signing (or manual if you prefer)
9. Review and click **Upload**
10. Wait for processing (can take 30-60 minutes)

### Option B: Using Transporter App

1. Open **Transporter** app
2. Click **+** or drag `LeedPDF.ipa` into the window
3. Sign in with your Apple ID if prompted
4. Click **Deliver**
5. Wait for validation (can take 5-15 minutes)
6. If validation passes, click **Deliver** again to upload

### Option C: Using Command Line

```bash
# Upload using xcrun altool (requires app-specific password)
xcrun altool --upload-app \
  --type ios \
  --file src-tauri/gen/apple/build/arm64/LeedPDF.ipa \
  --username "your-apple-id@example.com" \
  --password "@keychain:AC_PASSWORD" \
  --verbose
```

**Note**: You'll need an app-specific password stored in keychain as `AC_PASSWORD`.

To create an app-specific password:
1. Go to [appleid.apple.com](https://appleid.apple.com/)
2. Sign in
3. Security → App-Specific Passwords
4. Generate new password
5. Store in keychain:
```bash
xcrun altool --store-password-in-keychain-item "AC_PASSWORD" \
             -u "your-apple-id@example.com" \
             -p "xxxx-xxxx-xxxx-xxxx"
```

---

## Step 8: Prepare App Store Listing

While your build is processing, prepare your App Store listing:

### Required Information

1. **App Information**
   - Name: LeedPDF
   - Subtitle: Draw and Annotate on PDFs
   - Category: Productivity
   - Price: Set your price (or Free if going freemium)

2. **What's New in This Version**
   ```
   Version 2.14.8
   
   - Native iOS app with full iPad and iPhone support
   - Touch-optimized interface with Apple Pencil support
   - All drawing tools: pencil, eraser, highlighter, text, arrows, sticky notes
   - Import PDFs from Files app or iCloud Drive
   - Export annotated PDFs back to Files
   - Offline-first: Your PDFs never leave your device
   - Fast and responsive on all iOS devices
   ```

3. **Description** (4000 character limit)
   ```
   LeedPDF is a powerful, privacy-first PDF viewer and annotation tool designed for iOS. 
   Draw, annotate, and markup your PDFs with ease using your finger or Apple Pencil.

   ✨ KEY FEATURES:
   
   📝 Complete Drawing Toolkit
   - Pencil tool for freehand drawing
   - Eraser for precise corrections
   - Highlighter for marking important text
   - Text tool for adding notes
   - Arrows and shapes
   - Sticky notes for comments
   
   🔒 Privacy First
   - 100% offline - your PDFs never leave your device
   - No account required
   - No tracking or analytics
   - Open source and transparent
   
   📱 iOS-Optimized
   - Touch-optimized interface
   - Full Apple Pencil support with pressure sensitivity
   - Drag and drop support
   - Share Sheet integration
   - Files app integration
   
   ⚡ Performance
   - Fast PDF rendering
   - Smooth drawing experience
   - Works offline
   - Minimal battery usage
   
   💾 Export Options
   - Save as PDF
   - Save as LPDF (with layers)
   - Share via iOS Share Sheet
   
   Perfect for:
   - Students marking up lecture notes
   - Professionals reviewing documents
   - Teachers grading assignments
   - Anyone who needs to annotate PDFs on the go
   
   Download LeedPDF today and experience the best PDF annotation on iOS!
   ```

4. **Keywords** (100 character limit)
   ```
   pdf,annotate,draw,markup,pencil,notes,documents,edit,sign,fill,highlight
   ```

5. **Support URL**
   ```
   https://leed.my/help
   ```

6. **Privacy Policy URL**
   ```
   https://leed.my/privacy
   ```

### Required Screenshots

You need screenshots for:
- **iPhone 6.7"** (iPhone 14 Pro Max): At least 1, up to 10
- **iPhone 6.5"** (iPhone 11 Pro Max): At least 1, up to 10  
- **iPad Pro 12.9"** (6th generation): At least 1, up to 10
- **iPad Pro 12.9"** (2nd generation): At least 1, up to 10

**Screenshot requirements**:
- Format: PNG or JPEG
- Color space: RGB
- No transparency
- High quality

**Tips for great screenshots**:
1. Show the main PDF viewing interface
2. Show drawing tools in action
3. Show annotation features
4. Show export/sharing functionality
5. Use actual PDF content (not placeholder text)
6. Add captions explaining features

---

## Step 9: Submit for Review

1. In App Store Connect, go to your app
2. Select your version (2.14.8)
3. Under **Build**, click **+** and select your uploaded build
4. Fill in all required fields:
   - Screenshots
   - Description
   - Keywords
   - Support URL
   - Privacy Policy URL
   - Age Rating (likely 4+)
   
5. **App Review Information**:
   - Sign-in required: No
   - Demo account: N/A
   - Contact information: Your email and phone
   - Notes: "This is a privacy-first PDF viewer and annotation tool. All processing happens on-device. No backend services required."

6. **Version Release**:
   - Choose: Automatically release this version
   - Or: Manually release this version

7. Answer compliance questions:
   - **Export Compliance**: Does your app use encryption?
     - Answer: No (or Yes if using HTTPS - usually exempt)
   - **Advertising Identifier**: Does your app use advertising?
     - Answer: No
   - **Content Rights**: Do you have the rights to all content?
     - Answer: Yes

8. Click **Submit for Review**

---

## Step 10: Monitor Review Status

After submission:

1. You'll receive an email: "Your submission is in review"
2. Review typically takes 1-3 days
3. Check status in App Store Connect regularly
4. Respond quickly to any feedback from Apple

**Common rejection reasons and solutions**:

| Rejection Reason | Solution |
|-----------------|----------|
| App crashes | Fix crash, submit new build |
| Missing functionality | Ensure all advertised features work |
| Privacy policy issues | Update privacy policy with clear data usage |
| Metadata issues | Fix descriptions/screenshots to match app |
| Guideline 2.3 (duplicate app) | Explain unique value proposition |
| Guideline 4.2 (minimum functionality) | Add more features or better explain existing ones |

---

## Platform-Specific Considerations

### iOS vs macOS vs Windows/Linux

LeedPDF uses **conditional compilation** to maintain a single codebase:

```rust
// License code EXCLUDED from iOS builds (App Store compliance)
#[cfg(not(any(target_os = "macos", target_os = "ios")))]
pub fn activate_license_key() { ... }

// File dialogs only on desktop
#[cfg(not(any(target_os = "android", target_os = "ios")))]
use rfd::FileDialog;

// Native iOS file picker
#[cfg(any(target_os = "ios"))]
// Use Tauri dialog plugin
```

**What's different on iOS**:
- ❌ No license key system (App Store purchases only)
- ❌ No auto-updater (managed by App Store)
- ❌ No native file dialogs (uses iOS Files picker)
- ✅ Touch and Apple Pencil optimized
- ✅ iOS share sheet integration
- ✅ Files app integration

**What's the same**:
- ✅ All drawing tools
- ✅ PDF rendering engine
- ✅ Export functionality
- ✅ Privacy-first approach
- ✅ Offline-first design

---

## Troubleshooting

### Error: "No provisioning profile found"

```bash
# Check if profile exists
ls ~/Library/MobileDevice/Provisioning\ Profiles/

# Download from Apple Developer Portal
# Xcode will automatically install it
```

### Error: "Signing for 'LeedPDF' requires a development team"

Add to `tauri.ios.json`:
```json
{
  "bundle": {
    "iOS": {
      "developmentTeam": "85PR7THRT2"
    }
  }
}
```

### Error: "No code signing identity found"

```bash
# List signing identities
security find-identity -v -p codesigning

# If missing, download from Apple Developer Portal:
# https://developer.apple.com/account/resources/certificates/list
```

### Error: "Failed to build iOS app"

```bash
# Clean and rebuild
cd src-tauri
cargo clean
cd ..
pnpm tauri ios build --config src-tauri/tauri.ios.json
```

### Build fails with frontend errors

```bash
# Clean and rebuild frontend
rm -rf .vercel node_modules/.vite
pnpm install
pnpm build
```

### Build succeeds but app crashes on launch

1. Check Xcode logs in Organizer → Crashes
2. Look for missing entitlements
3. Verify all dependencies are iOS-compatible
4. Test on simulator first

---

## Quick Reference Commands

```bash
# Full build process
pnpm install                                    # Install dependencies
pnpm build                                      # Build web frontend
rustup target add aarch64-apple-ios             # Add iOS target
rustup target add aarch64-apple-ios-sim         # Add iOS simulator target
pnpm tauri ios build \
  --config src-tauri/tauri.ios.json             # Build iOS app

# Or use the automated script
./build_ios.sh

# Development/Testing
pnpm tauri ios dev --config src-tauri/tauri.ios.json     # Run in simulator

# Upload to App Store Connect
# Use Xcode Organizer or Transporter (see Step 7)
```

---

## Version Management

Update version in these files:
- `package.json` → `"version": "2.14.8"`
- `src-tauri/Cargo.toml` → `version = "2.14.8"`
- App Store Connect → Version Number

---

## Important Notes

### Compliance
- ✅ License key system **completely removed** from iOS builds
- ✅ No external payment mechanisms (violates App Store guidelines)
- ✅ App is paid upfront via App Store (or free with In-App Purchases)
- ✅ All features available immediately after purchase
- ✅ No third-party analytics or tracking

### Entitlements
- ✅ File access (user-selected files only)
- ✅ Network client (for loading PDFs from URLs if needed)
- ✅ Associated domains (for deep linking from web)
- ❌ No background modes
- ❌ No push notifications

### App Store Guidelines Compliance
- **Guideline 2.1** - App Completeness: Ensure app is fully functional
- **Guideline 2.3** - Accurate Metadata: Screenshots and description match app
- **Guideline 3.1.1** - In-App Purchase: All purchases through App Store
- **Guideline 4.0** - Design: Follow iOS Human Interface Guidelines
- **Guideline 5.1.1** - Privacy: Clear privacy policy, no unauthorized data collection

---

## Support Resources

- [Tauri iOS Guide](https://tauri.app/v1/guides/building/ios/)
- [Apple Developer Portal](https://developer.apple.com/account/)
- [App Store Connect](https://appstoreconnect.apple.com/)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)

---

## Post-Launch

After your app is approved:

1. **Monitor**:
   - Check reviews in App Store Connect
   - Monitor crash reports
   - Track download metrics

2. **Update**:
   - Plan regular updates (bug fixes + features)
   - Respond to user feedback
   - Keep dependencies up to date

3. **Marketing**:
   - Update website to show iOS availability
   - Social media announcement
   - Product Hunt launch?
   - Blog post about iOS version

---

**Last Updated**: October 2025  
**For**: LeedPDF v2.14.8 iOS App Store Submission

🎉 Good luck with your iOS launch!

