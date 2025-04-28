console.log('[Debug] Script start');

const express = require('express');
console.log('[Debug] Loaded express');
const path = require('path');
console.log('[Debug] Loaded path');
const https = require('https');
console.log('[Debug] Loaded https');
const axios = require('axios');
console.log('[Debug] Loaded axios');
const { NtlmClient } = require('axios-ntlm');
console.log('[Debug] Loaded axios-ntlm Client');
const { URL } = require('url');
console.log('[Debug] Loaded url.URL');
const { parse: parseUrl } = require('url');
console.log('[Debug] Loaded url.parse');

// Disable certificate validation globally
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
console.log('[Debug] Set NODE_TLS_REJECT_UNAUTHORIZED');

const app = express();
console.log('[Debug] Initialized express app');
const port = process.env.PORT || 3000;
console.log('[Debug] Determined port');

// Log all environment variables related to proxies
console.log('[App Startup] Proxy environment variables:');
console.log(`  HTTPS_PROXY: ${process.env.HTTPS_PROXY || process.env.https_proxy || 'Not set'}`);
console.log(`  HTTP_PROXY: ${process.env.HTTP_PROXY || process.env.http_proxy || 'Not set'}`);
console.log(`  NO_PROXY: ${process.env.NO_PROXY || process.env.no_proxy || 'Not set'}`);

// Middleware to parse JSON bodies 
console.log('[Debug] Setting up express.json middleware...');
app.use(express.json());
console.log('[Debug] express.json middleware set.');

// Serve static files from the current directory
console.log('[Debug] Setting up express.static middleware...');
app.use(express.static(path.join(__dirname, '.')));
console.log('[Debug] express.static middleware set.');

// Add a middleware to log raw requests
console.log('[Debug] Setting up request logger middleware...');
app.use((req, res, next) => {
  console.log('\n[Request Logger] ---- New Request ----');
  console.log(`[Request Logger] ${req.method} ${req.url}`);
  console.log('[Request Logger] Headers:', JSON.stringify(req.headers, null, 2));
  next();
});
console.log('[Debug] Request logger middleware set.');

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
        console.error('[Proxy Auth] Error extracting credentials:', e.message);
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
    
    let apiResponse;

    try {
        // Attempt to extract NTLM credentials
        const ntlmCredentials = extractProxyCredentials();
        
        // Base axios config (common parts)
        const baseAxiosConfig = {
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

        if (ntlmCredentials) {
            // ---> Use NTLM Proxy via axios-ntlm
            console.log(`[App Proxy] Using NTLM proxy credentials: username='${ntlmCredentials.username}', domain='${ntlmCredentials.domain || '(none)'}'`);
            
            const ntlmClient = NtlmClient(ntlmCredentials);

            const ntlmAxiosConfig = {
                method: req.method,
                url: targetUrl,
                headers: baseAxiosConfig.headers, 
                ...(req.body && Object.keys(req.body).length > 0 && { data: req.body }),
                validateStatus: baseAxiosConfig.validateStatus,
                timeout: baseAxiosConfig.timeout,
                maxRedirects: baseAxiosConfig.maxRedirects,
                httpsAgent: baseAxiosConfig.httpsAgent 
            };

            // <<< Log detailed NTLM request config >>>
            console.log('[App Proxy] NTLM Request Config:', JSON.stringify({
                method: ntlmAxiosConfig.method,
                url: ntlmAxiosConfig.url,
                headers: ntlmAxiosConfig.headers,
                data: ntlmAxiosConfig.data ? (typeof ntlmAxiosConfig.data === 'object' ? '[Object]' : '[Data Present]') : '[No Data]',
                timeout: ntlmAxiosConfig.timeout,
                maxRedirects: ntlmAxiosConfig.maxRedirects,
                httpsAgent_keepAlive: ntlmAxiosConfig.httpsAgent?.options?.keepAlive,
                httpsAgent_rejectUnauthorized: ntlmAxiosConfig.httpsAgent?.options?.rejectUnauthorized,
            }, null, 2));

            console.log('[App Proxy] Making request via NTLM client (proxy)');
            apiResponse = await ntlmClient(ntlmAxiosConfig);

        } else {
            // ---> No Proxy or invalid credentials - Attempt Direct Connection via standard axios
            console.warn('[App Proxy] NTLM proxy credentials not found or incomplete in HTTPS_PROXY. Attempting direct connection...');
            
            const directAxiosConfig = { ...baseAxiosConfig }; 

            // <<< Log detailed Direct request config >>>
            console.log('[App Proxy] Direct Request Config:', JSON.stringify({
                method: directAxiosConfig.method,
                url: directAxiosConfig.url,
                headers: directAxiosConfig.headers,
                data: directAxiosConfig.data ? (typeof directAxiosConfig.data === 'object' ? '[Object]' : '[Data Present]') : '[No Data]',
                timeout: directAxiosConfig.timeout,
                maxRedirects: directAxiosConfig.maxRedirects,
                httpsAgent_keepAlive: directAxiosConfig.httpsAgent?.options?.keepAlive,
                httpsAgent_rejectUnauthorized: directAxiosConfig.httpsAgent?.options?.rejectUnauthorized,
            }, null, 2));

            console.log('[App Proxy] Making request via standard axios (direct)');
            apiResponse = await axios(directAxiosConfig); 
        }
        
        // Common response handling
        console.log(`[App Proxy] Response received with status: ${apiResponse.status}`);
        
        if (apiResponse.headers) {
            Object.entries(apiResponse.headers).forEach(([key, value]) => {
                if (key.toLowerCase() !== 'transfer-encoding') {
                    res.setHeader(key, value);
                }
            });
        }
        res.status(apiResponse.status).send(apiResponse.data);

    } catch (error) {
        // Error handling remains largely the same, but context might differ (proxy vs direct)
        console.error('\n[App Proxy] ---- ERROR OCCURRED ----');
        console.error(`[App Proxy] Error message: ${error.message}`);

        if (error.code) {
            console.error(`[App Proxy] Error code: ${error.code}`);
        }

        // Check for 407 specifically for proxy errors
        if (error.response && error.response.status === 407) { 
            console.error('\n[App Proxy] ---- PROXY AUTHENTICATION ERROR (407) ----');
            console.error('[App Proxy] The proxy server requires authentication and it failed.');
            // Check for specific authentication headers
            const proxyAuth = error.response.headers['proxy-authenticate']; // Check this header
            if (proxyAuth) {
                console.error(`[App Proxy] Proxy-Authenticate header: ${proxyAuth}`);
                
                if (proxyAuth.includes('NTLM')) {
                    console.error('[App Proxy] NTLM authentication detected but failed');
                    console.error('[App Proxy] This likely means:');
                    console.error('  1. The username/password/domain in HTTPS_PROXY is incorrect');
                    console.error('  2. The NTLM handshake failed for other reasons');
                } else if (proxyAuth.includes('Basic')) {
                     console.error('[App Proxy] Basic authentication detected but failed. Check username/password.');
                } else if (proxyAuth.includes('Digest')) {
                     console.error('[App Proxy] Digest authentication detected but failed. Check username/password.');
                }
            }
            
            // Suggest checking format again
            const proxyCredentials = extractProxyCredentials(); // Re-extract to log
             if (proxyCredentials) {
                console.error(`[App Proxy] Credentials used: username='${proxyCredentials.username}', domain='${proxyCredentials.domain || '(none)'}'`);
                 if (!proxyCredentials.domain && proxyAuth && proxyAuth.includes('NTLM')) {
                     console.error('[App Proxy] NOTE: NTLM usually requires a domain. Ensure HTTPS_PROXY format is like:');
                     console.error('  - http://DOMAIN\\username:password@proxy.host:port');
                     console.error('  - http://username@DOMAIN:password@proxy.host:port'); // Less common but possible
                 }
            }
        }
        // Handle 401 for target server auth issues
        else if (error.response && error.response.status === 401) {
             console.error('\n[App Proxy] ---- TARGET SERVER AUTHENTICATION ERROR (401) ----');
             console.error('[App Proxy] The target API server rejected the request (Authorization header)');
             console.error('[App Proxy] Headers received:', JSON.stringify(error.response.headers, null, 2));
        }

        // Generic error response sending
        if (error.response) {
            console.error('[App Proxy] Response status:', error.response.status);
            // Don't log full headers again if already logged above
            if (error.response.status !== 407 && error.response.status !== 401) {
                console.error('[App Proxy] Response headers:', JSON.stringify(error.response.headers, null, 2));
            }
            
            res.status(error.response.status).json({
                error: `API Error: ${error.response.status}`,
                message: error.message,
                details: error.response.data
            });
        } else {
            // Network errors, DNS issues, etc. (could be proxy or direct connection related)
             console.error('[App Proxy] Error details:', error);
            
             res.status(500).json({
                 error: 'Connection Error', // More generic now
                 message: error.message,
                 code: error.code
             });
        }
    }
});

// Start server
console.log('[Debug] About to call app.listen...');
app.listen(port, () => {
    console.log('[Debug] app.listen callback entered.');
    console.log('\n[App Startup] ---- Server Initialized ----');
    console.log(`[Debug] Server running on port ${port}`);
});