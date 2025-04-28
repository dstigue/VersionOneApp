const express = require('express');
// const fetch = require('node-fetch'); // TEMP remove
const path = require('path');
const https = require('https'); // Require https module
const { HttpsProxyAgent } = require('https-proxy-agent'); // <<< Add back
const { URL } = require('url'); // <<< Add back
// const { PacProxyAgent } = require('pac-proxy-agent'); // TEMP remove

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON bodies 
app.use(express.json());

// Serve static files from the current directory
app.use(express.static(path.join(__dirname, '.')));

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

    console.log(`[App Proxy] Forwarding request for path: /${actualApiPath} to target: ${targetUrl}`); // Updated log message

    // --- Restore Agent Config: Env Var Proxy with Auth > Direct --- 
    let fetchAgent = null;
    const proxyEnvVar = process.env.HTTPS_PROXY || process.env.https_proxy; // Check Env Var
    let decodedUser = null;
    let decodedPass = null;

    // Decode Basic Auth if present (for potential proxy auth)
    if (v1AuthHeader && v1AuthHeader.startsWith('Basic ')) {
        try {
            const base64Credentials = v1AuthHeader.substring(6);
            const decodedCredentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
            [decodedUser, decodedPass] = decodedCredentials.split(':', 2);
            console.log(`[App Proxy] Decoded Basic Auth username: ${decodedUser}`);
        } catch (e) {
            console.error('[App Proxy] Failed to decode Basic Auth credentials:', e);
        }
    }

    // --- Create Agent based ONLY on Env Var Proxy --- 
    if (proxyEnvVar) {
        let effectiveProxyUrl = proxyEnvVar;
        // If Basic Auth creds were decoded, inject them into the proxy URL
        if (decodedUser && decodedPass) {
            try {
                const parsedProxyUrl = new URL(proxyEnvVar);
                parsedProxyUrl.username = decodedUser;
                parsedProxyUrl.password = decodedPass;
                effectiveProxyUrl = parsedProxyUrl.toString();
                console.log(`[App Proxy] Using HTTPS_PROXY env var with injected credentials: ${parsedProxyUrl.protocol}//****:****@${parsedProxyUrl.host}`);
            } catch(e) {
                console.error(`[App Proxy] Failed to parse/modify HTTPS_PROXY env var (${proxyEnvVar}):`, e);
                effectiveProxyUrl = proxyEnvVar;
                console.log(`[App Proxy] Using original HTTPS_PROXY env var: ${effectiveProxyUrl}`);
            }
        } else {
             console.log(`[App Proxy] Using HTTPS_PROXY env var (no Basic Auth creds provided/decoded): ${effectiveProxyUrl}`);
        }
        // Create HttpsProxyAgent WITHOUT extra agentOptions
        try {
            fetchAgent = new HttpsProxyAgent(effectiveProxyUrl, { rejectUnauthorized: false }); 
            console.log("[App Proxy] Created HttpsProxyAgent for Env Var Proxy (rejectUnauthorized: false).");
        } catch (e) {
            console.error("[App Proxy] Failed to create HttpsProxyAgent:", e);
            // Proceed without agent if creation fails
            fetchAgent = null;
        }
    } else if (targetUrl.startsWith('https://')) {
        // Fallback to direct agent only if env var is not set
         console.log('[App Proxy] HTTPS_PROXY env var not set. Attempting direct HTTPS connection (rejecting unauthorized).'); // <<< Change message
         // For direct connections, DON'T disable TLS by default unless absolutely necessary
         // If direct connection fails with cert error, user should ensure certs are trusted
         // or explicitly add rejectUnauthorized:false here if required.
         fetchAgent = new https.Agent({ rejectUnauthorized: false }); // <<< Keep for consistency with previous state
         console.log("[App Proxy] Created direct https.Agent (rejectUnauthorized: false)."); // <<< Keep for consistency
    } else {
        // No proxy env var set, no agent needed (TLS handled by NODE_TLS_REJECT_UNAUTHORIZED)
         console.log('[App Proxy] HTTPS_PROXY env var not set. Attempting direct connection.');
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

        if (fetchAgent) {
            options.agent = fetchAgent;
        }

        // <<< Log final options object >>>
        console.log("[App Proxy] Options for fetch:", JSON.stringify(options, (key, value) => key === 'agent' ? '[Agent Object]' : value, 2)); 

        console.log(`[App Proxy] Forwarding Auth Header: ${options.headers['Authorization']?.substring(0, 15)}...`); 

        const apiResponse = await fetch(targetUrl, options);

        // Improved Error Handling (keep as is)
        if (!apiResponse.ok) {
            let errorBody = null;
            let errorContentType = apiResponse.headers.get('content-type');
            try {
                if (errorContentType && errorContentType.includes('application/json')) {
                    errorBody = await apiResponse.json();
                } else {
                    errorBody = await apiResponse.text();
                }
            } catch (e) {
                console.error('[App Proxy] Error reading error response body:', e); // Updated log message
                errorBody = 'Failed to read error body from API';
            }
            console.error(`[App Proxy] Received ${apiResponse.status} from API. Body:`, errorBody); // Updated log message
            res.status(apiResponse.status).json({ error: `API Error ${apiResponse.status}`, details: errorBody });
            return; // Stop further processing
        }

        // --- Forward successful response manually --- 
        const contentType = apiResponse.headers.get('content-type');
        res.status(apiResponse.status); // Set status first
        if (contentType) {
            res.setHeader('Content-Type', contentType); // Forward content type
        }

        // Read body based on type and send
        try {
            if (contentType && contentType.includes('application/json')) {
                const responseBody = await apiResponse.json();
                res.json(responseBody); // Send as JSON
            } else {
                const responseBody = await apiResponse.text();
                res.send(responseBody); // Send as text/other
            }
        } catch (e) {
            console.error('[App Proxy] Error reading/sending success response body:', e);
            // Send an error if reading the success body fails
            // Ensure status isn't set again if headers already sent
            if (!res.headersSent) {
                 res.status(500).json({ error: 'Proxy failed to read/send API response body.' });
            }
        }

    } catch (error) {
        console.error('[App Proxy] Error:', error); // Updated log message
        res.status(500).json({ error: 'Proxy failed to connect to the VersionOne API.', details: error.message });
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
}); 