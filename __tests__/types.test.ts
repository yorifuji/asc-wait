import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { inputSchema, configSchema } from '../src/types'

describe('Input Schema Validation', () => {
  describe('inputSchema', () => {
    it('should validate correct input', () => {
      const validInput = {
        issuerId: 'abc123',
        keyId: 'key123',
        key: '-----BEGIN PRIVATE KEY-----\nMIGH...\n-----END PRIVATE KEY-----',
        bundleId: 'com.example.app',
        version: '1.2.0',
        buildNumber: '123',
        timeout: '600',
        interval: '30'
      }

      const result = inputSchema.safeParse(validInput)
      expect(result.success).toBe(true)
    })

    it('should fail when required fields are missing', () => {
      const invalidInput = {
        issuerId: 'abc123',
        // missing other required fields
      }

      const result = inputSchema.safeParse(invalidInput)
      expect(result.success).toBe(false)
    })

    it('should use default values for optional fields', () => {
      const inputWithoutOptionals = {
        issuerId: 'abc123',
        keyId: 'key123',
        key: '-----BEGIN PRIVATE KEY-----\nMIGH...\n-----END PRIVATE KEY-----',
        bundleId: 'com.example.app',
        version: '1.2.0',
        buildNumber: '123'
      }

      const result = inputSchema.parse(inputWithoutOptionals)
      expect(result.timeout).toBe('1200')
      expect(result.interval).toBe('30')
    })
  })

  describe('configSchema', () => {
    it('should validate and transform timeout correctly', () => {
      const config = {
        issuerId: 'abc123',
        keyId: 'key123',
        key: '-----BEGIN PRIVATE KEY-----\nMIGH...\n-----END PRIVATE KEY-----',
        bundleId: 'com.example.app',
        version: '1.2.0',
        buildNumber: '123',
        timeout: '600',
        interval: '30'
      }

      const result = configSchema.parse(config)
      expect(result.timeout).toBe(600)
      expect(result.interval).toBe(30)
    })

    it('should enforce timeout limits', () => {
      const configWithLowTimeout = {
        issuerId: 'abc123',
        keyId: 'key123',
        key: '-----BEGIN PRIVATE KEY-----\nMIGH...\n-----END PRIVATE KEY-----',
        bundleId: 'com.example.app',
        version: '1.2.0',
        buildNumber: '123',
        timeout: '30', // too low
        interval: '30'
      }

      expect(() => configSchema.parse(configWithLowTimeout)).toThrow()
    })

    it('should enforce maximum timeout', () => {
      const configWithHighTimeout = {
        issuerId: 'abc123',
        keyId: 'key123',
        key: '-----BEGIN PRIVATE KEY-----\nMIGH...\n-----END PRIVATE KEY-----',
        bundleId: 'com.example.app',
        version: '1.2.0',
        buildNumber: '123',
        timeout: '1300', // too high
        interval: '30'
      }

      expect(() => configSchema.parse(configWithHighTimeout)).toThrow()
    })

    it('should validate interval properly', () => {
      const configWithLowInterval = {
        issuerId: 'abc123',
        keyId: 'key123',
        key: '-----BEGIN PRIVATE KEY-----\nMIGH...\n-----END PRIVATE KEY-----',
        bundleId: 'com.example.app',
        version: '1.2.0',
        buildNumber: '123',
        timeout: '600',
        interval: '5' // too low
      }

      expect(() => configSchema.parse(configWithLowInterval)).toThrow()
    })
  })
})

describe('Type Exports', () => {
  it('should export ActionInput type', () => {
    const input: z.infer<typeof inputSchema> = {
      issuerId: 'test',
      keyId: 'test',
      key: 'test',
      bundleId: 'test',
      version: '1.0.0',
      buildNumber: '1',
      timeout: '600',
      interval: '30'
    }
    expect(input).toBeDefined()
  })

  it('should export Config type', () => {
    const config: z.infer<typeof configSchema> = {
      issuerId: 'test',
      keyId: 'test',
      key: 'test',
      bundleId: 'test',
      version: '1.0.0',
      buildNumber: '1',
      timeout: 600,
      interval: 30
    }
    expect(config).toBeDefined()
  })
})