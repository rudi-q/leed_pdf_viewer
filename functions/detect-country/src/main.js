// Appwrite Function for EU Cookie Detection (Production Ready)
// Runtime: Node.js 18.0

// EU country codes (including UK for safety)
const euCountries = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'GB'
];

// Extract real IP from headers (skip internal IPs)
function getRealIP(req) {
  const possibleIPs = [
    req.headers['x-forwarded-for']?.split(',')[0]?.trim(),
    req.headers['x-real-ip'],
    req.headers['cf-connecting-ip'],
    req.headers['x-client-ip'],
    req.headers['true-client-ip'],
    req.ip
  ];

  // Find first valid external IP
  for (const ip of possibleIPs) {
    if (ip && !isInternalIP(ip)) {
      return ip;
    }
  }

  // Fallback to any IP we have
  return possibleIPs.find(ip => ip) || '8.8.8.8';
}

// Check if IP is internal/private
function isInternalIP(ip) {
  if (!ip) return true;
  return ip.startsWith('10.') || 
         ip.startsWith('192.168.') || 
         ip.startsWith('172.') ||
         ip.startsWith('127.') ||
         ip === 'localhost';
}

// Get country from IP via geolocation API
async function getCountryFromIP(ip) {
  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode`);
    const data = await response.json();
    return data.countryCode || null;
  } catch (error) {
    console.log('Geolocation failed:', error);
    return null;
  }
}

module.exports = async ({ req, res, log, error }) => {
  // Handle CORS for web requests
  if (req.method === 'OPTIONS') {
    return res.json({}, 200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
  }

  try {
    const ip = getRealIP(req);
    log(`Processing request from IP: ${ip}`);
    
    // Get country from IP
    const countryCode = await getCountryFromIP(ip);
    const isEU = countryCode && euCountries.includes(countryCode);
    
    log(`Country: ${countryCode}, Is EU: ${isEU}`);

    // API endpoint - return JSON for your frontend
    if (req.path === '/api/check-eu' || req.method === 'POST') {
      return res.json({
        country: countryCode,
        isEU: isEU,
        showCookieBanner: isEU
      }, 200, {
        'Access-Control-Allow-Origin': '*'
      });
    }

    // Default: return HTML page for testing
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>LeedPDF - EU Cookie Detection</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            margin: 40px; 
            line-height: 1.6;
          }
          .info { 
            background: #f8f9fa; 
            padding: 20px; 
            border-radius: 8px; 
            margin-bottom: 20px; 
            border-left: 4px solid #007cba;
          }
          .cookie-banner { 
            position: fixed; 
            bottom: 0; 
            left: 0; 
            right: 0; 
            background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); 
            color: white; 
            padding: 20px; 
            text-align: center;
            display: ${isEU ? 'block' : 'none'};
            box-shadow: 0 -4px 20px rgba(0,0,0,0.3);
            z-index: 1000;
          }
          .cookie-banner p {
            margin: 0 0 15px 0;
            font-size: 14px;
          }
          .cookie-banner button {
            background: #007cba;
            color: white;
            border: none;
            padding: 12px 24px;
            margin: 0 8px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.2s ease;
          }
          .cookie-banner button:hover { 
            background: #005a87; 
            transform: translateY(-1px);
          }
          .cookie-banner button.secondary {
            background: transparent;
            border: 1px solid #fff;
          }
          .cookie-banner button.secondary:hover {
            background: rgba(255,255,255,0.1);
          }
          .status {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
          }
          .status.eu { background: #e74c3c; color: white; }
          .status.non-eu { background: #27ae60; color: white; }
          pre { 
            background: #f1f2f6; 
            padding: 15px; 
            border-radius: 6px; 
            overflow-x: auto;
            font-size: 13px;
          }
        </style>
      </head>
      <body>
        <h1>🍪 LeedPDF - EU Cookie Detection</h1>
        
        <div class="info">
          <h3>Detection Results:</h3>
          <p><strong>Your IP:</strong> ${ip}</p>
          <p><strong>Detected Country:</strong> ${countryCode || 'Unknown'}</p>
          <p><strong>Status:</strong> <span class="status ${isEU ? 'eu' : 'non-eu'}">${isEU ? 'EU - Banner Required' : 'Non-EU - No Banner'}</span></p>
        </div>

        <div class="info">
          <h3>API Integration:</h3>
          <p>Use this endpoint in your LeedPDF app:</p>
          <pre>
// Check if user needs cookie banner
fetch('${req.url}/api/check-eu', { method: 'POST' })
  .then(r => r.json())
  .then(data => {
    if (data.showCookieBanner) {
      showCookieBanner();
    }
  });</pre>
        </div>

        <div class="info">
          <h3>Integration Example:</h3>
          <pre>
// In your LeedPDF app
async function checkCookieRequirements() {
  try {
    const response = await fetch('/api/check-eu', { method: 'POST' });
    const data = await response.json();
    
    if (data.showCookieBanner && !localStorage.getItem('cookieConsent')) {
      // Show your cookie banner component
      showCookieBanner();
    }
  } catch (error) {
    // Fallback: show banner if API fails (better safe than sorry)
    showCookieBanner();
  }
}</pre>
        </div>

        <div class="cookie-banner" id="cookieBanner">
          <p>🍪 We use cookies to enhance your LeedPDF experience. By continuing, you agree to our use of cookies.</p>
          <button onclick="acceptCookies()">Accept All</button>
          <button onclick="rejectCookies()" class="secondary">Essential Only</button>
          <button onclick="showSettings()" class="secondary">Settings</button>
        </div>

        <script>
          function acceptCookies() {
            document.getElementById('cookieBanner').style.display = 'none';
            localStorage.setItem('cookieConsent', 'accepted');
            console.log('✅ Cookies accepted');
          }
          
          function rejectCookies() {
            document.getElementById('cookieBanner').style.display = 'none';
            localStorage.setItem('cookieConsent', 'essential');
            console.log('⚠️ Only essential cookies accepted');
          }
          
          function showSettings() {
            alert('🔧 Cookie settings modal would open here\\n\\nYou could allow users to:\\n• Choose cookie categories\\n• View privacy policy\\n• Manage preferences');
          }

          // Auto-hide banner if already consented
          if (localStorage.getItem('cookieConsent')) {
            document.getElementById('cookieBanner').style.display = 'none';
          }
        </script>
      </body>
      </html>
    `;

    return res.send(html, 200, {
      'Content-Type': 'text/html'
    });

  } catch (err) {
    error('Function failed:', err);
    return res.json({ 
      error: 'Failed to detect location',
      showCookieBanner: true // Better safe than sorry - show banner on error
    }, 500);
  }
};