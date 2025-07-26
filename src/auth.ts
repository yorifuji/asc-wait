import jwt from 'jsonwebtoken'

interface AuthConfig {
  issuerId: string
  keyId: string
  key: string
}

const JWT_EXPIRATION_TIME = 19 * 60 // 19 minutes in seconds

function normalizePrivateKey(key: string): string {
  // Remove any extra whitespace
  let normalizedKey = key.trim()
  
  // Check if the key already has PEM headers
  const hasHeader = normalizedKey.includes('-----BEGIN PRIVATE KEY-----')
  const hasFooter = normalizedKey.includes('-----END PRIVATE KEY-----')
  
  // If it doesn't have proper PEM format, add it
  if (!hasHeader && !hasFooter) {
    normalizedKey = `-----BEGIN PRIVATE KEY-----\n${normalizedKey}\n-----END PRIVATE KEY-----`
  }
  
  return normalizedKey
}

export function generateJWT(config: AuthConfig): string {
  const { issuerId, keyId, key } = config

  // Normalize the private key
  const normalizedKey = normalizePrivateKey(key)

  const now = Math.floor(Date.now() / 1000)
  const expiration = now + JWT_EXPIRATION_TIME

  const payload = {
    iss: issuerId,
    iat: now,
    exp: expiration,
    aud: 'appstoreconnect-v1'
  }

  const options: jwt.SignOptions = {
    algorithm: 'ES256',
    header: {
      alg: 'ES256',
      kid: keyId,
      typ: 'JWT'
    }
  }

  return jwt.sign(payload, normalizedKey, options)
}

export function getAuthorizationHeader(config: AuthConfig): string {
  const token = generateJWT(config)
  return `Bearer ${token}`
}