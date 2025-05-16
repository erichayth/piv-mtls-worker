# PIV mTLS Worker for Cloudflare

This Cloudflare Worker handles client certificate validation for mTLS (mutual TLS) connections and passes certificate validation status to origin servers. It's designed to work with PIV cards and other client certificates.

## Features

- Processes client certificates presented through Cloudflare mTLS
- Validates certificate status
- Passes certificate details to origin servers using standardized headers
- Compatible with Nginx-style SSL client certificate headers

## Prerequisites

- Cloudflare account with Workers capability
- Cloudflare mTLS configuration (Zone or Access)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed

## Deployment

1. Clone this repository:
   ```
   git clone https://github.com/your-username/piv-mtls-worker.git
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

1. Go to SSL/TLS > Client Certificates
2. Configure certificate validation parameters
3. Set up certificate authorities for validation

## Headers Added by the Worker

The worker adds the following headers to requests forwarded to your origin:

- `X-SSL-Client-Verify`: Certificate verification status
- `X-SSL-Client-DN`: Certificate subject distinguished name
- `X-SSL-Client-Issuer`: Certificate issuer distinguished name
- `X-SSL-Client-Serial`: Certificate serial number
- Additional certificate details (when available)

## Development

To test locally:

```
npx wrangler dev
```

Note: Local testing has limitations with mTLS features.