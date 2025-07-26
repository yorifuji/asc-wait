import jwt from 'jsonwebtoken'

interface AuthConfig {
  issuerId: string
  keyId: string
  key: string
}

const JWT_EXPIRATION_TIME = 19 * 60 // 19 minutes in seconds

export function generateJWT(config: AuthConfig): string {
  const { issuerId, keyId, key } = config

  const payload = {}

  const options: jwt.SignOptions = {
    algorithm: 'ES256',
    expiresIn: JWT_EXPIRATION_TIME,
    issuer: issuerId,
    header: {
      alg: 'ES256',
      kid: keyId
    }
  }

  return jwt.sign(payload, key, options)
}

export function getAuthorizationHeader(config: AuthConfig): string {
  const token = generateJWT(config)
  return `Bearer ${token}`
}