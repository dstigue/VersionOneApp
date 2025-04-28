const express = require('express');
const fetch = require('node-fetch'); // Use require for node-fetch v2
const path = require('path');
const https = require('https'); // Require https module
const { HttpsProxyAgent } = require('https-proxy-agent'); // <<< Add back
const { URL } = require('url'); // <<< Add back
// const { PacProxyAgent } = require('pac-proxy-agent'); // <<< Keep removed/commented

const app = express();
const port = process.env.PORT || 3000; // Use environment variable or default to 3000

// Middleware to parse JSON bodies (needed for potential POST requests to the proxy)
app.use(express.json());

// Serve static files from the current directory
app.use(express.static(path.join(__dirname, '.')));

// Proxy endpoint for VersionOne API calls
app.all('/api/v1/*', async (req, res) => {
    const v1BaseUrl = req.headers['x-v1-base-url'];
    const v1AuthHeader = req.headers['authorization']; // Forward the Authorization header from the client
    const actualApiPath = req.params[0]; // Get the path after /api/v1/
    const queryParams = req.url.split('?')[1]; // Get query parameters
    const targetUrl = `${v1BaseUrl.replace(/\/$/, '')}/${actualApiPath}${queryParams ? '?' + queryParams : ''}`;
    // const pacUrl = 'http://nettools.usps.gov/proxy.pac'; // <<< Keep removed/commented

    console.log(`[Proxy] Requesting: ${req.method} ${targetUrl}`); // Modified log

    if (!v1BaseUrl || !v1AuthHeader) {
        return res.status(400).json({ error: 'Missing X-V1-Base-URL or Authorization header for proxy.' });
    }

    // --- Configure Agent based on Env Var + Auth --- 
    let agentOptions = {
        rejectUnauthorized: false // Keep this for self-signed certs
    };
    let fetchAgent = null;
    const proxyEnvVar = process.env.HTTPS_PROXY || process.env.https_proxy; // Check Env Var
    let decodedUser = null;
    let decodedPass = null;

    // Decode Basic Auth if present
    if (v1AuthHeader && v1AuthHeader.startsWith('Basic ')) {
        try {
            const base64Credentials = v1AuthHeader.substring(6);
            const decodedCredentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
            [decodedUser, decodedPass] = decodedCredentials.split(':', 2);
            console.log(`[Proxy] Decoded Basic Auth username: ${decodedUser}`);
        } catch (e) {
            console.error('[Proxy] Failed to decode Basic Auth credentials:', e);
        }
    }

    // --- Create Agent based on Env Var Proxy --- 
    if (proxyEnvVar) {
        let effectiveProxyUrl = proxyEnvVar;
        // If Basic Auth creds were decoded, inject them into the proxy URL
        if (decodedUser && decodedPass) {
            try {
                const parsedProxyUrl = new URL(proxyEnvVar);
                parsedProxyUrl.username = decodedUser;
                parsedProxyUrl.password = decodedPass;
                effectiveProxyUrl = parsedProxyUrl.toString();
                console.log(`[Proxy] Using HTTPS_PROXY env var with injected credentials: ${parsedProxyUrl.protocol}//****:****@${parsedProxyUrl.host}`);
            } catch(e) {
                console.error(`[Proxy] Failed to parse/modify HTTPS_PROXY env var (${proxyEnvVar}):`, e);
                effectiveProxyUrl = proxyEnvVar;
                console.log(`[Proxy] Using original HTTPS_PROXY env var: ${effectiveProxyUrl}`);
            }
        } else {
             console.log(`[Proxy] Using HTTPS_PROXY env var (no Basic Auth creds provided/decoded): ${effectiveProxyUrl}`);
        }
        // Create HttpsProxyAgent using the potentially authenticated proxy URL
        fetchAgent = new HttpsProxyAgent(effectiveProxyUrl, { ...agentOptions }); 
    } else if (targetUrl.startsWith('https://')) {
        // Fallback to direct agent only if env var is not set
         console.log('[Proxy] HTTPS_PROXY env var not set. Attempting direct HTTPS connection (respecting rejectUnauthorized).');
         fetchAgent = new https.Agent(agentOptions);
    } else {
        console.log('[Proxy] HTTPS_PROXY env var not set. Attempting direct HTTP connection.');
        // No specific agent needed for plain HTTP
        fetchAgent = null; 
    }
    // --- End Agent Config ---

    try {
        const options = {
            method: req.method,
            headers: {
                'Authorization': v1AuthHeader,
                'Accept': 'application/json',
                ...(req.headers['content-type'] && { 'Content-Type': req.headers['content-type'] })
            },
            ...(req.body && Object.keys(req.body).length > 0 && { body: JSON.stringify(req.body) })
        };

        // --- Add agent to options if configured --- 
        if (fetchAgent) {
            options.agent = fetchAgent;
        }
        // --- End Add agent ---

        console.log(`[Proxy] Forwarding Auth Header: ${options.headers['Authorization']?.substring(0, 15)}...`); // Log only prefix for security

        const apiResponse = await fetch(targetUrl, options);

        // ---- Improved Error Handling ----
        if (!apiResponse.ok) {
            // Read the error body from VersionOne API
            let errorBody = null;
            let errorContentType = apiResponse.headers.get('content-type');
            try {
                if (errorContentType && errorContentType.includes('application/json')) {
                    errorBody = await apiResponse.json();
                } else {
                    errorBody = await apiResponse.text();
                }
            } catch (e) {
                console.error('[Proxy] Error reading error response body:', e);
                errorBody = 'Failed to read error body from API';
            }

            console.error(`[Proxy] Received ${apiResponse.status} from API. Body:`, errorBody);

            // Forward a structured error to the client
            res.status(apiResponse.status).json({
                error: `API Error ${apiResponse.status}`,
                details: errorBody
            });
            return; // Stop further processing
        }
        // ---- End Improved Error Handling ----

        // Forward the status code from VersionOne (only for success)
        res.status(apiResponse.status);

        // Forward headers (optional, but can be useful for debugging/caching)
        // apiResponse.headers.forEach((value, name) => {
        //     // Avoid forwarding headers that might cause issues
        //     if (name.toLowerCase() !== 'transfer-encoding' && name.toLowerCase() !== 'connection') {
        //          res.setHeader(name, value);
        //     }
        // });

        // Stream the response body back to the client
        apiResponse.body.pipe(res);

    } catch (error) {
        console.error('Proxy Error:', error);
        res.status(500).json({ error: 'Proxy failed to connect to the VersionOne API.', details: error.message });
    }
});

// Fallback for SPA: always serve index.html for any other GET request
// This might not be strictly necessary if you only access via index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '.', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
    console.log('Serving static files from:', path.join(__dirname, '.'));
}); 