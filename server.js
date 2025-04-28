const express = require('express');
const path = require('path');
const https = require('https');
const axios = require('axios');
const { URL } = require('url');

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
        // Create a custom HTTPS agent for this request
        const agent = new https.Agent({
            rejectUnauthorized: false,
            secureOptions: require('constants').SSL_OP_LEGACY_SERVER_CONNECT,
            checkServerIdentity: () => undefined,
            keepAlive: true,
            keepAliveMsecs: 3000,
            maxSockets: 10,
            maxFreeSockets: 5
        });
        
        // Configure axios request
        const axiosConfig = {
            method: req.method,
            url: targetUrl,
            headers: {
                'Authorization': v1AuthHeader,
                'Accept': 'application/json',
                ...(req.headers['content-type'] && { 'Content-Type': req.headers['content-type'] }),
                // Add headers for NTLM
                'Connection': 'keep-alive',
                'Proxy-Connection': 'keep-alive'
            },
            ...(req.body && Object.keys(req.body).length > 0 && { data: req.body }),
            httpsAgent: targetUrl.startsWith('https://') ? agent : undefined,
            validateStatus: function (status) {
                return status >= 200 && status < 600;
            },
            // Use environment variables for proxy configuration
            // Let Node.js handle the proxy automatically
            proxy: false,
            // Set timeout and disable redirects
            timeout: 30000,
            maxRedirects: 0
        };

        console.log('[App Proxy] Making request...');
        console.log(`[App Proxy] Using HTTPS_PROXY from environment: ${process.env.HTTPS_PROXY || process.env.https_proxy || 'Not set'}`);
        console.log('[App Proxy] Setting proxy: false to let Node.js handle proxy via environment variables');
        
        // Make the request with axios (not customAxios)
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