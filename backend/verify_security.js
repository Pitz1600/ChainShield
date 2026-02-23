const axios = require('axios');
const https = require('https');

// Configuration
const BASE_URL = 'http://localhost:5000/api';
const ADMIN_EMAIL = 'testadmin@chainshield.local';
const ADMIN_PASSWORD = 'admin123';

// Colors
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    reset: '\x1b[0m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m'
};

const pass = (msg) => console.log(`${colors.green}PASS: ${msg}${colors.reset}`);
const fail = (msg) => console.log(`${colors.red}FAIL: ${msg}${colors.reset}`);
const info = (msg) => console.log(`${colors.blue}INFO: ${msg}${colors.reset}`);

// Axios instance with cookie support manually handled
let sessionCookie = null;
let authToken = null;
let csrfToken = null;

const client = axios.create({
    baseURL: BASE_URL,
    validateStatus: () => true // Don't throw on error status
});

// Helper to update cookies
function updateCookies(response) {
    const setCookie = response.headers['set-cookie'];
    if (setCookie) {
        // Simple handling: just join them if multiple, or pick the one we need.
        // Usually set-cookie is an array.
        sessionCookie = setCookie.map(c => c.split(';')[0]).join('; ');
    }
}

async function runTests() {
    console.log(`${colors.yellow}Starting Security Verification Tests...${colors.reset}\n`);

    try {
        // 1. Get CSRF Token (Must do this first as Login is a POST and protected)
        info('Step 1: Fetching CSRF Token...');
        const csrfRes = await client.get('/csrf-token');

        if (csrfRes.status === 200 && csrfRes.data.csrfToken) {
            csrfToken = csrfRes.data.csrfToken;
            pass('CSRF Token received');
            updateCookies(csrfRes); // Update cookie (essential for double-submit)
        } else {
            fail('Failed to get CSRF Token');
            console.log(csrfRes.data);
            return;
        }

        // 2. Login
        info('Step 2: Authenticating...');
        const loginHeaders = {
            'CSRF-Token': csrfToken,
            'Cookie': sessionCookie
        };

        const loginRes = await client.post('/auth/login', {
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD
        }, { headers: loginHeaders });

        if (loginRes.status === 200 && loginRes.data.token) {
            authToken = loginRes.data.token;
            pass('Login successful');
            // Login might update the cookie (e.g. session), so update it. 
            // Note: If csurf secrets are session-based or cookie-based, they persist unless rotated.
            updateCookies(loginRes);
        } else {
            fail('Login failed');
            console.log(loginRes.data);
            return;
        }

        // Common headers for subsequent requests
        const getHeaders = (useCsrf = true) => {
            const h = {
                'Authorization': `Bearer ${authToken}`,
                'Cookie': sessionCookie
            };
            if (useCsrf) h['CSRF-Token'] = csrfToken;
            return h;
        };

        // 3. Test Validation (Invalid Data)
        info('Step 3: Testing Input Validation (Server-side)...');
        const invalidPayload = {
            category: 'InvalidCategory', // Invalid enum
            subject: '',                 // Empty
            description: ''              // Empty
        };
        const validationRes = await client.post('/complaints', invalidPayload, { headers: getHeaders() });

        if (validationRes.status === 400 && validationRes.data.errors) {
            pass('Validation rejected invalid data correctly');
            // Check specific errors if needed
            const errs = validationRes.data.errors;
            if (errs.some(e => e.msg === 'Invalid category') && errs.some(e => e.msg === 'Subject is required')) {
                pass('Specific validation messages confirmed');
            }
        } else {
            fail(`Validation failed to reject data. Status: ${validationRes.status}`);
        }

        // 4. Test CSRF Protection (Missing Token)
        info('Step 4: Testing CSRF Protection...');
        const validPayload = {
            category: 'Infrastructure',
            subject: 'Test Valid',
            description: 'Test Description'
        };
        const noCsrfHeaders = getHeaders(false); // No CSRF token
        const csrfFailRes = await client.post('/complaints', validPayload, { headers: noCsrfHeaders });

        if (csrfFailRes.status === 403) {
            // csurf returns 403 Forbidden on invalid token
            pass('Request without CSRF token was rejected (403)');
        } else {
            fail(`Request without CSRF token was accepted! Status: ${csrfFailRes.status}`);
        }

        // 5. Test XSS Protection (Sanitization)
        info('Step 5: Testing XSS Sanitization...');
        const xssPayload = {
            category: 'Public Services',
            subject: 'XSS <script>alert(1)</script> Test',
            description: 'Description with <b>bold</b> and <img src=x onerror=alert(1)>'
        };

        const xssRes = await client.post('/complaints', xssPayload, { headers: getHeaders() });

        if (xssRes.status === 201) {
            pass('XSS Payload submitted successfully (should be sanitized)');
            const complaintId = xssRes.data.complaintId; // Assuming response has it, or we fetch list

            // Fetch the complaint to check sanitization
            // Note: /my-complaints might return it
            const fetchRes = await client.get('/complaints/my-complaints', { headers: getHeaders() });

            if (fetchRes.status === 200 && fetchRes.data.complaints) {
                const submitted = fetchRes.data.complaints.find(c => c._id === complaintId);
                if (submitted) {
                    // Check Subject
                    if (!submitted.subject.includes('<script>') && submitted.subject.includes('&lt;script&gt;')) {
                        pass('Subject sanitized correctly');
                    } else if (!submitted.subject.includes('<script>')) {
                        pass('Subject sanitized (script tag removed)');
                    } else {
                        fail('Subject NOT sanitized!');
                        console.log('Received:', submitted.subject);
                    }

                    // Check Description
                    if (!submitted.description.includes('onerror')) {
                        pass('Description sanitized correctly');
                    } else {
                        fail('Description NOT sanitized!');
                        console.log('Received:', submitted.description);
                    }
                } else {
                    info('Could not find complaint to verify sanitization (pagination?)');
                }
            }
        } else {
            fail(`Failed to submit XSS payload. Status: ${xssRes.status}`);
            console.log(xssRes.data);
        }

        // 6. Test NoSQL Injection (Basic check if mongoSanitize is preventing crashes or weird behavior)
        info('Step 6: Testing NoSQL Injection...');
        // express-mongo-sanitize strips keys starting with $.
        // We'll try to send a payload that would usually cause issues or be stripped.
        const nosqlPayload = {
            category: 'Infrastructure',
            subject: 'NoSQL Test',
            description: { "$gt": "" } // This should be stripped or rejected by validation/sanitization
        };
        // Note: Our validation 'description' expects a string .trim().notEmpty(). 
        // passing an object might fail validation type check before it hits sanitization if using express-validator rigidly.
        // But mongoSanitize runs BEFORE validation in server.js app.use order.
        // So { "$gt": "" } becomes {} -> then validation sees empty or object -> fails.
        // If we send: { "category": { "$ne": "valid" } } -> becomes { "category": {} } -> validation fails 'Invalid category'.

        const nosqlRes = await client.post('/complaints', nosqlPayload, { headers: getHeaders() });

        // We expect 400 because validation will fail on the sanitized (empty/mangled) input OR type mismatch
        if (nosqlRes.status === 400) {
            pass('NoSQL Injection payload rejected (likely by validation after sanitization)');
        } else {
            info(`NoSQL Payload response: ${nosqlRes.status}`);
        }

        console.log(`\n${colors.green}Verification Complete!${colors.reset}`);

    } catch (error) {
        console.error('Test script error:', error.message);
    }
}

runTests();
