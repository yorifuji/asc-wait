import jwt from 'jsonwebtoken'

interface AuthConfig {
  issuerId: string
  keyId: string
  key: string
}

const JWT_EXPIRATION_TIME = 19 * 60 // 19 minutes in seconds

export function generateJWT(config: AuthConfig): string {
  const { issuerId, keyId, key } = config

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

  return jwt.sign(payload, key, options)
}

export function getAuthorizationHeader(config: AuthConfig): string {
  const token = generateJWT(config)
  return `Bearer ${token}`
}