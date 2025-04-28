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

// Create a custom axios instance with certificate validation disabled
const customAxios = axios.create({
  httpsAgent: new https.Agent({  
    rejectUnauthorized: false,
    // The following settings help with certain certificate chain issues
    secureOptions: require('constants').SSL_OP_LEGACY_SERVER_CONNECT,
    checkServerIdentity: () => undefined // Skip hostname verification
  })
});

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

// --- Revert back to defining proxy route directly on app --- 
// --- Try using a RegExp route definition ---
app.all(/^\/api\/v1\/(.*)/, async (req, res) => {
    const v1BaseUrl = req.headers['x-v1-base-url'];
    const v1AuthHeader = req.headers['authorization'];

    // Extract path+query from the captured group (req.params[0])
    const pathAndQuery = req.params[0] || ''; // Get the part matched by (.*)
    const queryIndex = pathAndQuery.indexOf('?');
    let actualApiPath = pathAndQuery;
    let queryParams = null;
    if (queryIndex !== -1) {
        actualApiPath = pathAndQuery.substring(0, queryIndex);
        queryParams = pathAndQuery.substring(queryIndex + 1);
    }
    
    const targetUrl = `${v1BaseUrl.replace(/\/$/, '')}/${actualApiPath}${queryParams ? '?' + queryParams : ''}`;

    console.log(`[App Proxy] Forwarding request for path: /${actualApiPath} to target: ${targetUrl} using axios`);

    try {
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
            // Explicitly bypass proxy for this request
            proxy: false
        };

        console.log(`[App Proxy] Making axios request with certificate validation disabled`);
        console.log(`[App Proxy] Forwarding Auth Header: ${axiosConfig.headers['Authorization']?.substring(0, 15)}...`);

        // Use our custom axios instance
        const apiResponse = await customAxios(axiosConfig);

        console.log(`[App Proxy] Received ${apiResponse.status} from API.`);

        // Forward response
        const contentType = apiResponse.headers['content-type'];
        if (contentType) {
            res.setHeader('Content-Type', contentType);
        }

        res.status(apiResponse.status);
        res.send(apiResponse.data);

    } catch (error) {
        console.error('[App Proxy] Axios Error:', error.message);
        
        // Enhanced error logging
        if (error.code) {
            console.error(`[App Proxy] Error Code: ${error.code}`);
        }
        if (error.cause) {
            console.error(`[App Proxy] Error Cause:`, error.cause);
        }
        if (error.stack) {
            console.error(`[App Proxy] Stack Trace:`, error.stack);
        }

        // Standard error handling
        if (error.response) {
            console.error('[App Proxy] Error Response Status:', error.response.status);
            res.status(error.response.status).json({
                error: `API Error ${error.response.status}`,
                details: error.response.data || error.message
            });
        } else if (error.request) {
            console.error('[App Proxy] System Error Code:', error.code || 'N/A');
            res.status(503).json({
                error: 'Proxy failed to connect to the API.',
                details: error.code || error.message
            });
        } else {
            console.error('[App Proxy] Error Message:', error.message);
            res.status(500).json({
                error: 'Proxy configuration error.',
                details: error.message
            });
        }
    }
});
// --- End Revert ---


// --- Fallback route remains commented out for now --- 
// app.get('*', (req, res) => {
//     res.sendFile(path.join(__dirname, '.', 'index.html'));
// });


app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
    console.log('Serving static files from:', path.join(__dirname, '.'));
    console.log('[App Startup] Using Axios with certificate validation DISABLED:');
    console.log('[App Startup] - NODE_TLS_REJECT_UNAUTHORIZED=0 (global setting)');
    console.log('[App Startup] - Custom axios instance with rejectUnauthorized=false');
    console.log('[App Startup] - SSL_OP_LEGACY_SERVER_CONNECT options enabled');
    console.log('[App Startup] - Server identity checking disabled');
    
    if (process.env.HTTPS_PROXY || process.env.https_proxy) {
        console.log(`[App Startup] HTTPS_PROXY: ${process.env.HTTPS_PROXY || process.env.https_proxy}`);
    } else {
        console.log('[App Startup] No HTTPS_PROXY environment variable detected.');
    }
}); 