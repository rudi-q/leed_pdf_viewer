# Mac App Store Submission Guide for LeedPDF

## Version Information
- **App Version**: 2.14.6
- **Bundle ID**: my.leed.pdf
- **Target**: Mac App Store (Apple Silicon + Intel)

---

## Prerequisites Checklist

Before you start, ensure you have:

- [ ] **Apple Developer Account** (paid membership)
- [ ] **App Store Connect** app created with identifier `my.leed.pdf`
- [ ] **Mac App Distribution Certificate** installed in Keychain
- [ ] **Mac Installer Distribution Certificate** installed in Keychain
- [ ] **Provisioning Profile** for `my.leed.pdf` downloaded from Apple Developer Portal
- [ ] **Xcode Command Line Tools** installed (`xcode-select --install`)
- [ ] **Transporter** app installed (from Mac App Store)
- [ ] All dependencies installed (`pnpm install`)

---

## Step 1: Verify Certificates in Keychain

Open **Keychain Access** and verify you have:

```bash
# Check available certificates
security find-identity -v -p codesigning
```

You should see:
- `3rd Party Mac Developer Application: DoublOne Studios Limited (85PR7THRT2)`
- `3rd Party Mac Developer Installer: DoublOne Studios Limited (85PR7THRT2)`

If missing, download from [Apple Developer Portal](https://developer.apple.com/account/resources/certificates/list).

---

## Step 2: Download Provisioning Profile

1. Go to [Apple Developer Portal - Profiles](https://developer.apple.com/account/resources/profiles/list)
2. Create/Download a **Mac App Store** provisioning profile for `my.leed.pdf`
3. Save it as `embedded.provisionprofile` in the `src-tauri` directory:

```bash
# Download and save to project
cp ~/Downloads/YourProfile.provisionprofile src-tauri/embedded.provisionprofile
```

---

## Step 3: Update Tauri Configuration for App Store

The `tauri.appstore.json` file will be merged with your main config. Verify it contains:

```json
{
  "$schema": "../node_modules/@tauri-apps/cli/config.schema.json",
  "identifier": "my.leed.pdf",
  "bundle": {
    "createUpdaterArtifacts": false
  },
  "plugins": {
    "updater": {
      "active": false
    }
  }
}
```

**IMPORTANT**: For App Store builds, you need to temporarily update `tauri.conf.json`:

```json
"macOS": {
  "entitlements": "entitlements.plist",
  "provisioningProfile": "embedded.provisionprofile",
  "signingIdentity": "3rd Party Mac Developer Application: DoublOne Studios Limited (85PR7THRT2)",
  "hardenedRuntime": false
}
```

Note: `hardenedRuntime` must be `false` for App Store builds (it's handled by App Store sandbox).

---

## Step 4: Build the Web Frontend

```bash
# Build the web assets
pnpm build
```

This creates the static frontend in `.vercel/output/static/`.

---

## Step 5: Build the App Store Package

```bash
# Clean previous builds
rm -rf src-tauri/target/universal-apple-darwin/release/bundle

# Build universal binary for App Store
pnpm tauri build --config src-tauri/tauri.appstore.json --target universal-apple-darwin
```

This will:
- Build for both Apple Silicon (aarch64) and Intel (x86_64)
- Create a universal binary
- Sign with your App Store certificate
- Embed the provisioning profile
- Create a `.app` bundle

**Build output location**:
```
src-tauri/target/universal-apple-darwin/release/bundle/macos/LeedPDF.app
```

---

## Step 6: Create App Store Package (.pkg)

After building the `.app`, create a signed `.pkg` for submission:

```bash
# Navigate to the bundle directory
cd src-tauri/target/universal-apple-darwin/release/bundle/macos

# Create a signed .pkg file
productbuild --component LeedPDF.app /Applications --sign "3rd Party Mac Developer Installer: DoublOne Studios Limited (85PR7THRT2)" LeedPDF.pkg
```

This creates `LeedPDF.pkg` signed with your installer certificate.

---

## Step 7: Verify the Package

Before uploading, verify the package is properly signed:

```bash
# Verify app signature
codesign -dv --verbose=4 LeedPDF.app

# Verify pkg signature
pkgutil --check-signature LeedPDF.pkg

# Verify provisioning profile is embedded
codesign -d --entitlements - LeedPDF.app
```

Expected output:
- App should show "3rd Party Mac Developer Application"
- PKG should show "3rd Party Mac Developer Installer"
- No errors or warnings

---

## Step 8: Upload to App Store Connect with Transporter

### Option A: Using Transporter GUI (Recommended)

1. Open **Transporter** app
2. Click **+** or drag `LeedPDF.pkg` into the window
3. Click **Deliver**
4. Sign in with your Apple ID if prompted
5. Wait for validation (can take 5-15 minutes)
6. If validation passes, click **Deliver** again to upload

### Option B: Using Command Line

```bash
# Upload using xcrun altool
xcrun altool --upload-app \
  --type osx \
  --file LeedPDF.pkg \
  --username "your-apple-id@example.com" \
  --password "@keychain:AC_PASSWORD" \
  --verbose
```

**Note**: You'll need an app-specific password stored in keychain as `AC_PASSWORD`.

---

## Step 9: Monitor Upload Status

After upload:

1. Go to [App Store Connect](https://appstoreconnect.apple.com/)
2. Select **LeedPDF** app
3. Go to **TestFlight** tab
4. Wait for "Processing" to complete (can take 30-60 minutes)
5. Once processed, you'll see version 2.14.6 appear

---

## Step 10: Submit for Review

1. In App Store Connect, go to **App Store** tab
2. Click **+ Version** or select existing version
3. Fill in:
   - **Version Number**: 2.14.6
   - **What's New**: Release notes
   - **Screenshots**: Required (1280x800 minimum)
   - **Description**: App description
   - **Keywords**: Search keywords
   - **Support URL**: https://leed.my/help
   - **Privacy Policy URL**: https://leed.my/privacy
4. Select the build (2.14.6)
5. Answer compliance questions:
   - **Export Compliance**: No (app doesn't use encryption beyond what Apple provides)
   - **Advertising Identifier**: No
6. Click **Submit for Review**

---

## Troubleshooting

### Error: "No signing identity found"

```bash
# List all signing identities
security find-identity -v -p codesigning

# Import certificate from .p12 file if needed
security import certificate.p12 -k ~/Library/Keychains/login.keychain
```

### Error: "Provisioning profile doesn't match"

- Ensure bundle ID in provisioning profile matches `my.leed.pdf`
- Download fresh profile from Apple Developer Portal
- Verify profile is in `src-tauri/embedded.provisionprofile`

### Error: "Invalid entitlements"

- Ensure using `entitlements.plist` (NOT `entitlements-developerid.plist`)
- Verify no `com.apple.security.cs.allow-unsigned-executable-memory` in entitlements
- Check App Sandbox is enabled

### Error: "Package validation failed"

```bash
# Validate package manually
xcrun altool --validate-app \
  --type osx \
  --file LeedPDF.pkg \
  --username "your-apple-id@example.com" \
  --password "@keychain:AC_PASSWORD"
```

### Build fails with frontend errors

```bash
# Clean and rebuild
rm -rf .vercel node_modules/.vite
pnpm install
pnpm build
```

### Build fails with Rust errors

```bash
# Clean Rust build cache
cd src-tauri
cargo clean
cd ..

# Rebuild
pnpm tauri build --config src-tauri/tauri.appstore.json --target universal-apple-darwin
```

---

## Quick Reference Commands

```bash
# Full build process (run from project root)
pnpm install                                    # Install dependencies
pnpm build                                      # Build web frontend
pnpm tauri build \
  --config src-tauri/tauri.appstore.json \
  --target universal-apple-darwin               # Build universal app

# Create pkg (run from bundle directory)
cd src-tauri/target/universal-apple-darwin/release/bundle/macos
productbuild \
  --component LeedPDF.app /Applications \
  --sign "3rd Party Mac Developer Installer: DoublOne Studios Limited (85PR7THRT2)" \
  LeedPDF.pkg

# Verify
codesign -dv --verbose=4 LeedPDF.app
pkgutil --check-signature LeedPDF.pkg

# Upload with Transporter GUI or:
xcrun altool --upload-app \
  --type osx \
  --file LeedPDF.pkg \
  --username "your-apple-id@example.com" \
  --password "@keychain:AC_PASSWORD"
```

---

## Important Notes

### Compliance
- ✅ License key system is **completely removed** from macOS builds (see `APPLE_APP_STORE_COMPLIANCE.md`)
- ✅ No external payment mechanisms
- ✅ App is paid upfront via App Store
- ✅ All features available immediately after purchase

### Entitlements
- Using `entitlements.plist` (App Store compatible)
- App Sandbox enabled
- Network client access (for loading PDFs from URLs)
- User-selected file read/write access
- JIT compilation allowed

### Version Management
- Current version: **2.14.6**
- Update version in:
  - `package.json`
  - `src-tauri/Cargo.toml`
  - App Store Connect

---

## Support

If you encounter issues:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review Apple's [App Store Connect Help](https://developer.apple.com/help/app-store-connect/)
3. Check [Tauri macOS Distribution Guide](https://tauri.app/v1/guides/distribution/macos/)

---

**Last Updated**: October 2025  
**For**: LeedPDF v2.14.6 Mac App Store Submission

