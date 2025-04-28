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
    // The following settings help with certain certificate chain issues
    secureOptions: require('constants').SSL_OP_LEGACY_SERVER_CONNECT,
    checkServerIdentity: () => undefined // Skip hostname verification
  })
});

// Log axios interceptors for debugging
customAxios.interceptors.request.use(request => {
  console.log('[Axios Interceptor] Request URL:', request.url);
  console.log('[Axios Interceptor] Request Method:', request.method);
  console.log('[Axios Interceptor] Request Headers:', JSON.stringify(request.headers, null, 2));
  
  // Enhanced proxy logging
  if (request.proxy === false) {
    console.log('[Axios Interceptor] Proxy usage: EXPLICITLY DISABLED via proxy: false');
  } else if (request.proxy) {
    console.log('[Axios Interceptor] Proxy configuration:', JSON.stringify(request.proxy, null, 2));
  } else {
    console.log('[Axios Interceptor] Proxy usage: Using system environment variables');
    console.log(`[Axios Interceptor] - HTTPS_PROXY: ${process.env.HTTPS_PROXY || process.env.https_proxy || 'Not set'}`);
    console.log(`[Axios Interceptor] - HTTP_PROXY: ${process.env.HTTP_PROXY || process.env.http_proxy || 'Not set'}`);
  }
  
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

// --- Create an https agent to ignore SSL errors ---
// This agent will be used by axios for HTTPS requests
const httpsAgent = new https.Agent({
    rejectUnauthorized: false // <<< Ignore SSL certificate errors
});
// --- End https agent ---

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

// Replace the getProxyConfiguration function with a direct agent approach
function createProxyAgent(targetUrl) {
    const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy || 
                    process.env.HTTP_PROXY || process.env.http_proxy;
    
    if (!proxyUrl) {
        console.log('[App Proxy] No proxy environment variables detected.');
        return null;
    }
    
    console.log(`[App Proxy] Using proxy URL: ${proxyUrl}`);
    
    // Determine if target is HTTPS
    const isTargetHttps = targetUrl.toLowerCase().startsWith('https://');
    console.log(`[App Proxy] Target protocol is ${isTargetHttps ? 'HTTPS' : 'HTTP'}`);
    
    try {
        // Always use the appropriate agent based on target protocol
        if (isTargetHttps) {
            // For HTTPS targets, use HttpsProxyAgent
            console.log('[App Proxy] Creating HttpsProxyAgent for HTTPS target');
            return new HttpsProxyAgent(proxyUrl, {
                // Important options that help with corporate proxies
                rejectUnauthorized: false,
                secureProxy: false // Try this first (assumes HTTP proxy)
            });
        } else {
            // For HTTP targets, use HttpProxyAgent
            console.log('[App Proxy] Creating HttpProxyAgent for HTTP target');
            return new HttpProxyAgent(proxyUrl);
        }
    } catch (e) {
        console.error(`[App Proxy] Error creating proxy agent:`, e);
        return null;
    }
}

// --- Revert back to defining proxy route directly on app --- 
// --- Try using a RegExp route definition ---
app.all(/^\/api\/v1\/(.*)/, async (req, res) => {
    console.log('\n[App Proxy] ---- Processing API Request ----');
    
    // Log incoming headers
    console.log('[App Proxy] Incoming Headers:');
    Object.keys(req.headers).forEach(key => {
      console.log(`  ${key}: ${key.toLowerCase() === 'authorization' ? req.headers[key].substring(0, 15) + '...' : req.headers[key]}`);
    });
    
    const v1BaseUrl = req.headers['x-v1-base-url'];
    const v1AuthHeader = req.headers['authorization'];
    
    console.log(`[App Proxy] Base URL from header: ${v1BaseUrl || 'Not provided'}`);
    console.log(`[App Proxy] Auth Header present: ${!!v1AuthHeader}`);
    if (v1AuthHeader) {
      const authType = v1AuthHeader.split(' ')[0];
      console.log(`[App Proxy] Auth Type: ${authType}`);
    }

    // Extract path+query
    const pathAndQuery = req.params[0] || '';
    const queryIndex = pathAndQuery.indexOf('?');
    let actualApiPath = pathAndQuery;
    let queryParams = null;
    if (queryIndex !== -1) {
        actualApiPath = pathAndQuery.substring(0, queryIndex);
        queryParams = pathAndQuery.substring(queryIndex + 1);
    }
    
    console.log(`[App Proxy] Path: /${actualApiPath}`);
    console.log(`[App Proxy] Query params: ${queryParams || 'None'}`);
    
    const targetUrl = `${v1BaseUrl.replace(/\/$/, '')}/${actualApiPath}${queryParams ? '?' + queryParams : ''}`;
    console.log(`[App Proxy] Full target URL: ${targetUrl}`);

    try {
        // Check URL validity
        try {
            new URL(targetUrl);
            console.log('[App Proxy] Target URL is valid');
        } catch (urlError) {
            console.error('[App Proxy] Target URL is invalid:', urlError.message);
            throw new Error(`Invalid target URL: ${urlError.message}`);
        }

        // Get the proxy agent based on target URL
        const proxyAgent = createProxyAgent(targetUrl);
        console.log(`[App Proxy] Proxy agent created: ${proxyAgent ? 'Yes' : 'No'}`);
        
        // Configure axios request
        const axiosConfig = {
            method: req.method,
            url: targetUrl,
            headers: {
                'Authorization': v1AuthHeader,
                'Accept': 'application/json',
                ...(req.headers['content-type'] && { 'Content-Type': req.headers['content-type'] }),
                // Add proxy-specific headers if needed
                'Proxy-Connection': 'keep-alive'
            },
            ...(req.body && Object.keys(req.body).length > 0 && { data: req.body }),
            // Important: For HTTPS targets, we need both httpsAgent and a httpAgent depending on proxy type
            ...(targetUrl.startsWith('https://') && {
                httpsAgent: proxyAgent || new https.Agent({
                    rejectUnauthorized: false,
                    secureOptions: require('constants').SSL_OP_LEGACY_SERVER_CONNECT,
                    checkServerIdentity: () => undefined
                })
            }),
            // For HTTP targets, or if no agent created
            ...((!targetUrl.startsWith('https://') || !proxyAgent) && {
                httpAgent: proxyAgent
            }),
            validateStatus: function (status) {
                return status >= 200 && status < 600;
            },
            // Explicitly disable axios's built-in proxy handling since we're using agents
            proxy: false,
            // Add a timeout to prevent hanging
            timeout: 30000
        };

        // Log outgoing configuration
        console.log('[App Proxy] Outgoing request configuration:');
        console.log(`  Method: ${axiosConfig.method}`);
        console.log(`  URL: ${axiosConfig.url}`);
        console.log('  Headers:');
        Object.keys(axiosConfig.headers).forEach(key => {
            console.log(`    ${key}: ${key.toLowerCase() === 'authorization' ? axiosConfig.headers[key].substring(0, 15) + '...' : axiosConfig.headers[key]}`);
        });
        console.log(`  Using proxy agent: ${!!proxyAgent}`);
        console.log(`  Timeout: ${axiosConfig.timeout}ms`);
        
        // Use a single retry if the first attempt fails with specific proxy-related errors
        try {
            console.log('[App Proxy] Making first axios request attempt...');
            const apiResponse = await customAxios(axiosConfig);
            // If successful, process the response
            // Rest of your response handling code...
        } catch (firstError) {
            // Check if it's a common proxy error that might benefit from retrying
            const isProxyError = firstError.code === 'ECONNRESET' || 
                                firstError.code === 'ECONNREFUSED' ||
                                firstError.code === 'ENOTFOUND' ||
                                (firstError.response && firstError.response.status === 407);
                                
            if (isProxyError) {
                console.log(`[App Proxy] Proxy error detected (${firstError.code || firstError.message}). Retrying with alternate configuration...`);
                
                // Try with different agent configuration
                if (targetUrl.startsWith('https://')) {
                    console.log('[App Proxy] Retry: Creating new HttpsProxyAgent with altered settings');
                    // Try with different security settings on the retry
                    const retryAgent = new HttpsProxyAgent(proxyUrl, {
                        rejectUnauthorized: false,
                        secureProxy: true  // Try secure proxy on second attempt
                    });
                    axiosConfig.httpsAgent = retryAgent;
                }
                
                // Make the retry attempt
                console.log('[App Proxy] Making retry axios request...');
                const apiResponse = await customAxios(axiosConfig);
                // If successful, process the response
                // Rest of your response handling code...
            } else {
                // Not a proxy-specific error, rethrow
                throw firstError;
            }
        }
        
        // Log response headers
        console.log('[App Proxy] Response headers:');
        Object.keys(apiResponse.headers).forEach(key => {
          console.log(`  ${key}: ${apiResponse.headers[key]}`);
        });

        // Log response data type and sample
        const responseType = typeof apiResponse.data;
        console.log(`[App Proxy] Response data type: ${responseType}`);
        if (responseType === 'object') {
          const dataStr = JSON.stringify(apiResponse.data).substring(0, 200);
          console.log(`[App Proxy] Response data sample: ${dataStr}${dataStr.length >= 200 ? '...' : ''}`);
        } else if (responseType === 'string') {
          console.log(`[App Proxy] Response data sample: ${apiResponse.data.substring(0, 200)}${apiResponse.data.length >= 200 ? '...' : ''}`);
        }

        // Forward response headers
        console.log('[App Proxy] Forwarding response headers to client');
        const contentType = apiResponse.headers['content-type'];
        if (contentType) {
            console.log(`[App Proxy] Setting Content-Type: ${contentType}`);
            res.setHeader('Content-Type', contentType);
        }

        // Forward status and data
        console.log(`[App Proxy] Setting response status: ${apiResponse.status}`);
        res.status(apiResponse.status);
        
        console.log('[App Proxy] Sending response data to client');
        res.send(apiResponse.data);
        console.log('[App Proxy] Response sent to client');

    } catch (error) {
        console.error('\n[App Proxy] ---- ERROR OCCURRED ----');
        console.error(`[App Proxy] Error message: ${error.message}`);
        
        // Enhanced error logging
        if (error.code) {
            console.error(`[App Proxy] Error code: ${error.code}`);
        }
        if (error.cause) {
            console.error('[App Proxy] Error cause:', error.cause);
        }
        
        // Log the full error object for Node-specific details
        console.error('[App Proxy] Full error:', error);
        
        // Log stack trace separately for readability
        if (error.stack) {
            console.error('[App Proxy] Stack trace:', error.stack);
        }

        // Standard error handling with enhanced logging
        if (error.response) {
            // The server responded with a status code outside the 2xx range
            console.error(`[App Proxy] Server responded with error status: ${error.response.status}`);
            console.error('[App Proxy] Response headers:', JSON.stringify(error.response.headers, null, 2));
            
            // Log response data carefully to avoid console flooding
            const responseDataType = typeof error.response.data;
            if (responseDataType === 'object') {
                console.error('[App Proxy] Response data (JSON):', JSON.stringify(error.response.data, null, 2).substring(0, 500));
            } else if (responseDataType === 'string') {
                console.error(`[App Proxy] Response data (string): ${error.response.data.substring(0, 500)}`);
                // Try to parse if it looks like JSON
                if (error.response.data.trim().startsWith('{') || error.response.data.trim().startsWith('[')) {
                    try {
                        const parsedData = JSON.parse(error.response.data);
                        console.error('[App Proxy] Parsed JSON from string response:', JSON.stringify(parsedData, null, 2).substring(0, 500));
                    } catch (e) {
                        console.error('[App Proxy] Failed to parse response as JSON:', e.message);
                    }
                }
            } else {
                console.error(`[App Proxy] Response data (${responseDataType}):`, error.response.data);
            }
            
            res.status(error.response.status).json({
                error: `API Error ${error.response.status}`,
                details: error.response.data || error.message
            });
            console.error('[App Proxy] Sent error response to client with status:', error.response.status);
        } else if (error.request) {
            // The request was made but no response was received
            console.error('[App Proxy] No response received from server');
            console.error('[App Proxy] Request details:', error.request._header || 'No request header available');
            console.error(`[App Proxy] System error code: ${error.code || 'N/A'}`);
            
            res.status(503).json({
                error: 'Proxy failed to connect to the API.',
                details: `Request failed with code: ${error.code || 'N/A'}`
            });
            console.error('[App Proxy] Sent error response to client with status: 503');
        } else {
            // Something happened in setting up the request
            console.error('[App Proxy] Error occurred during request setup');
            
            res.status(500).json({
                error: 'Proxy configuration error.',
                details: error.message
            });
            console.error('[App Proxy] Sent error response to client with status: 500');
        }
    }
});
// --- End Revert ---


// --- Fallback route remains commented out for now --- 
// app.get('*', (req, res) => {
//     res.sendFile(path.join(__dirname, '.', 'index.html'));
// });


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