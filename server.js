const express = require('express');
const path = require('path');
const https = require('https');
const axios = require('axios');
const httpntlm = require('node-http-ntlm');
const { URL } = require('url');
const { parse: parseUrl } = require('url');

// Disable certificate validation globally
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON bodies 
app.use(express.json());

// Serve static files from the current directory
app.use(express.static(path.join(__dirname, '.')));

// Extract credentials from proxy URL, potentially including domain
function extractProxyCredentials() {
    const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
    if (!proxyUrl) return null;
    
    try {
        const parsedUrl = parseUrl(proxyUrl);
        if (!parsedUrl.auth) return null;
        
        const [rawUsername, rawPassword] = parsedUrl.auth.split(':');
        if (!rawUsername) return null;

        const username = decodeURIComponent(rawUsername);
        const password = decodeURIComponent(rawPassword || '');

        // Separate domain if present (DOMAIN\\user or user@DOMAIN)
        let domain = '';
        let user = username;
        if (username.includes('\\')) {
            [domain, user] = username.split('\\');
        } else if (username.includes('@')) {
            [user, domain] = username.split('@'); // Less common for NTLM, but handle it
        }
        
        return {
            username: user,
            password: password,
            domain: domain || '' // Provide domain if found
        };
    } catch (e) {
        console.error('Error extracting proxy credentials');
        return null;
    }
}

// Your route handler
app.all(/^\/api\/v1\/(.*)/, async (req, res) => {
    // Extract path+query and other details
    const v1BaseUrl = req.headers['x-v1-base-url'];
    const v1AuthHeader = req.headers['authorization'];
    
    // Use req.originalUrl to get the full path including query string reliably
    const originalUrl = req.originalUrl;
    const apiPrefix = '/api/v1/';
    const apiPathStartIndex = originalUrl.indexOf(apiPrefix);
    
    let pathAndQuery = '';
    if (apiPathStartIndex !== -1) {
        pathAndQuery = originalUrl.substring(apiPathStartIndex + apiPrefix.length);
    } else {
        console.error('Error parsing API path');
        pathAndQuery = req.params[0] || ''; // Fallback to previous method
    }

    // Now split path and query using the extracted value
    const queryIndex = pathAndQuery.indexOf('?');
    let actualApiPath = pathAndQuery;
    let queryParams = null;
    if (queryIndex !== -1) {
        actualApiPath = pathAndQuery.substring(0, queryIndex);
        queryParams = pathAndQuery.substring(queryIndex + 1);
    }
    
    // Construct the target URL
    const baseUrlClean = v1BaseUrl.replace(/\/$/, '');
    const queryString = queryParams ? '?' + queryParams : '';
    const targetUrl = `${baseUrlClean}/${actualApiPath}${queryString}`;
    
    let apiResponse;

    try {
        // Attempt to extract NTLM credentials
        const ntlmCredentials = extractProxyCredentials();
        
        if (ntlmCredentials) {
            // Configure options for node-http-ntlm
            const ntlmOptions = {
                url: targetUrl, // The final target URL
                username: ntlmCredentials.username,
                password: ntlmCredentials.password,
                domain: ntlmCredentials.domain,
                workstation: '', // Often optional, can leave blank unless required by proxy
                headers: {
                    // Set headers needed by the TARGET server (based on browser)
                    'Accept': 'application/json, text/plain, */*',
                    // Forward Cookie if present
                    ...(req.headers.cookie && { 'Cookie': req.headers.cookie }),
                    // Forward User-Agent if present
                    ...(req.headers['user-agent'] && { 'User-Agent': req.headers['user-agent'] }),
                    // Forward Referer if present
                    ...(req.headers.referer && { 'Referer': req.headers.referer }),
                    // Forward X-Requested-With if present
                    ...(req.headers['x-requested-with'] && { 'X-Requested-With': req.headers['x-requested-with'] }),
                    // Add Content-Type if present in original request (for POST/PUT)
                    ...(req.headers['content-type'] && { 'Content-Type': req.headers['content-type'] })
                    // DO NOT add the original 'Authorization' header here
                },
                // Set body/data if present in original request
                ...(req.body && Object.keys(req.body).length > 0 && { 
                    // httpntlm expects 'body' for data, needs to be stringified for JSON
                    body: JSON.stringify(req.body) 
                }),
                // httpntlm doesn't use axios agent, handles connection itself.
                // It uses agentkeepalive internally, but doesn't expose rejectUnauthorized easily.
                // We rely on the global process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0' for cert issues.
                timeout: 30000, // Set timeout if needed
                allowRedirects: false // Usually false for API proxies
            };

            // Determine method and call appropriate httpntlm function
            const method = req.method.toLowerCase();

            // Wrap httpntlm call in a promise for async/await
            const makeNtlmRequest = () => new Promise((resolve, reject) => {
                httpntlm[method](ntlmOptions, (err, ntlmRes) => {
                    if (err) {
                        console.error('NTLM request failed');
                        // Construct an error object similar to Axios for consistent handling
                        const errorObj = new Error(err.message || 'node-http-ntlm request failed');
                        errorObj.code = err.code;
                        if (ntlmRes) { // Sometimes response exists even on error
                             errorObj.response = {
                                status: ntlmRes.statusCode,
                                headers: ntlmRes.headers,
                                data: ntlmRes.body // httpntlm puts body here
                            };
                        }
                        return reject(errorObj);
                    }
                    // Construct a response object similar to Axios
                    const responseObj = {
                        status: ntlmRes.statusCode,
                        headers: ntlmRes.headers,
                        data: ntlmRes.body // httpntlm puts body here
                    };
                    resolve(responseObj);
                });
            });

            apiResponse = await makeNtlmRequest();

        } else {
            // No Proxy or invalid credentials - Attempt Direct Connection via standard axios
            const directAxiosConfig = {
                method: req.method,
                url: targetUrl,
                headers: {
                    'Authorization': v1AuthHeader,
                    'Accept': 'application/json',
                    ...(req.headers['content-type'] && { 'Content-Type': req.headers['content-type'] }),
                },
                ...(req.body && Object.keys(req.body).length > 0 && { data: req.body }),
                validateStatus: function (status) {
                    return status >= 200 && status < 600;
                },
                timeout: 30000,
                maxRedirects: 0,
                httpsAgent: new https.Agent({
                    rejectUnauthorized: false,
                    keepAlive: true,
                })
            };

            apiResponse = await axios(directAxiosConfig);
        }
        
        // Common response handling
        if (apiResponse.headers) {
            Object.entries(apiResponse.headers).forEach(([key, value]) => {
                if (key.toLowerCase() !== 'transfer-encoding') {
                    res.setHeader(key, value);
                }
            });
        }
        res.status(apiResponse.status).send(apiResponse.data);

    } catch (error) {
        console.error(`API Error: ${error.message}`);

        // Generic error response sending
        if (error.response) {
            res.status(error.response.status).json({
                error: `API Error: ${error.response.status}`,
                message: error.message,
                details: error.response.data
            });
        } else {
            res.status(500).json({
                error: 'Connection Error',
                message: error.message,
                code: error.code
            });
        }
    }
});

// Initial request handler to serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});