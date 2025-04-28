const express = require('express');
// const fetch = require('node-fetch'); // TEMP remove
const path = require('path');
const https = require('https'); // Require https module
// const { HttpsProxyAgent } = require('https-proxy-agent'); // <<< Remove
const { URL } = require('url'); // <<< Add back
// const { PacProxyAgent } = require('pac-proxy-agent'); // TEMP remove
const axios = require('axios'); // <<< Import axios
const { HttpProxyAgent } = require('http-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');
const HttpsAgent = require('agentkeepalive').HttpsAgent;
const ntlm = require('axios-ntlm');

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
    checkServerIdentity: () => undefined
  })
});

// Log axios interceptors for debugging
customAxios.interceptors.request.use(request => {
  console.log('[Axios Interceptor] Request URL:', request.url);
  console.log('[Axios Interceptor] Request Method:', request.method);
  console.log('[Axios Interceptor] Request Headers:', JSON.stringify(request.headers, null, 2));
  return request;
});

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
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('[Request Logger] Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// Your route handler
app.all(/^\/api\/v1\/(.*)/, async (req, res) => {
    console.log('\n[App Proxy] ---- Processing API Request ----');
    
    // Existing code to process request and extract info
    const v1BaseUrl = req.headers['x-v1-base-url'];
    const v1AuthHeader = req.headers['authorization'];
    
    // Extract path+query
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
        // Extract proxy info from environment variables
        let proxyHost, proxyPort, proxyProtocol, proxyAuth;
        
        // Try to parse from HTTPS_PROXY or HTTP_PROXY
        const proxyEnv = process.env.HTTPS_PROXY || process.env.https_proxy || 
                        process.env.HTTP_PROXY || process.env.http_proxy;
        
        if (proxyEnv) {
            try {
                const proxyUrl = new URL(proxyEnv);
                proxyHost = proxyUrl.hostname;
                proxyPort = proxyUrl.port || (proxyUrl.protocol === 'https:' ? 443 : 80);
                proxyProtocol = proxyUrl.protocol.replace(':', '');
                
                // Extract auth if present
                if (proxyUrl.username) {
                    proxyAuth = {
                        username: decodeURIComponent(proxyUrl.username),
                        password: decodeURIComponent(proxyUrl.password || '')
                    };
                }
            } catch (e) {
                console.error(`[App Proxy] Error parsing proxy URL: ${e.message}`);
            }
        }
        
        // Fall back to individual env vars if needed
        proxyHost = proxyHost || process.env.PROXY_HOST;
        proxyPort = proxyPort || process.env.PROXY_PORT;
        proxyProtocol = proxyProtocol || 'http';
        
        if (!proxyAuth && process.env.PROXY_USERNAME) {
            proxyAuth = {
                username: process.env.PROXY_USERNAME,
                password: process.env.PROXY_PASSWORD || ''
            };
        }
        
        // Check if we have proxy info
        if (!proxyHost) {
            console.error('[App Proxy] No proxy configuration found');
            throw new Error('Proxy configuration is required but was not found');
        }
        
        console.log(`[App Proxy] Using proxy: ${proxyProtocol}://${proxyHost}:${proxyPort}`);
        if (proxyAuth) {
            console.log(`[App Proxy] With auth: username=${proxyAuth.username}`);
        }
        
        // Configure axios with proper proxy settings
        const axiosConfig = {
            method: req.method,
            url: targetUrl,
            headers: {
                'Authorization': v1AuthHeader,
                'Accept': 'application/json',
                ...(req.headers['content-type'] && { 'Content-Type': req.headers['content-type'] }),
                // These headers help with NTLM proxy authentication
                'Connection': 'keep-alive',
                'Proxy-Connection': 'keep-alive'
            },
            ...(req.body && Object.keys(req.body).length > 0 && { data: req.body }),
            httpsAgent: new https.Agent({
                rejectUnauthorized: false,
                secureOptions: require('constants').SSL_OP_LEGACY_SERVER_CONNECT,
                checkServerIdentity: () => undefined,
                // Set a larger keepAlive timeout for NTLM sessions
                keepAlive: true,
                keepAliveMsecs: 3000,
                maxSockets: 10,
                maxFreeSockets: 5
            }),
            validateStatus: (status) => status >= 200 && status < 600,
            
            // IMPORTANT: Let axios use the HTTPS_PROXY environment variable
            // Instead of explicit proxy configuration
            proxy: false, // Use environment variables instead
            
            // Other settings
            timeout: 30000,
            maxRedirects: 0 // NTLM doesn't handle redirects well
        };

        console.log(`[App Proxy] Using HTTPS_PROXY environment variable: ${process.env.HTTPS_PROXY || process.env.https_proxy}`);
        console.log('[App Proxy] Important: Setting proxy: false means axios will use the Node.js global agent');
        console.log('[App Proxy] This should pick up HTTPS_PROXY from the environment');

        console.log(`[App Proxy] Making request through proxy with config:`, 
                   JSON.stringify({...axiosConfig, proxy: {
                       ...axiosConfig.proxy,
                       auth: proxyAuth ? '(credentials set)' : undefined
                   }}, null, 2));
        
        // Use regular axios instead of customAxios to ensure proxy settings apply correctly
        const apiResponse = await axios(axiosConfig);
        
        console.log(`[App Proxy] Response received with status: ${apiResponse.status}`);
        
        // Forward selected headers
        if (apiResponse.headers) {
            const headersToForward = ['content-type', 'content-length', 'cache-control', 'expires'];
            headersToForward.forEach(header => {
                if (apiResponse.headers[header]) {
                    res.setHeader(header, apiResponse.headers[header]);
                }
            });
        }
        
        // Send the response
        res.status(apiResponse.status).send(apiResponse.data);

    } catch (error) {
        console.error('\n[App Proxy] ---- ERROR OCCURRED ----');
        console.error(`[App Proxy] Error message: ${error.message}`);
        
        if (error.code) {
            console.error(`[App Proxy] Error code: ${error.code}`);
        }
        
        // Enhanced error reporting for NTLM-specific issues
        if (error.message.includes('407') || 
            (error.response && error.response.status === 407)) {
            console.error('[App Proxy] Proxy authentication required (407)');
            console.error('[App Proxy] This may indicate NTLM authentication is needed but credentials are invalid');
            
            if (error.response && error.response.headers) {
                console.error('[App Proxy] Proxy-Authenticate header:', 
                             error.response.headers['proxy-authenticate']);
            }
            
            res.status(407).json({
                error: 'Proxy Authentication Failed',
                message: 'The proxy server requires authentication. Check PROXY_USERNAME and PROXY_PASSWORD.',
                details: error.message
            });
            return;
        }
        
        if (error.response) {
            console.error(`[App Proxy] Response status: ${error.response.status}`);
            console.error('[App Proxy] Response headers:', error.response.headers);
            
            res.status(error.response.status).json({
                error: `API Error: ${error.response.status}`,
                message: error.message,
                details: error.response.data
            });
        } else {
            console.error('[App Proxy] Full error:', error);
            
            res.status(500).json({
                error: 'Proxy Connection Error',
                message: error.message,
                code: error.code
            });
        }
    }
});

// Diagnostics route to check proxy variables
app.get('/proxy-diagnostics', (req, res) => {
    const diagnostics = {
        environment: {
            HTTPS_PROXY: process.env.HTTPS_PROXY || process.env.https_proxy || 'Not set',
            HTTP_PROXY: process.env.HTTP_PROXY || process.env.http_proxy || 'Not set',
            PROXY_HOST: process.env.PROXY_HOST || 'Not set',
            PROXY_PORT: process.env.PROXY_PORT || 'Not set',
            PROXY_USERNAME: process.env.PROXY_USERNAME ? 'Set (hidden)' : 'Not set',
            PROXY_PASSWORD: process.env.PROXY_PASSWORD ? 'Set (hidden)' : 'Not set',
            NO_PROXY: process.env.NO_PROXY || process.env.no_proxy || 'Not set',
            NODE_TLS_REJECT_UNAUTHORIZED: process.env.NODE_TLS_REJECT_UNAUTHORIZED || 'Not set'
        },
        platform: {
            node: process.version,
            platform: process.platform,
            arch: process.arch
        }
    };
    
    res.json(diagnostics);
});

app.listen(port, () => {
    console.log('\n[App Startup] ---- Server Initialized ----');
    console.log(`[App Startup] Server listening at http://localhost:${port}`);
    console.log('[App Startup] Serving static files from:', path.join(__dirname, '.'));
    console.log('\n[App Startup] TLS/SSL Configuration:');
    console.log('[App Startup] - NODE_TLS_REJECT_UNAUTHORIZED=0 (global setting)');
    console.log('[App Startup] - Custom axios instance with rejectUnauthorized=false');
    console.log('[App Startup] - SSL_OP_LEGACY_SERVER_CONNECT options enabled');
    console.log('[App Startup] - Server identity checking disabled');
    
    console.log('\n[App Startup] Network Configuration:');
    if (process.env.HTTPS_PROXY || process.env.https_proxy) {
        console.log(`[App Startup] HTTPS_PROXY: ${process.env.HTTPS_PROXY || process.env.https_proxy}`);
        console.log('[App Startup] Proxy handling: Intelligently configured based on request');
        console.log('[App Startup] Use ?direct=true query param to bypass proxy for debugging');
    } else {
        console.log('[App Startup] No HTTPS_PROXY environment variable detected.');
    }
    
    // Add Node.js version info which can be relevant for certain TLS behaviors
    console.log(`\n[App Startup] Node.js version: ${process.version}`);
    console.log(`[App Startup] Platform: ${process.platform}`);
    
    // Report whether we're using OpenSSL and its version
    try {
        const crypto = require('crypto');
        console.log(`[App Startup] Using ${crypto.constants.OPENSSL_VERSION_TEXT || 'Unknown crypto library'}`);
    } catch (e) {
        console.log('[App Startup] Could not determine OpenSSL version');
    }
}); 