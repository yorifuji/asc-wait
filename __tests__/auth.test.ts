import { describe, it, expect, vi, beforeEach } from 'vitest'
import jwt from 'jsonwebtoken'
import { generateJWT } from '../src/auth'

vi.mock('jsonwebtoken')

describe('JWT Authentication', () => {
  const mockConfig = {
    issuerId: 'test-issuer-id',
    keyId: 'test-key-id',
    key: '-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgevZzL1gdAFr88hb2\nOF/2NxApJCzGCEDdfSp6VQO30hyhRANCAAQRWz+jn65BtOMvdyHKcvjBeBSDZH2r\n1RTwjmYSi9R/zpBnuQ4EiMnCqfMPWiZqB4QdbAd0E7oH50VpuZ1P087G\n-----END PRIVATE KEY-----'
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateJWT', () => {
    it('should generate a JWT token with correct parameters', () => {
      const mockToken = 'mock.jwt.token'
      vi.mocked(jwt.sign).mockReturnValue(mockToken as any)

      const token = generateJWT(mockConfig)

      expect(jwt.sign).toHaveBeenCalledTimes(1)
      expect(jwt.sign).toHaveBeenCalledWith(
        {},
        mockConfig.key,
        expect.objectContaining({
          algorithm: 'ES256',
          expiresIn: 19 * 60, // 19 minutes
          issuer: mockConfig.issuerId,
          header: {
            kid: mockConfig.keyId
          }
        })
      )
      expect(token).toBe(mockToken)
    })

    it('should set correct expiration time (19 minutes)', () => {
      const mockToken = 'mock.jwt.token'
      vi.mocked(jwt.sign).mockReturnValue(mockToken as any)

      generateJWT(mockConfig)

      const signCall = vi.mocked(jwt.sign).mock.calls[0]
      const options = signCall[2] as jwt.SignOptions
      expect(options.expiresIn).toBe(19 * 60)
    })

    it('should use ES256 algorithm', () => {
      const mockToken = 'mock.jwt.token'
      vi.mocked(jwt.sign).mockReturnValue(mockToken as any)

      generateJWT(mockConfig)

      const signCall = vi.mocked(jwt.sign).mock.calls[0]
      const options = signCall[2] as jwt.SignOptions
      expect(options.algorithm).toBe('ES256')
    })

    it('should include kid in header', () => {
      const mockToken = 'mock.jwt.token'
      vi.mocked(jwt.sign).mockReturnValue(mockToken as any)

      generateJWT(mockConfig)

      const signCall = vi.mocked(jwt.sign).mock.calls[0]
      const options = signCall[2] as jwt.SignOptions
      expect(options.header).toEqual({ kid: mockConfig.keyId })
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
      const mockError = new Error('error:0909006C:PEM routines:get_name:no start line')
      vi.mocked(jwt.sign).mockImplementation(() => {
        throw mockError
      })

      expect(() => generateJWT(invalidConfig)).toThrow()
    })
  })

  describe('getAuthorizationHeader', () => {
    it('should return Bearer token header', async () => {
      const { getAuthorizationHeader } = await import('../src/auth')
      const mockToken = 'mock.jwt.token'
      vi.mocked(jwt.sign).mockReturnValue(mockToken as any)

      const header = getAuthorizationHeader(mockConfig)

      expect(header).toBe(`Bearer ${mockToken}`)
    })
  })
})