# Security Policy

## Supported Versions

We actively support the following versions of LeedPDF with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.1.x   | :white_check_mark: |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously and appreciate responsible disclosure.

**How to Report:**
- **Email**: reach@rudi.engineer
- **Subject Line**: [SECURITY] Brief description of the issue
- **GitHub**: Use the Security tab in our repository for private reporting

**What to Include:**
- Detailed description of the vulnerability
- Steps to reproduce the issue
- Potential impact assessment
- Any proof-of-concept code (if applicable)

**Response Timeline:**
- **Initial Response**: Within 7 days of report
- **Status Updates**: As needed until resolved
- **Resolution**: Critical issues within 2 weeks, others within 30 days

**What to Expect:**
- **Accepted**: We'll work with you on disclosure timeline and may offer recognition
- **Declined**: We'll explain why and suggest alternative reporting if applicable
- **Duplicate**: We'll let you know if it's already been reported

**Responsible Disclosure:**
Please allow us reasonable time to fix the issue before public disclosure. We're committed to keeping users safe and will work quickly on legitimate security concerns.

---

## Comprehensive Security Policy

### Table of Contents
1. [Introduction](#introduction)
2. [Security Architecture](#security-architecture)
3. [Data Protection & Privacy](#data-protection--privacy)
4. [Client-Side Application Security](#client-side-application-security)
5. [PDF Processing Security](#pdf-processing-security)
6. [Dependency Management](#dependency-management)
7. [User Security Guidelines](#user-security-guidelines)
8. [Incident Response](#incident-response)
9. [Security Monitoring](#security-monitoring)
10. [Compliance & Standards](#compliance--standards)

---

## Introduction

**Effective Date:** August 2025  
**Version:** 1.0  
**Scope:** This policy applies to the LeedPDF open-source project and all its components.

LeedPDF is a privacy-first, client-side PDF annotation tool built with SvelteKit that prioritizes user data protection by ensuring all processing occurs locally in the user's browser without server uploads.

### Core Security Principles
- **Privacy by Design**: No data leaves the user's device
- **Zero Trust Client-Side**: Assume all client-side code can be inspected and modified
- **Defense in Depth**: Multiple layers of security controls
- **Transparency**: Open-source allows public security auditing

---

## Security Architecture

### Client-Side Only Architecture
LeedPDF operates entirely within the user's browser, eliminating server-side attack vectors:

- **No Backend Dependencies**: Application runs independently of server infrastructure
- **Local Processing**: All PDF rendering and annotation processing occurs client-side
- **Browser Sandbox**: Leverages browser security model for process isolation
- **Progressive Web App (PWA)**: Provides offline capability with service worker security

### Technology Stack Security
- **SvelteKit Framework**: Provides built-in XSS protection through automatic escaping
- **PDF.js Engine**: Mozilla's JavaScript-based PDF renderer
- **HTML5 Canvas**: 2D drawing for annotations
- **Vite Build Tool**: Modern bundler with security-focused defaults

### Security Boundaries
- **Browser Security Model**: Primary security boundary
- **Same-Origin Policy**: Enforces domain isolation
- **Content Security Policy**: Restricts resource loading and script execution
- **Service Worker Scope**: Isolated PWA functionality

---

## Data Protection & Privacy

### Data Handling Principles
- **No Server Transmission**: PDF documents never leave the user's device
- **Local Storage Only**: Annotations saved locally using browser storage APIs
- **Ephemeral Processing**: PDF content remains in memory only during active use
- **User-Controlled Data**: Users maintain full control over their documents

### Browser Storage Security
```javascript
// Secure storage implementation
const secureStorage = {
  // Use IndexedDB for large binary data
  async saveAnnotations(docId, annotations) {
    // Validate data before storage
    if (!this.validateAnnotationData(annotations)) {
      throw new Error('Invalid annotation data');
    }
    // Store with encryption if sensitive
    return await idb.put('annotations', { docId, data: annotations });
  },
  
  // Clear storage on session end
  async clearSensitiveData() {
    await idb.clear('annotations');
    sessionStorage.clear();
  }
};
```

### Data Minimization
- **Essential Data Only**: Store only necessary annotation and user preference data
- **Automatic Cleanup**: Implement automatic deletion of old annotation data
- **No Telemetry**: No usage tracking or analytics collection
- **Optional Features**: All data collection features must be opt-in

### Privacy Controls
- **Explicit Consent**: Clear consent mechanisms for any data storage
- **Data Portability**: Easy export/import of user annotations
- **Right to Delete**: Simple mechanism to clear all stored data
- **Transparency**: Clear documentation of what data is stored and where

---

## Client-Side Application Security

### Content Security Policy (CSP)
*Note: CSP implementation is planned for future releases to enhance XSS protection.*

### Input Validation & Sanitization
Currently implemented basic validations:
- **PDF Upload Validation**: File type verification (PDF only)
- **File Size Limits**: 50MB maximum file size enforced
- **URL Parameter Validation**: Basic URL format validation for PDF loading
- **File Type Checking**: Ensures uploaded files are PDF format

```javascript
// Current file validation implementation
if (!file.type.includes('pdf')) {
  throw new Error('Invalid file type');
}

if (file.size > 50 * 1024 * 1024) {
  throw new Error('File too large');
}
```

### XSS Prevention
Basic XSS prevention through SvelteKit's built-in protections:
- **Automatic Escaping**: SvelteKit automatically escapes content in templates
- **Component Isolation**: Svelte component architecture provides natural isolation
- **Framework Protection**: Leverages SvelteKit's security defaults

*Note: Additional XSS prevention measures are planned for future implementation.*

### Secure Communication
- **HTTPS Recommended**: Encourage HTTPS for PDF URL loading
- **Browser Security**: Relies on browser's built-in security model
- **No Mixed Content**: Avoid loading insecure resources when possible

*Note: Additional security headers and HSTS implementation planned for future releases.*

---

## PDF Processing Security

### PDF.js Security Considerations
Current PDF processing approach:

- **JavaScript Disabled**: PDF.js is used primarily for rendering, not executing PDF scripts
- **Limited PDF Features**: Focus on static content rendering and annotation overlay
- **File Size Limits**: 50MB maximum to prevent DoS attacks
- **Basic Validation**: File type and format checking before processing

*Note: Enhanced PDF.js security configuration (explicitly disabling isEvalSupported, forms, etc.) is planned for implementation to address CVE-2024-4367 and other vulnerabilities.*

### PDF Content Validation
- **Malware Detection**: Basic checks for suspicious PDF content
- **File Size Limits**: Prevent extremely large files that could cause DoS
- **Page Count Limits**: Reasonable limits on document complexity
- **Font Validation**: Validate embedded fonts to prevent font-based attacks

### Current PDF Processing
Basic security measures currently implemented:

```javascript
// Current file validation (from the codebase)
if (!file.type.includes('pdf')) {
  alert('Please select a PDF file');
  return;
}

if (file.size > 50 * 1024 * 1024) { // 50MB limit
  alert('File too large. Please choose a file under 50MB.');
  return;
}

// URL validation for PDF loading
function isValidPdfUrl(url: string): boolean {
  try {
    const validUrl = new URL(url);
    return validUrl.protocol === 'https:' || validUrl.protocol === 'http:';
  } catch {
    return false;
  }
}
```

### JavaScript in PDFs
- **Limited PDF Script Support**: Focus on static PDF content rendering rather than dynamic scripts
- **Annotation Overlay**: LeedPDF's annotations are separate from PDF content, not embedded scripts
- **Reduced Attack Surface**: By focusing on rendering rather than executing PDF scripts
- **Future Hardening**: Plans to explicitly disable PDF JavaScript execution for enhanced security

*Note: Enhanced PDF.js security configuration is planned for future implementation to explicitly address CVE-2024-4367.*

---

## Dependency Management

### Supply Chain Security
Current dependency management practices:
- **Package Lock Files**: Using pnpm lock files to ensure consistent dependency versions
- **Manual Review**: Dependency updates reviewed manually before implementation
- **Minimal Dependencies**: Limited third-party dependencies to reduce attack surface
- **Version Tracking**: Dependencies tracked in package.json with specific version ranges

### Critical Dependencies
Key dependencies that require security attention:

```json
{
  "pdfjs-dist": "5.4.54",
  "svelte": "^5.38.1",
  "pdf-lib": "^1.17.1"
}
```

*Note: Automated vulnerability scanning and dependency auditing tools are planned for implementation.*

### Update Policy
Currently manual update process:
- **Security Updates**: Reviewed and applied as needed
- **Regular Updates**: Dependencies updated manually during development cycles
- **Testing**: Changes tested locally before deployment

*Note: Automated update policies and CI/CD integration planned for future implementation.*

---

## User Security Guidelines

### Safe Usage Practices
- **Document Source Verification**: Only open PDFs from trusted sources
- **Public Network Awareness**: Exercise caution when using on public Wi-Fi
- **Browser Updates**: Keep browser updated for latest security patches
- **Extension Awareness**: Be cautious of browser extensions that might interfere

### File Handling Security
- **Local Storage Awareness**: Understand that annotations are saved locally
- **Device Security**: Ensure device-level security (screen locks, encryption)
- **Shared Device Caution**: Clear data when using shared/public computers
- **Backup Security**: Secure any exported annotation files

### Browser Compatibility
- **Supported Browsers**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Security Features Required**: JavaScript enabled, modern CSS support
- **Private Browsing**: Note that private browsing may limit functionality
- **Browser Security Settings**: Recommended security configurations

---

## Incident Response

### Security Incident Classification
- **Critical**: Vulnerability allowing arbitrary code execution
- **High**: Data exposure or significant privacy breach
- **Medium**: Functional security bypass or DoS vulnerability
- **Low**: Minor security hardening opportunities

### Response Timeline
- **Critical**: Acknowledge within 7 days, aim for fix within 2 weeks
- **High**: Acknowledge within 7 days, aim for fix within 3 weeks  
- **Medium**: Acknowledge within 2 weeks, aim for fix within 1 month
- **Low**: Address in next regular release cycle

### Communication
- **GitHub Security Advisory**: For confirmed vulnerabilities
- **Release Notes**: Document security fixes in releases
- **README Updates**: Update documentation if needed for security
- **Community Notice**: Inform users via GitHub releases for critical issues

### Reporting Channels
```markdown
## Security Vulnerability Reporting

- **Email**: reach@rudi.engineer
- **GitHub**: Security tab on repository  
- **Response Time**: 7 days acknowledgment
- **Subject**: [SECURITY] Brief description
```

---

## Security Monitoring

### Automated Security Scanning
- **Dependency Scanning**: Daily automated dependency vulnerability scans
- **Code Analysis**: Static analysis security testing (SAST) on all commits
- **Container Scanning**: Security scan of deployment containers
- **License Compliance**: Monitor for license changes in dependencies

### Security Practices
- **Manual Review**: Security considerations in development and pull request reviews
- **Community Reporting**: Rely on open source community for vulnerability discovery
- **Issue Tracking**: Monitor GitHub issues for security concerns
- **Dependency Awareness**: Stay informed about security advisories for key dependencies

*Note: Automated dependency scanning, metrics tracking, and formal security monitoring are planned for future implementation.*

---

## Compliance & Standards

### Security Guidelines We Follow
- **OWASP Top 10**: Use as reference for common web application security risks
- **OWASP Client-Side Top 10**: Specific focus on browser-based security concerns
- **Mozilla Security Guidelines**: Follow Mozilla's recommendations for web security
- **SvelteKit Security Best Practices**: Implement framework-specific security measures

### Privacy Approach
- **Privacy by Design**: Built-in privacy protection through client-side architecture
- **Data Minimization**: Store only essential data (annotations, preferences)
- **User Control**: Users have full control over their data and can clear it anytime
- **No Tracking**: No analytics, telemetry, or user behavior tracking

### Development Practices
- **Secure Defaults**: Security-focused configuration out of the box
- **Regular Dependency Updates**: Keep dependencies updated for security patches
- **Community Input**: Welcome security feedback from the open source community
- **Transparency**: Open source code allows public security review

---

## Security Contact Information

**Security Team Email**: reach@rudi.engineer  
**Response Time**: 7 days for initial response  
**GitHub Security**: Use the Security tab in the repository  
**Subject Line**: [SECURITY] Brief description of issue  

### Responsible Disclosure
We follow responsible disclosure practices and request that security researchers:
- Report vulnerabilities privately first
- Allow reasonable time for fixes
- Avoid testing against production systems
- Respect user privacy and data

---

*This security policy is a living document and will be updated regularly to address emerging threats and security best practices. Last updated: August 2025*
