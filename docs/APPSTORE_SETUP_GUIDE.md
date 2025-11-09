# App Store Setup Guide - DO THIS FIRST!

## ⚠️ IMPORTANT: Required Setup Before Building

You're **almost ready** to build! Here's what you need to do:

---

## ✅ What You Already Have

- ✅ **App Signing Certificate** - Found in Keychain:
  - `3rd Party Mac Developer Application: DoublOne Studios Limited (85PR7THRT2)`

---

## ❌ What You Still Need

### 1. Mac Installer Distribution Certificate

**Status**: ❌ NOT FOUND in your Keychain

**How to get it**:

1. Go to [Apple Developer Portal - Certificates](https://developer.apple.com/account/resources/certificates/list)
2. Click **+** to create a new certificate
3. Select **Mac Installer Distribution**
4. Follow the prompts to create a Certificate Signing Request (CSR):
   - Open **Keychain Access** app
   - Menu: **Keychain Access** → **Certificate Assistant** → **Request a Certificate from a Certificate Authority**
   - Email: your-email@example.com
   - Common Name: DoublOne Studios Limited
   - Select: **Saved to disk**
   - Click **Continue** and save the file
5. Upload the CSR file to Apple Developer Portal
6. Download the certificate file (`.cer`)
7. Double-click to install it in Keychain

**Expected result**: Certificate named:
```
3rd Party Mac Developer Installer: DoublOne Studios Limited (85PR7THRT2)
```

---

### 2. Provisioning Profile

**Status**: ❌ NOT FOUND at `src-tauri/embedded.provisionprofile`

**How to get it**:

1. Go to [Apple Developer Portal - Profiles](https://developer.apple.com/account/resources/profiles/list)
2. Click **+** to create a new profile
3. Select **Mac App Store** under **Distribution**
4. Select your App ID: `my.leed.pdf` (or create it if it doesn't exist)
5. Select your **Mac App Distribution** certificate
6. Click **Continue** and give it a name like "LeedPDF Mac App Store"
7. Download the profile (`.provisionprofile` file)
8. Save it as:
   ```bash
   /Users/zoegilbert/Studios/leed_pdf_viewer/src-tauri/embedded.provisionprofile
   ```

**Quick command to move it**:
```bash
# After downloading, move it:
cp ~/Downloads/YourProfile.provisionprofile src-tauri/embedded.provisionprofile
```

---

## 🚀 After You Have Both Certificates and Profile

Once you have:
- ✅ 3rd Party Mac Developer Application certificate (YOU HAVE THIS)
- ✅ 3rd Party Mac Developer Installer certificate (NEED TO DOWNLOAD)
- ✅ Provisioning profile at `src-tauri/embedded.provisionprofile` (NEED TO DOWNLOAD)

Then run:

```bash
./build_appstore.sh
```

This script will:
1. ✅ Check all certificates and profiles
2. ✅ Clean previous builds
3. ✅ Install dependencies
4. ✅ Build the web frontend
5. ✅ Build the universal macOS app
6. ✅ Sign with App Store certificate
7. ✅ Create the `.pkg` installer
8. ✅ Verify signatures
9. ✅ Output the final package ready for Transporter

---

## 📋 Quick Checklist

Copy this and check off as you complete each step:

```
[ ] 1. Download Mac Installer Distribution certificate from Apple Developer Portal
[ ] 2. Install certificate in Keychain (double-click .cer file)
[ ] 3. Verify installer certificate appears in Keychain Access
[ ] 4. Download Mac App Store provisioning profile
[ ] 5. Save profile as src-tauri/embedded.provisionprofile
[ ] 6. Run: ./build_appstore.sh
[ ] 7. Wait for build to complete (10-15 minutes)
[ ] 8. Upload .pkg file using Transporter app
```

---

## 🔍 Verify Certificates (Run This Now)

Check what certificates you currently have:

```bash
security find-identity -v -p codesigning
```

You should see:
- `3rd Party Mac Developer Application: DoublOne Studios Limited (85PR7THRT2)` ✅ YOU HAVE THIS
- `3rd Party Mac Developer Installer: DoublOne Studios Limited (85PR7THRT2)` ❌ YOU NEED THIS

---

## ❓ Troubleshooting

### "I can't find my App ID in the portal"

Create it:
1. Go to [Identifiers](https://developer.apple.com/account/resources/identifiers/list)
2. Click **+**
3. Select **App IDs** → **App**
4. Bundle ID: `my.leed.pdf`
5. Description: LeedPDF
6. Capabilities: Leave defaults
7. Click **Register**

### "Certificate is not trusted"

Make sure the **Apple Worldwide Developer Relations Certificate** is in your Keychain. Download from:
https://www.apple.com/certificateauthority/

### "I already have these but the script doesn't find them"

Check the exact names match. Run:
```bash
security find-identity -v -p codesigning | grep "DoublOne"
```

The names must exactly match:
- `3rd Party Mac Developer Application: DoublOne Studios Limited (85PR7THRT2)`
- `3rd Party Mac Developer Installer: DoublOne Studios Limited (85PR7THRT2)`

---

## 📞 Need Help?

- Check the full guide: `MAC_APP_STORE_SUBMISSION.md`
- Apple Developer Support: https://developer.apple.com/contact/

---

## ⏭️ Next Steps

1. **Complete the checklist above** ☝️
2. **Run `./build_appstore.sh`**
3. **Upload to App Store Connect with Transporter**

You're almost there! 🎉

