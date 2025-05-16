/**
 * Cloudflare Worker for mTLS Certificate Validation
 * 
 * This worker handles client certificate validation from Cloudflare mTLS 
 * and passes validation status to the origin server via headers that
 * match the expected Nginx SSL client certificate headers.
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
    const tlsHeaders = {
      'X-SSL-Client-DN': clientCertInfo.certSubjectDN,
      'X-SSL-Client-Issuer': clientCertInfo.certIssuerDN,
      'X-SSL-Client-DN-Legacy': clientCertInfo.certSubjectDNLegacy,
      'X-SSL-Client-Issuer-Legacy': clientCertInfo.certIssuerDNLegacy,
      'X-SSL-Client-Serial': clientCertInfo.certSerial,
      'X-SSL-Client-Issuer-Serial': clientCertInfo.certIssuerSerial,
      'X-SSL-Client-Fingerprint': clientCertInfo.certFingerprintSHA1,
      'X-SSL-Client-Verify': clientCertInfo.certVerify,
      'X-SSL-Client-NotBefore': clientCertInfo.certNotBefore,
      'X-SSL-Client-NotAfter': clientCertInfo.certNotAfter
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