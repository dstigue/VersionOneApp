const express = require('express');
// const fetch = require('node-fetch'); // TEMP remove
const path = require('path');
const https = require('https'); // Require https module
// const { HttpsProxyAgent } = require('https-proxy-agent'); // <<< Remove
const { URL } = require('url'); // <<< Add back
// const { PacProxyAgent } = require('pac-proxy-agent'); // TEMP remove
const axios = require('axios'); // <<< Import axios

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

// Function to intelligently determine proxy configuration
function getProxyConfiguration(targetUrl) {
  // Check for protocol-specific proxy environment variables first
  // If target is https, prefer HTTPS_PROXY, otherwise prefer HTTP_PROXY
  const isTargetHttps = targetUrl.startsWith('https:');
  
  console.log(`[App Proxy] Target URL protocol: ${isTargetHttps ? 'HTTPS' : 'HTTP'}`);
  
  // Select the appropriate proxy environment variable based on target protocol
  let proxyEnv;
  if (isTargetHttps) {
    proxyEnv = process.env.HTTPS_PROXY || process.env.https_proxy || 
               process.env.HTTP_PROXY || process.env.http_proxy;
    console.log(`[App Proxy] Looking for HTTPS proxy first because target is HTTPS`);
  } else {
    proxyEnv = process.env.HTTP_PROXY || process.env.http_proxy || 
               process.env.HTTPS_PROXY || process.env.https_proxy;
    console.log(`[App Proxy] Looking for HTTP proxy first because target is HTTP`);
  }
  
  if (!proxyEnv) {
    console.log('[App Proxy] No proxy environment variables detected.');
    return undefined; // No proxy config - use direct connection
  }

  try {
    // Extract proxy URL and parse it
    console.log(`[App Proxy] Detected proxy environment variable: ${proxyEnv}`);
    
    // Ensure URL has a protocol
    let proxyUrlString = proxyEnv;
    if (!proxyUrlString.includes('://')) {
      // Add default protocol if missing
      proxyUrlString = `http://${proxyUrlString}`;
      console.log(`[App Proxy] Added missing protocol to proxy URL: ${proxyUrlString}`);
    }
    
    const proxyUrl = new URL(proxyUrlString);
    
    // Validate protocol - ensure it ends with a colon
    let protocol = proxyUrl.protocol;
    if (!protocol.endsWith(':')) {
      protocol = `${protocol}:`;
      console.log(`[App Proxy] Fixed protocol format: ${protocol}`);
    }
    
    // Parse into object format that axios expects
    const proxyConfig = {
      host: proxyUrl.hostname,
      port: parseInt(proxyUrl.port) || (protocol === 'https:' ? 443 : 80),
      protocol: protocol
    };
    
    // Add auth if present in proxy URL
    if (proxyUrl.username) {
      proxyConfig.auth = {
        username: proxyUrl.username,
        password: proxyUrl.password || ''
      };
      console.log(`[App Proxy] Using proxy authentication for user: ${proxyUrl.username}`);
    }
    
    console.log(`[App Proxy] Constructed proxy configuration:`);
    console.log(`  Protocol: ${proxyConfig.protocol}`);
    console.log(`  Host: ${proxyConfig.host}`);
    console.log(`  Port: ${proxyConfig.port}`);
    
    return proxyConfig;
  } catch (e) {
    console.error(`[App Proxy] Error parsing proxy URL (${proxyEnv}):`, e.message);
    console.log('[App Proxy] Attempting to use proxy string directly');
    
    // As a fallback, just use the string directly instead of parsing it
    // This relies on axios's internal proxy handling
    return proxyEnv;
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

        // Get the proxy configuration - undefined means use env vars
        // Check if we should bypass proxy with a query param for debugging
        const shouldUseProxy = req.query.direct !== 'true';
        
        // Determine proxy configuration
        let proxyConfig;
        if (!shouldUseProxy) {
            console.log('[App Proxy] Proxy BYPASS requested via query parameter');
            proxyConfig = false; // Explicitly disable
        } else {
            proxyConfig = getProxyConfiguration(targetUrl);
            // If undefined, axios uses env vars automatically
        }

        // Configure axios request
        const axiosConfig = {
            method: req.method,
            url: targetUrl,
            headers: {
                'Authorization': v1AuthHeader,
                'Accept': 'application/json',
                ...(req.headers['content-type'] && { 'Content-Type': req.headers['content-type'] })
            },
            ...(req.body && Object.keys(req.body).length > 0 && { data: req.body }),
            httpsAgent: targetUrl.startsWith('https://') ? httpsAgent : undefined,
            validateStatus: function (status) {
                return status >= 200 && status < 600;
            },
            // Set proxy configuration intelligently
            ...(proxyConfig !== undefined && { proxy: proxyConfig })
        };

        console.log('[App Proxy] Outgoing request configuration:');
        console.log(`  Method: ${axiosConfig.method}`);
        console.log(`  URL: ${axiosConfig.url}`);
        console.log('  Headers:');
        Object.keys(axiosConfig.headers).forEach(key => {
          console.log(`    ${key}: ${key.toLowerCase() === 'authorization' ? axiosConfig.headers[key].substring(0, 15) + '...' : axiosConfig.headers[key]}`);
        });
        console.log(`  HTTPS Agent applied: ${!!axiosConfig.httpsAgent}`);
        
        // Enhanced proxy logging
        if (axiosConfig.proxy === false) {
            console.log('  Proxy: EXPLICITLY DISABLED');
        } else if (axiosConfig.proxy) {
            console.log('  Proxy: EXPLICIT CONFIG', JSON.stringify(axiosConfig.proxy, null, 2));
        } else {
            console.log('  Proxy: Using system environment variables (if any)');
        }
        
        if (axiosConfig.data) {
          console.log('  Request data:', JSON.stringify(axiosConfig.data, null, 2));
        }

        console.log('[App Proxy] Making axios request...');
        
        // Add timing information
        const startTime = Date.now();
        
        // Use our custom axios instance
        const apiResponse = await customAxios(axiosConfig);
        
        const endTime = Date.now();
        console.log(`[App Proxy] Request completed in ${endTime - startTime}ms`);
        console.log(`[App Proxy] Response status: ${apiResponse.status}`);
        
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