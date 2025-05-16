/**
 * Cloudflare Worker for mTLS Certificate Validation
 * 
 * This worker handles client certificate validation from Cloudflare mTLS 
 * and passes validation status to the origin server via headers that
 * match the expected Nginx SSL client certificate headers.
 * 
 * Cloudflare automatically adds client certificate information to the request.cf object:
 * Reference: https://developers.cloudflare.com/ssl/client-certificates/enable-mtls/
 * 
 * The following properties are available in request.cf.tlsClientAuth:
 * - certPresented: '0' or '1' - indicates if a client certificate was presented
 * - certVerified: 'SUCCESS', 'FAILED:reason', or 'NONE' - certificate verification status
 * - certIssuerDN: Distinguished Name of the certificate issuer
 * - certSubjectDN: Distinguished Name of the certificate subject
 * - certIssuerDNLegacy: Legacy format of the certificate issuer Distinguished Name
 * - certSubjectDNLegacy: Legacy format of the certificate subject Distinguished Name
 * - certIssuerDNRFC2253: RFC 2253 format of the certificate issuer Distinguished Name
 * - certSerial: Serial number of the certificate
 * - certFingerprintSHA1: SHA-1 fingerprint of the certificate
 * - certNotBefore: Start date of certificate validity (format: "Dec 22 19:39:00 2018 GMT")
 * - certNotAfter: End date of certificate validity (format: "Dec 22 19:39:00 2018 GMT")
 */

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

/**
 * Main request handler
 * @param {Request} request - The incoming request
 * @returns {Response} The response to return
 */
async function handleRequest(request) {
  // Check if client certificate exists and validate it
  const clientCertInfo = request.cf.tlsClientAuth
  
  // Create a modified request with certificate validation headers
  const modifiedRequest = new Request(request)
  const newHeaders = new Headers(request.headers)
  
  // Note: Cloudflare automatically adds the following standard headers to all requests:
  // - CF-Connecting-IP: The client's original IP address
  // - CF-IPCountry: The client's country
  // - CF-RAY: Cloudflare's internal ray ID for the request
  // - CF-Visitor: Contains JSON like {"scheme":"https"} indicating the scheme
  // - X-Forwarded-For: The client's original IP address and proxy IPs
  // - X-Forwarded-Proto: The scheme (http or https)
  // These are already included in request.headers and will be forwarded
  
  // Set certificate validation headers based on certificate status
  if (clientCertInfo && clientCertInfo.certPresented === "1") {
    if (clientCertInfo.certVerified === "SUCCESS") {
      // Certificate presented and verified successfully
      newHeaders.set('X-SSL-Client-Verify', 'SUCCESS')
    } else {
      // Certificate presented but verification failed
      newHeaders.set('X-SSL-Client-Verify', `FAILED:${clientCertInfo.certVerified || 'Unknown reason'}`)
    }
    
    // Forward all available certificate details to origin
    // These headers mimic the Nginx SSL client certificate headers format
    // for compatibility with existing server configurations
    const tlsHeaders = {
      'X-SSL-Client-DN': clientCertInfo.certSubjectDN,             // Subject Distinguished Name
      'X-SSL-Client-Issuer': clientCertInfo.certIssuerDN,          // Issuer Distinguished Name
      'X-SSL-Client-DN-Legacy': clientCertInfo.certSubjectDNLegacy, // Legacy format Subject DN
      'X-SSL-Client-Issuer-Legacy': clientCertInfo.certIssuerDNLegacy, // Legacy format Issuer DN
      'X-SSL-Client-Serial': clientCertInfo.certSerial,            // Certificate Serial Number
      'X-SSL-Client-Issuer-Serial': clientCertInfo.certIssuerSerial, // Issuer Serial Number
      'X-SSL-Client-Fingerprint': clientCertInfo.certFingerprintSHA1, // SHA1 Fingerprint
      'X-SSL-Client-Verify': clientCertInfo.certVerify,            // Verification Status
      'X-SSL-Client-NotBefore': clientCertInfo.certNotBefore,      // Validity Start Date
      'X-SSL-Client-NotAfter': clientCertInfo.certNotAfter         // Validity End Date
    };
    
    // Add all certificate headers that have values
    for (const [headerName, headerValue] of Object.entries(tlsHeaders)) {
      if (headerValue) {
        newHeaders.set(headerName, headerValue);
      }
    }
  } else {
    // No certificate presented
    newHeaders.set('X-SSL-Client-Verify', 'NONE')
  }
  
  // Create modified request with new headers
  const requestInit = {
    method: request.method,
    headers: newHeaders,
    body: request.body,
    redirect: 'follow'
  }
  
  // Forward request to origin
  return fetch(request.url, requestInit)
}