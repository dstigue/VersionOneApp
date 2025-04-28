const express = require('express');
const path = require('path');
const https = require('https');
const axios = require('axios');
const { URL } = require('url');
const { parse: parseUrl } = require('url');

// Disable certificate validation globally
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const app = express();
const port = process.env.PORT || 3000;

// Log all environment variables related to proxies
console.log('[App Startup] Proxy environment variables:');
console.log(`  HTTPS_PROXY: ${process.env.HTTPS_PROXY || process.env.https_proxy || 'Not set'}`);
console.log(`  HTTP_PROXY: ${process.env.HTTP_PROXY || process.env.http_proxy || 'Not set'}`);
console.log(`  NO_PROXY: ${process.env.NO_PROXY || process.env.no_proxy || 'Not set'}`);

// Create a custom axios instance with certificate validation disabled
const customAxios = axios.create({
  httpsAgent: new https.Agent({  
    rejectUnauthorized: false,
    secureOptions: require('constants').SSL_OP_LEGACY_SERVER_CONNECT,
    checkServerIdentity: () => undefined,
    keepAlive: true,
    keepAliveMsecs: 3000
  })
});

// Log axios interceptors for debugging
customAxios.interceptors.request.use(request => {
  console.log('[Axios Interceptor] Request URL:', request.url);
  console.log('[Axios Interceptor] Request Method:', request.method);
  console.log('[Axios Interceptor] Request Headers:', JSON.stringify(request.headers, null, 2));
  return request;
});

// Log response interceptor
customAxios.interceptors.response.use(
  response => {
    console.log('[Axios Interceptor] Response Status:', response.status);
    console.log('[Axios Interceptor] Response Headers:', JSON.stringify(response.headers, null, 2));
    return response;
  },
  error => {
    console.error('[Axios Interceptor] Error:', error.message);
    if (error.response) {
      console.error('[Axios Interceptor] Error Response Status:', error.response.status);
      console.error('[Axios Interceptor] Error Response Headers:', JSON.stringify(error.response.headers, null, 2));
    }
    return Promise.reject(error);
  }
);

// Middleware to parse JSON bodies 
app.use(express.json());

// Serve static files from the current directory
app.use(express.static(path.join(__dirname, '.')));

// Add a middleware to log raw requests
app.use((req, res, next) => {
  console.log('\n[Request Logger] ---- New Request ----');
  console.log(`[Request Logger] ${req.method} ${req.url}`);
  console.log('[Request Logger] Headers:', JSON.stringify(req.headers, null, 2));
  next();
});

// Extract credentials from proxy URL
function extractProxyCredentials() {
    const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
    if (!proxyUrl) return null;
    
    try {
        const parsedUrl = parseUrl(proxyUrl);
        if (!parsedUrl.auth) return null;
        
        const [username, password] = parsedUrl.auth.split(':');
        if (!username) return null;
        
        return {
            username: decodeURIComponent(username),
            password: decodeURIComponent(password || '')
        };
    } catch (e) {
        console.error('[Proxy Auth] Error extracting credentials:', e.message);
        return null;
    }
}

// Extract host and port from proxy URL
function extractProxyHostInfo() {
    const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
    if (!proxyUrl) return null;
    
    try {
        const parsedUrl = parseUrl(proxyUrl);
        return {
            host: parsedUrl.hostname,
            port: parseInt(parsedUrl.port || 80),
            protocol: parsedUrl.protocol || 'http:'
        };
    } catch (e) {
        console.error('[Proxy Host] Error extracting host info:', e.message);
        return null;
    }
}

// Your route handler
app.all(/^\/api\/v1\/(.*)/, async (req, res) => {
    console.log('\n[App Proxy] ---- Processing API Request ----');
    
    // Extract path+query and other details
    const v1BaseUrl = req.headers['x-v1-base-url'];
    const v1AuthHeader = req.headers['authorization'];
    
    const pathAndQuery = req.params[0] || '';
    const queryIndex = pathAndQuery.indexOf('?');
    let actualApiPath = pathAndQuery;
    let queryParams = null;
    if (queryIndex !== -1) {
        actualApiPath = pathAndQuery.substring(0, queryIndex);
        queryParams = pathAndQuery.substring(queryIndex + 1);
    }
    
    const targetUrl = `${v1BaseUrl.replace(/\/$/, '')}/${actualApiPath}${queryParams ? '?' + queryParams : ''}`;
    console.log(`[App Proxy] Full target URL: ${targetUrl}`);
    
    try {
        // Extract proxy info
        const proxyCredentials = extractProxyCredentials();
        const proxyInfo = extractProxyHostInfo();
        
        if (!proxyInfo) {
            throw new Error('No proxy configuration found in environment variables');
        }
        
        console.log(`[App Proxy] Proxy host: ${proxyInfo.host}:${proxyInfo.port}`);
        console.log(`[App Proxy] Proxy credentials: ${proxyCredentials ? 'Present' : 'Not found'}`);
        
        // Create explicit proxy configuration
        const proxyConfig = {
            host: proxyInfo.host,
            port: proxyInfo.port,
            protocol: proxyInfo.protocol.replace(':', '')
        };
        
        if (proxyCredentials) {
            proxyConfig.auth = proxyCredentials;
        }
        
        // Configure axios request with explicit proxy settings
        const axiosConfig = {
            method: req.method,
            url: targetUrl,
            headers: {
                'Authorization': v1AuthHeader,
                'Accept': 'application/json',
                ...(req.headers['content-type'] && { 'Content-Type': req.headers['content-type'] }),
                // Add important headers for proxy authentication
                'Connection': 'keep-alive',
                'Proxy-Connection': 'keep-alive'
            },
            ...(req.body && Object.keys(req.body).length > 0 && { data: req.body }),
            // Use a fresh agent each time for NTLM
            httpsAgent: new https.Agent({
                rejectUnauthorized: false,
                secureOptions: require('constants').SSL_OP_LEGACY_SERVER_CONNECT,
                checkServerIdentity: () => undefined,
                keepAlive: true
            }),
            validateStatus: function (status) {
                return status >= 200 && status < 600;
            },
            // Explicitly set proxy configuration instead of using environment variables
            proxy: proxyConfig,
            // Other settings
            timeout: 30000,
            maxRedirects: 0
        };

        console.log('[App Proxy] Making request with explicit proxy configuration');
        console.log(`[App Proxy] Proxy config: ${JSON.stringify({
            ...proxyConfig,
            auth: proxyCredentials ? '(credentials provided)' : undefined
        })}`);
        
        // Make the request
        const apiResponse = await axios(axiosConfig);
        
        console.log(`[App Proxy] Response received with status: ${apiResponse.status}`);
        
        // Forward response headers and status
        if (apiResponse.headers) {
            Object.entries(apiResponse.headers).forEach(([key, value]) => {
                if (key.toLowerCase() !== 'transfer-encoding') {
                    res.setHeader(key, value);
                }
            });
        }

        res.status(apiResponse.status).send(apiResponse.data);

    } catch (error) {
        // Log detailed error information for proxy auth issues
        if (error.response && error.response.status === 401) {
            console.error('\n[App Proxy] ---- PROXY AUTHENTICATION ERROR (401) ----');
            console.error('[App Proxy] The proxy server rejected the authentication attempt');
            console.error('[App Proxy] Headers received:', JSON.stringify(error.response.headers, null, 2));
            
            // Check for specific authentication headers
            const wwwAuth = error.response.headers['www-authenticate'] || error.response.headers['proxy-authenticate'];
            if (wwwAuth) {
                console.error(`[App Proxy] Authentication header: ${wwwAuth}`);
                
                if (wwwAuth.includes('NTLM')) {
                    console.error('[App Proxy] NTLM authentication detected but failed');
                    console.error('[App Proxy] This likely means:');
                    console.error('  1. The username/password in HTTPS_PROXY is incorrect');
                    console.error('  2. The NTLM handshake is not completing properly');
                    console.error('  3. The proxy server requires additional domain information');
                }
            }
            
            // Suggest checking for domain in username
            const proxyCredentials = extractProxyCredentials();
            if (proxyCredentials && !proxyCredentials.username.includes('\\') && !proxyCredentials.username.includes('@')) {
                console.error('[App Proxy] NOTE: For NTLM authentication, you may need to include the domain:');
                console.error('  - Format should be: DOMAIN\\username or username@DOMAIN');
                console.error('  - Current username format does not include domain information');
            }
        }
        
        console.error('\n[App Proxy] ---- ERROR OCCURRED ----');
        console.error(`[App Proxy] Error message: ${error.message}`);
        
        if (error.code) {
            console.error(`[App Proxy] Error code: ${error.code}`);
        }
        
        if (error.response) {
            console.error(`[App Proxy] Response status: ${error.response.status}`);
            console.error('[App Proxy] Response headers:', JSON.stringify(error.response.headers, null, 2));
            
            res.status(error.response.status).json({
                error: `API Error: ${error.response.status}`,
                message: error.message,
                details: error.response.data
            });
        } else {
            console.error('[App Proxy] Error details:', error);
            
            res.status(500).json({
                error: 'Proxy Connection Error',
                message: error.message,
                code: error.code
            });
        }
    }
});

// Start server
app.listen(port, () => {
    console.log('\n[App Startup] ---- Server Initialized ----');
    console.log(`[App Startup] Server listening at http://localhost:${port}`);
    console.log('[App Startup] Serving static files from:', path.join(__dirname, '.'));
    console.log('[App Startup] TLS/SSL Configuration:');
    console.log('[App Startup] - NODE_TLS_REJECT_UNAUTHORIZED=0 (global setting)');
    console.log('[App Startup] - HTTPS Agent with rejectUnauthorized=false');
    
    console.log('\n[App Startup] Network Configuration:');
    console.log(`[App Startup] Node.js version: ${process.version}`);
    console.log(`[App Startup] Platform: ${process.platform}`);
}); 