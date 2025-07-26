import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BuildService } from '../src/buildService'
import { AppStoreConnectClient } from '../src/client'
import { Config, BuildInfo } from '../src/types'
import * as core from '@actions/core'

vi.mock('@actions/core')
vi.mock('../src/client')

describe('BuildService', () => {
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

  let buildService: BuildService
  let mockClient: {
    getAppByBundleId: ReturnType<typeof vi.fn>
    getBuilds: ReturnType<typeof vi.fn>
    getBuildById: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    mockClient = {
      getAppByBundleId: vi.fn(),
      getBuilds: vi.fn(),
      getBuildById: vi.fn()
    }

    vi.mocked(AppStoreConnectClient).mockImplementation(() => mockClient)
    buildService = new BuildService(mockConfig)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('findTargetBuild', () => {
    const mockApp = { id: 'app-123' }

    beforeEach(() => {
      mockClient.getAppByBundleId.mockResolvedValue(mockApp)
    })

    it('should find build by version and build number', async () => {
      const mockBuilds = [
        {
          id: 'build-1',
          attributes: {
            version: '100',
            processingState: 'PROCESSING'
          },
          relationships: {
            preReleaseVersion: {
              data: { id: 'version-1' }
            }
          }
        },
        {
          id: 'build-2',
          attributes: {
            version: '99',
            processingState: 'VALID'
          }
        }
      ]

      mockClient.getBuilds.mockResolvedValue(mockBuilds)

      const build = await buildService.findTargetBuild()

      expect(mockClient.getAppByBundleId).toHaveBeenCalledWith(
        'com.example.app'
      )
      expect(mockClient.getBuilds).toHaveBeenCalledWith('app-123', '1.0.0')
      expect(build).toEqual({
        id: 'build-1',
        version: '1.0.0',
        buildNumber: '100',
        processingState: 'PROCESSING',
        uploadedDate: undefined
      })
    })

    it('should throw error if no builds found', async () => {
      mockClient.getBuilds.mockResolvedValue([])

      await expect(buildService.findTargetBuild()).rejects.toThrow(
        'No builds found for version 1.0.0'
      )
    })

    it('should throw error if specific build not found', async () => {
      const mockBuilds = [
        {
          id: 'build-1',
          attributes: {
            version: '99', // different build number
            processingState: 'VALID'
          }
        }
      ]

      mockClient.getBuilds.mockResolvedValue(mockBuilds)

      await expect(buildService.findTargetBuild()).rejects.toThrow(
        'Build not found with version 1.0.0 and build number 100'
      )
    })
  })

  describe('findTargetBuildWithRetry', () => {
    const mockApp = { id: 'app-123' }

    beforeEach(() => {
      mockClient.getAppByBundleId.mockResolvedValue(mockApp)
    })

    it('should retry until build is found', async () => {
      let attemptCount = 0
      mockClient.getBuilds.mockImplementation(async () => {
        attemptCount++
        if (attemptCount < 3) {
          // First 2 attempts: no build found
          return []
        } else {
          // Third attempt: build found
          return [
            {
              id: 'build-123',
              attributes: {
                version: '100',
                processingState: 'PROCESSING',
                uploadedDate: '2023-01-01T00:00:00Z'
              }
            }
          ]
        }
      })

      const promise = buildService.findTargetBuildWithRetry()

      // Fast-forward through retries
      await vi.advanceTimersByTimeAsync(120000) // 2 minutes

      const result = await promise

      expect(result).toEqual({
        id: 'build-123',
        version: '1.0.0',
        buildNumber: '100',
        processingState: 'PROCESSING',
        uploadedDate: '2023-01-01T00:00:00Z'
      })
      expect(mockClient.getBuilds).toHaveBeenCalledTimes(3)
      expect(core.info).toHaveBeenCalledWith(
        expect.stringContaining('✓ Build found after 3 attempts')
      )
    })

    it('should timeout if build not found', async () => {
      mockClient.getBuilds.mockResolvedValue([])

      const promise = buildService.findTargetBuildWithRetry()
      
      // Add catch handler to prevent unhandled rejection
      promise.catch(() => {
        // Expected rejection
      })

      // Fast-forward past timeout
      await vi.advanceTimersByTimeAsync(700000) // 700 seconds > 600 timeout

      await expect(promise).rejects.toThrow(
        'Timeout: Build not found after 600 seconds'
      )
    })

    it('should fail immediately on non-build-not-found errors', async () => {
      mockClient.getAppByBundleId.mockRejectedValue(new Error('API Error'))

      await expect(buildService.findTargetBuildWithRetry()).rejects.toThrow(
        'API Error'
      )

      // Should not retry
      expect(mockClient.getAppByBundleId).toHaveBeenCalledTimes(1)
    })

    it('should log retry attempts with elapsed time', async () => {
      let attemptCount = 0
      mockClient.getBuilds.mockImplementation(async () => {
        attemptCount++
        if (attemptCount < 2) {
          return []
        } else {
          return [
            {
              id: 'build-123',
              attributes: {
                version: '100',
                processingState: 'VALID'
              }
            }
          ]
        }
      })

      const promise = buildService.findTargetBuildWithRetry()
      await vi.advanceTimersByTimeAsync(35000) // 35 seconds to trigger second attempt
      await promise

      expect(core.info).toHaveBeenCalledWith(
        expect.stringContaining('[0m 30s] Attempt 2:')
      )
    })
  })

  describe('waitForProcessing', () => {
    const mockBuildInfo: BuildInfo = {
      id: 'build-123',
      version: '1.0.0',
      buildNumber: '100',
      processingState: 'PROCESSING'
    }

    it('should poll until build is VALID', async () => {
      let pollCount = 0
      mockClient.getBuildById.mockImplementation(async () => {
        pollCount++
        return {
          id: 'build-123',
          attributes: {
            processingState: pollCount < 3 ? 'PROCESSING' : 'VALID'
          }
        }
      })

      const promise = buildService.waitForProcessing(mockBuildInfo)

      // Fast-forward time
      await vi.advanceTimersByTimeAsync(60000) // 60 seconds

      const result = await promise

      expect(result.processingState).toBe('VALID')
      expect(mockClient.getBuildById).toHaveBeenCalledTimes(3)
    })

    it('should throw error if build fails', async () => {
      mockClient.getBuildById.mockResolvedValue({
        id: 'build-123',
        attributes: {
          processingState: 'FAILED'
        }
      })

      await expect(
        buildService.waitForProcessing(mockBuildInfo)
      ).rejects.toThrow('Build processing failed with state: FAILED')
    })

    it('should throw error if build is invalid', async () => {
      mockClient.getBuildById.mockResolvedValue({
        id: 'build-123',
        attributes: {
          processingState: 'INVALID'
        }
      })

      await expect(
        buildService.waitForProcessing(mockBuildInfo)
      ).rejects.toThrow('Build processing failed with state: INVALID')
    })

    it('should timeout after configured time', async () => {
      mockClient.getBuildById.mockResolvedValue({
        id: 'build-123',
        attributes: {
          processingState: 'PROCESSING'
        }
      })

      const promise = buildService.waitForProcessing(mockBuildInfo)
      
      // Add catch handler to prevent unhandled rejection
      promise.catch(() => {
        // Expected rejection
      })

      // Fast-forward past timeout
      await vi.advanceTimersByTimeAsync(700000) // 700 seconds > 600 timeout

      await expect(promise).rejects.toThrow(
        'Timeout waiting for build processing after 600 seconds'
      )

      // Clear any remaining timers
      vi.clearAllTimers()
    })

    it('should log progress updates', async () => {
      let pollCount = 0
      mockClient.getBuildById.mockImplementation(async () => {
        pollCount++
        return {
          id: 'build-123',
          attributes: {
            processingState: pollCount < 2 ? 'PROCESSING' : 'VALID'
          }
        }
      })

      const promise = buildService.waitForProcessing(mockBuildInfo)
      await vi.advanceTimersByTimeAsync(35000)
      await promise

      expect(core.info).toHaveBeenCalledWith(
        expect.stringContaining('Build processing state: PROCESSING')
      )
    })
  })
})
