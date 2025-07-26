import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as core from '@actions/core'
import { run } from '../src/main'
import { BuildService } from '../src/buildService'
import { inputSchema, configSchema } from '../src/types'

vi.mock('@actions/core')
vi.mock('../src/buildService')

describe('Main', () => {
  const mockInputs = {
    'issuer-id': 'test-issuer',
    'key-id': 'test-key',
    'key': 'test-private-key',
    'bundle-id': 'com.example.app',
    'version': '1.0.0',
    'build-number': '100',
    'timeout': '600',
    'interval': '30'
  }

  let mockBuildService: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock core.getInput
    vi.mocked(core.getInput).mockImplementation((name: string) => {
      return mockInputs[name as keyof typeof mockInputs] || ''
    })

    // Mock BuildService
    mockBuildService = {
      findTargetBuild: vi.fn(),
      waitForProcessing: vi.fn()
    }
    vi.mocked(BuildService).mockImplementation(() => mockBuildService)
  })

  describe('successful run', () => {
    it('should complete successfully when build becomes VALID', async () => {
      const mockBuildInfo = {
        id: 'build-123',
        version: '1.0.0',
        buildNumber: '100',
        processingState: 'PROCESSING'
      }

      const mockProcessedBuild = {
        ...mockBuildInfo,
        processingState: 'VALID'
      }

      mockBuildService.findTargetBuild.mockResolvedValue(mockBuildInfo)
      mockBuildService.waitForProcessing.mockResolvedValue(mockProcessedBuild)

      const startTime = Date.now()
      await run()
      const elapsedTime = Math.floor((Date.now() - startTime) / 1000)

      // Verify inputs were read correctly
      expect(core.getInput).toHaveBeenCalledWith('issuer-id')
      expect(core.getInput).toHaveBeenCalledWith('key-id')
      expect(core.getInput).toHaveBeenCalledWith('key')
      expect(core.getInput).toHaveBeenCalledWith('bundle-id')
      expect(core.getInput).toHaveBeenCalledWith('version')
      expect(core.getInput).toHaveBeenCalledWith('build-number')
      expect(core.getInput).toHaveBeenCalledWith('timeout')
      expect(core.getInput).toHaveBeenCalledWith('interval')

      // Verify BuildService was called
      expect(mockBuildService.findTargetBuild).toHaveBeenCalledTimes(1)
      expect(mockBuildService.waitForProcessing).toHaveBeenCalledWith(mockBuildInfo)

      // Verify outputs were set
      expect(core.setOutput).toHaveBeenCalledWith('build-id', 'build-123')
      expect(core.setOutput).toHaveBeenCalledWith('processing-state', 'VALID')
      expect(core.setOutput).toHaveBeenCalledWith('version', '1.0.0')
      expect(core.setOutput).toHaveBeenCalledWith('build-number', '100')
      expect(core.setOutput).toHaveBeenCalledWith('elapsed-time', expect.any(String))

      // Verify success message
      expect(core.info).toHaveBeenCalledWith(
        expect.stringContaining('Build processing completed successfully')
      )
    })
  })

  describe('error handling', () => {
    it('should fail when required input is missing', async () => {
      vi.mocked(core.getInput).mockImplementation((name: string) => {
        if (name === 'issuer-id') return ''
        return mockInputs[name as keyof typeof mockInputs] || ''
      })

      await run()

      expect(core.setFailed).toHaveBeenCalledWith(
        expect.stringContaining('issuerId')
      )
    })

    it('should fail when build is not found', async () => {
      const error = new Error('Build not found')
      mockBuildService.findTargetBuild.mockRejectedValue(error)

      await run()

      expect(core.setFailed).toHaveBeenCalledWith('Build not found')
    })

    it('should fail when build processing fails', async () => {
      const mockBuildInfo = {
        id: 'build-123',
        version: '1.0.0',
        buildNumber: '100',
        processingState: 'PROCESSING'
      }

      mockBuildService.findTargetBuild.mockResolvedValue(mockBuildInfo)
      mockBuildService.waitForProcessing.mockRejectedValue(
        new Error('Build processing failed with state: FAILED')
      )

      await run()

      expect(core.setFailed).toHaveBeenCalledWith(
        'Build processing failed with state: FAILED'
      )
    })

    it('should fail on timeout', async () => {
      const mockBuildInfo = {
        id: 'build-123',
        version: '1.0.0',
        buildNumber: '100',
        processingState: 'PROCESSING'
      }

      mockBuildService.findTargetBuild.mockResolvedValue(mockBuildInfo)
      mockBuildService.waitForProcessing.mockRejectedValue(
        new Error('Timeout waiting for build processing after 600 seconds')
      )

      await run()

      expect(core.setFailed).toHaveBeenCalledWith(
        'Timeout waiting for build processing after 600 seconds'
      )
    })

    it('should handle unexpected errors gracefully', async () => {
      const unexpectedError = new Error('Unexpected error')
      mockBuildService.findTargetBuild.mockRejectedValue(unexpectedError)

      await run()

      expect(core.setFailed).toHaveBeenCalledWith('Unexpected error')
    })
  })

  describe('input validation', () => {
    it('should validate timeout range', async () => {
      vi.mocked(core.getInput).mockImplementation((name: string) => {
        if (name === 'timeout') return '50' // too low
        return mockInputs[name as keyof typeof mockInputs] || ''
      })

      await run()

      expect(core.setFailed).toHaveBeenCalledWith(
        expect.stringContaining('Timeout must be at least 60 seconds')
      )
    })

    it('should validate interval range', async () => {
      vi.mocked(core.getInput).mockImplementation((name: string) => {
        if (name === 'interval') return '5' // too low
        return mockInputs[name as keyof typeof mockInputs] || ''
      })

      await run()

      expect(core.setFailed).toHaveBeenCalledWith(
        expect.stringContaining('Interval must be at least 10 seconds')
      )
    })
  })
})