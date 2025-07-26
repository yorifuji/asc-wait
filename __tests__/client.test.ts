import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AppStoreConnectClient } from '../src/client'
import { Config } from '../src/types'

// Mock fetch globally
global.fetch = vi.fn()

// Mock auth module
vi.mock('../src/auth')

describe('AppStoreConnectClient', () => {
  const mockConfig: Config = {
    issuerId: 'test-issuer',
    keyId: 'test-key',
    key: 'test-private-key',
    bundleId: 'com.example.app',
    version: '1.0.0',
    buildNumber: '100',
    timeout: 600,
    interval: 30
  }

  let client: AppStoreConnectClient

  beforeEach(async () => {
    vi.clearAllMocks()

    // Set up auth mock
    const authModule = await import('../src/auth')
    vi.mocked(authModule.getAuthorizationHeader).mockReturnValue(
      'Bearer mock.token'
    )

    client = new AppStoreConnectClient(mockConfig)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should store config for later use', () => {
      // Constructor no longer generates JWT, just stores config
      expect(client).toBeDefined()
    })
  })

  describe('getAppByBundleId', () => {
    it('should return app data when found', async () => {
      const mockAppData = {
        data: [
          {
            id: 'app-id-123',
            type: 'apps',
            attributes: {
              bundleId: 'com.example.app',
              name: 'Example App'
            }
          }
        ]
      }

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockAppData
      } as Response)

      const app = await client.getAppByBundleId('com.example.app')

      // Verify JWT is generated for this request
      const authModule = await import('../src/auth')
      expect(authModule.getAuthorizationHeader).toHaveBeenCalledWith({
        issuerId: 'test-issuer',
        keyId: 'test-key',
        key: 'test-private-key'
      })

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.appstoreconnect.apple.com/v1/apps?filter[bundleId]=com.example.app',
        {
          headers: {
            Authorization: 'Bearer mock.token',
            'Content-Type': 'application/json'
          }
        }
      )
      expect(app).toEqual(mockAppData.data[0])
    })

    it('should throw error when app not found', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] })
      } as Response)

      await expect(client.getAppByBundleId('com.example.app')).rejects.toThrow(
        'App not found with bundle ID: com.example.app'
      )
    })

    it('should handle API errors', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid authentication'
      } as Response)

      await expect(client.getAppByBundleId('com.example.app')).rejects.toThrow(
        'API request failed: 401 Unauthorized - Invalid authentication'
      )
    })
  })

  describe('getBuilds', () => {
    it('should generate new JWT for each request', async () => {
      const authModule = await import('../src/auth')
      vi.mocked(authModule.getAuthorizationHeader).mockClear()

      const mockBuildsData = {
        data: []
      }

      // Make two requests to verify JWT is generated each time
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => mockBuildsData
      } as Response)

      await client.getBuilds('app-id-123')
      await client.getBuilds('app-id-123')

      // JWT should be generated twice
      expect(authModule.getAuthorizationHeader).toHaveBeenCalledTimes(2)
    })

    it('should fetch builds with correct filters', async () => {
      const mockBuildsData = {
        data: [
          {
            id: 'build-1',
            type: 'builds',
            attributes: {
              version: '100',
              uploadedDate: '2024-01-01T00:00:00Z',
              processingState: 'PROCESSING'
            }
          }
        ]
      }

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockBuildsData
      } as Response)

      const builds = await client.getBuilds('app-id-123', '1.0.0')

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.appstoreconnect.apple.com/v1/builds?filter[app]=app-id-123&sort=-uploadedDate&limit=200&filter[preReleaseVersion.version]=1.0.0',
        {
          headers: {
            Authorization: 'Bearer mock.token',
            'Content-Type': 'application/json'
          }
        }
      )
      expect(builds).toEqual(mockBuildsData.data)
    })

    it('should fetch builds without version filter when not provided', async () => {
      const mockBuildsData = {
        data: []
      }

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockBuildsData
      } as Response)

      await client.getBuilds('app-id-123')

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.appstoreconnect.apple.com/v1/builds?filter[app]=app-id-123&sort=-uploadedDate&limit=200',
        {
          headers: {
            Authorization: 'Bearer mock.token',
            'Content-Type': 'application/json'
          }
        }
      )
    })
  })

  describe('getBuildById', () => {
    it('should fetch build by id', async () => {
      const mockBuildData = {
        data: {
          id: 'build-123',
          type: 'builds',
          attributes: {
            version: '100',
            processingState: 'VALID'
          }
        }
      }

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockBuildData
      } as Response)

      const build = await client.getBuildById('build-123')

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.appstoreconnect.apple.com/v1/builds/build-123',
        {
          headers: {
            Authorization: 'Bearer mock.token',
            'Content-Type': 'application/json'
          }
        }
      )
      expect(build).toEqual(mockBuildData.data)
    })

    it('should handle API errors', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'Build not found'
      } as Response)

      await expect(client.getBuildById('build-123')).rejects.toThrow(
        'API request failed: 404 Not Found - Build not found'
      )
    })
  })
})
