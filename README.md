# PIV mTLS Worker for Cloudflare

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/erichayth/piv-mtls-worker)

This Cloudflare Worker handles client certificate validation for mTLS (mutual TLS) connections and passes certificate validation status to origin servers. It's designed to work with PIV cards and other client certificates, creating a seamless integration between Cloudflare's mTLS capabilities and backend services that expect standard certificate headers.

## Features

- Processes client certificates presented through Cloudflare mTLS
- Validates certificate status and forwards verification results
- Passes certificate details to origin servers using standardized headers
- Compatible with Nginx-style SSL client certificate headers
- Transparently handles mTLS authentication without origin server modifications
- Normalizes certificate information across different formats
- No performance impact on non-mTLS traffic

## Prerequisites

- Cloudflare account with Workers capability
- Cloudflare mTLS configuration (Zone or Access)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed

## Deployment

### Option 1: One-Click Deployment

The easiest way to deploy this worker is using the Deploy to Cloudflare button:

1. Click the Deploy button at the top of this README
2. Log into your Cloudflare account when prompted
3. Review the worker configuration in the Cloudflare dashboard
4. Click "Deploy" to deploy the worker to your account
5. Configure your routes and additional settings in the Cloudflare dashboard

### Option 2: Manual Deployment

If you prefer to deploy manually:

1. Clone this repository:
   ```
   git clone https://github.com/ehayth/piv-mtls-worker.git
   cd piv-mtls-worker
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Configure your deployment:
   - Edit `wrangler.toml` to set your `account_id` and routes
   - Configure zone/domain settings as needed

4. Deploy to Cloudflare:
   ```
   npx wrangler deploy
   ```

5. Setup mTLS in Cloudflare:
   - Go to Cloudflare Dashboard > SSL/TLS > Client Certificates
   - Set up your mTLS configuration according to your requirements

## Configuration

### wrangler.toml

The `wrangler.toml` file contains your Worker configuration:

```toml
name = "piv-mtls-worker"
main = "piv-mtls-worker.js"
compatibility_date = "2023-05-18"
compatibility_flags = ["nodejs_compat"]
# Add your account_id here before deployment

[env.production]
routes = [
  # Define your routes here
  # { pattern = "example.com/*", zone_name = "example.com" }
]
```

### Cloudflare mTLS Setup

You need to configure mTLS in the Cloudflare dashboard:

1. **Enable mTLS in Cloudflare Dashboard**:
   - Go to SSL/TLS > Client Certificates
   - Toggle "Client Certificate Forwarding" to ON
   - Toggle "Mutual TLS Authentication" to ON

2. **Configure Certificate Validation**:
   - Go to SSL/TLS > Client Certificates > Mutual TLS
   - Click "Configure" 
   - Select appropriate validation options:
     - **Certificate Authority**: Upload or specify trusted CA certificates
     - **Hostname Requirements**: Configure hostname matching rules (if needed)
     - **Certificate Status Checking**: Enable OCSP/CRL checking (recommended)

3. **API Shield Configuration (Optional)**:
   - For API-specific mTLS usage, configure in Security > API Shield
   - Set up API endpoints that require mTLS authentication
   - Configure specific rules for different API paths

4. **Testing Configuration**:
   - Use `curl` with client certificates to test your configuration
   ```bash
   curl --cert client.pem --key key.pem https://your-domain.com
   ```

For complete details, refer to [Cloudflare's mTLS documentation](https://developers.cloudflare.com/ssl/client-certificates/enable-mtls/).

## Headers Added by the Worker

The worker adds the following Nginx-compatible client certificate headers to requests forwarded to your origin:

### Certificate Validation Headers

- `X-SSL-Client-Verify`: Certificate verification status
  - `SUCCESS`: Certificate is valid and trusted
  - `FAILED:{reason}`: Certificate verification failed with specific reason
  - `NONE`: No client certificate was presented

### Certificate Information Headers (when a certificate is presented)

- `X-SSL-Client-DN`: Certificate subject distinguished name
- `X-SSL-Client-Issuer`: Certificate issuer distinguished name
- `X-SSL-Client-DN-Legacy`: Certificate subject DN in legacy format
- `X-SSL-Client-Issuer-Legacy`: Certificate issuer DN in legacy format
- `X-SSL-Client-Serial`: Certificate serial number
- `X-SSL-Client-Issuer-Serial`: Certificate issuer serial
- `X-SSL-Client-Fingerprint`: SHA-1 fingerprint of the certificate
- `X-SSL-Client-NotBefore`: Certificate validity start date (format: "Dec 22 19:39:00 2018 GMT")
- `X-SSL-Client-NotAfter`: Certificate validity end date (format: "Dec 22 19:39:00 2018 GMT")

### Standard Cloudflare Headers (automatically included)

These headers are automatically added by Cloudflare to all requests and passed through:

- `CF-Connecting-IP`: The client's original IP address
- `CF-IPCountry`: The client's country code
- `CF-RAY`: Cloudflare's internal ray ID for the request
- `CF-Visitor`: Contains JSON like `{"scheme":"https"}` indicating the connection scheme
- `X-Forwarded-For`: The client's original IP address and proxy IPs
- `X-Forwarded-Proto`: The connection scheme (http or https)

## PIV Card Integration

This worker is specifically designed to work with PIV (Personal Identity Verification) cards and certificate-based authentication:

- **Federal PKI Compatibility**: Compatible with US Federal PKI and Common Policy certificates
- **Certificate Chain Validation**: Forwards complete certificate details for backend validation
- **Flexible Authentication**: Works with both PIV Authentication and PIV Card Authentication certificates
- **Custom Header Mapping**: Maps PIV-specific certificate fields to standard headers

### PIV-specific Certificate Fields

PIV cards contain specific certificate fields that may be of interest:

- Subject Alternative Name (SAN) extensions containing Federal Agency Smart Credential Number (FASC-N)
- Organizational Identifier (OID) fields for PIV Authentication Policy
- Federal Agency identifiers in certificate issuer fields

These fields are accessible via the standard Distinguished Name headers forwarded by the worker.

## Development

To test locally:

```
npx wrangler dev
```

Note: Local testing has limitations with mTLS features.

## Origin Server Integration

### Using Certificate Headers in Your Application

Once the certificate validation headers are forwarded to your origin server, you can use them in various ways:

#### Apache Configuration

```apache
<Location "/secure">
  # Require a valid client certificate
  RewriteEngine On
  RewriteCond %{HTTP:X-SSL-Client-Verify} !^SUCCESS$
  RewriteRule .* - [F,L]
  
  # Additional restrictions based on certificate subject
  RewriteCond %{HTTP:X-SSL-Client-DN} !cn=allowed-user
  RewriteRule .* - [F,L]
</Location>
```

#### Nginx Configuration

```nginx
server {
  location /secure {
    # Only allow requests with a valid certificate
    if ($http_x_ssl_client_verify != "SUCCESS") {
      return 403;
    }
    
    # Pass the client certificate information to the application
    proxy_set_header SSL-Client-Verify $http_x_ssl_client_verify;
    proxy_set_header SSL-Client-DN $http_x_ssl_client_dn;
    
    proxy_pass http://backend;
  }
}
```

#### Node.js Example

```javascript
const express = require('express');
const app = express();

app.use('/secure', (req, res, next) => {
  // Check if client presented a valid certificate
  if (req.headers['x-ssl-client-verify'] !== 'SUCCESS') {
    return res.status(403).send('Client certificate required');
  }
  
  // Extract identity information from certificate
  const clientDN = req.headers['x-ssl-client-dn'];
  console.log(`Authenticated client: ${clientDN}`);
  
  next();
});
```

#### Python Example

```python
from flask import Flask, request, abort

app = Flask(__name__)

@app.route('/secure')
def secure_endpoint():
    # Check certificate verification status
    if request.headers.get('X-SSL-Client-Verify') != 'SUCCESS':
        abort(403)  # Forbidden
    
    # Get client identity from certificate
    client_dn = request.headers.get('X-SSL-Client-DN', 'Unknown')
    
    return f"Hello, {client_dn}!"
```

## Troubleshooting

### Common Issues

1. **Certificate Not Presented**
   - Check that client is sending a certificate
   - Verify browser is properly prompted for certificate selection
   - Ensure certificate is not expired

2. **Certificate Verification Failures**
   - Check that your CA certificates are properly uploaded to Cloudflare
   - Verify certificate chain validity with `openssl verify`
   - Check OCSP/CRL status if enabled

3. **Headers Not Received by Origin**
   - Verify worker is properly deployed and attached to the correct routes
   - Check Cloudflare logs for worker execution
   - Temporarily add debug headers/logging to validate execution flow

### Debugging

To debug certificate issues:

```javascript
// Add this to your worker for debugging
console.log('Client Certificate Details:', JSON.stringify(request.cf.tlsClientAuth));
```

For more complex debugging, send the details to a separate endpoint:

```javascript
// Debug endpoint
if (request.url.includes('/debug-cert')) {
  return new Response(JSON.stringify(request.cf.tlsClientAuth, null, 2), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```
