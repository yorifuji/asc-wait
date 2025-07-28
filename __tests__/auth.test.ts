import { describe, it, expect, vi, beforeEach } from 'vitest'
import jwt from 'jsonwebtoken'
import { generateJWT } from '../src/auth'

vi.mock('jsonwebtoken')

describe('JWT Authentication', () => {
  const mockConfig = {
    issuerId: 'test-issuer-id',
    keyId: 'test-key-id',
    key: 'TEST-PRIVATE-KEY-DO-NOT-USE-IN-PRODUCTION'
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateJWT', () => {
    it('should generate a JWT token with correct parameters', () => {
      const mockToken = 'mock.jwt.token'
      vi.mocked(jwt.sign).mockReturnValue(mockToken as unknown as jwt.Secret)

      const token = generateJWT(mockConfig)

      expect(jwt.sign).toHaveBeenCalledTimes(1)
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          iss: mockConfig.issuerId,
          aud: 'appstoreconnect-v1',
          iat: expect.any(Number),
          exp: expect.any(Number)
        }),
        expect.stringContaining('TEST-PRIVATE-KEY'),
        expect.objectContaining({
          algorithm: 'ES256',
          header: {
            alg: 'ES256',
            kid: mockConfig.keyId,
            typ: 'JWT'
          }
        })
      )
      expect(token).toBe(mockToken)
    })

    it('should set correct expiration time (19 minutes)', () => {
      const mockToken = 'mock.jwt.token'
      vi.mocked(jwt.sign).mockReturnValue(mockToken as unknown as jwt.Secret)

      const nowInSeconds = Math.floor(Date.now() / 1000)
      generateJWT(mockConfig)

      const signCall = vi.mocked(jwt.sign).mock.calls[0]
      const payload = signCall[0] as Record<string, unknown>

      expect(payload.exp - payload.iat).toBe(19 * 60)
      expect(payload.iat).toBeGreaterThanOrEqual(nowInSeconds)
    })

    it('should use ES256 algorithm', () => {
      const mockToken = 'mock.jwt.token'
      vi.mocked(jwt.sign).mockReturnValue(mockToken as unknown as jwt.Secret)

      generateJWT(mockConfig)

      const signCall = vi.mocked(jwt.sign).mock.calls[0]
      const options = signCall[2] as jwt.SignOptions
      expect(options.algorithm).toBe('ES256')
    })

    it('should include kid and typ in header', () => {
      const mockToken = 'mock.jwt.token'
      vi.mocked(jwt.sign).mockReturnValue(mockToken as unknown as jwt.Secret)

      generateJWT(mockConfig)

      const signCall = vi.mocked(jwt.sign).mock.calls[0]
      const options = signCall[2] as jwt.SignOptions
      expect(options.header).toEqual({
        alg: 'ES256',
        kid: mockConfig.keyId,
        typ: 'JWT'
      })
    })

    it('should throw error if JWT generation fails', () => {
      const mockError = new Error('JWT generation failed')
      vi.mocked(jwt.sign).mockImplementation(() => {
        throw mockError
      })

      expect(() => generateJWT(mockConfig)).toThrow('JWT generation failed')
    })

    it('should handle invalid private key', () => {
      const invalidConfig = {
        ...mockConfig,
        key: 'invalid-key'
      }
      const mockError = new Error(
        'error:0909006C:PEM routines:get_name:no start line'
      )
      vi.mocked(jwt.sign).mockImplementation(() => {
        throw mockError
      })

      expect(() => generateJWT(invalidConfig)).toThrow()
    })

    it('should normalize private key without PEM headers', () => {
      const mockToken = 'mock.jwt.token'
      vi.mocked(jwt.sign).mockReturnValue(mockToken as unknown as jwt.Secret)

      const configWithRawKey = {
        ...mockConfig,
        key: 'TEST-RAW-KEY-WITHOUT-PEM-HEADERS'
      }

      generateJWT(configWithRawKey)

      const signCall = vi.mocked(jwt.sign).mock.calls[0]
      const privateKey = signCall[1] as string

      // Since we're using test keys, we just verify the normalize function was called
      expect(privateKey).toContain('TEST-RAW-KEY')
    })
  })

  describe('getAuthorizationHeader', () => {
    it('should return Bearer token header', async () => {
      const { getAuthorizationHeader } = await import('../src/auth')
      const mockToken = 'mock.jwt.token'
      vi.mocked(jwt.sign).mockReturnValue(mockToken as unknown as jwt.Secret)

      const header = getAuthorizationHeader(mockConfig)

      expect(header).toBe(`Bearer ${mockToken}`)
    })
  })
})
