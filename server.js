const express = require('express');
const fetch = require('node-fetch'); // Use require for node-fetch v2
const path = require('path');

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

    console.log(`Proxying request to: ${req.method} ${targetUrl}`); // Log the proxied request

    if (!v1BaseUrl || !v1AuthHeader) {
        return res.status(400).json({ error: 'Missing X-V1-Base-URL or Authorization header for proxy.' });
    }

    try {
        const options = {
            method: req.method,
            headers: {
                'Authorization': v1AuthHeader,
                'Accept': 'application/json',
                // Forward Content-Type if present (for POST/PUT)
                ...(req.headers['content-type'] && { 'Content-Type': req.headers['content-type'] })
            },
            // Add body only if it's a POST/PUT/etc. and body exists
            ...(req.body && Object.keys(req.body).length > 0 && { body: JSON.stringify(req.body) })
        };

        const apiResponse = await fetch(targetUrl, options);

        // Forward the status code from VersionOne
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