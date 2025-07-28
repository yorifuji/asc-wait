import * as core from '@actions/core'
import { AppStoreConnectClient } from './client.js'
import { Config, BuildInfo } from './types.js'

export class BuildService {
  private client: AppStoreConnectClient
  private config: Config

  constructor(config: Config) {
    this.config = config
    this.client = new AppStoreConnectClient(config)
  }

  private formatElapsedTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${seconds}s`
  }

  async findTargetBuild(): Promise<BuildInfo> {
    const app = await this.client.getAppByBundleId(this.config.bundleId)
    const builds = await this.client.getBuilds(app.id, this.config.version)

    if (builds.length === 0) {
      throw new Error(`No builds found for version ${this.config.version}`)
    }

    // Find the specific build with matching build number
    const targetBuild = builds.find(
      (build) => build.attributes.version === this.config.buildNumber
    )

    if (!targetBuild) {
      throw new Error(
        `Build not found with version ${this.config.version} and build number ${this.config.buildNumber}`
      )
    }

    return {
      id: targetBuild.id,
      version: this.config.version,
      buildNumber: targetBuild.attributes.version,
      processingState: targetBuild.attributes.processingState,
      uploadedDate: targetBuild.attributes.uploadedDate
    }
  }

  async findTargetBuildWithRetry(): Promise<BuildInfo> {
    const startTime = Date.now()
    const intervalMs = this.config.interval * 1000
    let attempts = 0

    core.info(
      `Looking for build with version ${this.config.version} (build number: ${this.config.buildNumber})`
    )
    core.info(`Bundle ID: ${this.config.bundleId}`)
    core.info(`Retry interval: ${this.config.interval} seconds`)

    return new Promise((resolve, reject) => {
      // eslint-disable-next-line prefer-const
      let intervalId: NodeJS.Timeout | undefined

      const tryFindBuild = async () => {
        try {
          attempts++
          const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000)

          if (elapsedSeconds > this.config.timeout) {
            if (intervalId) clearInterval(intervalId)
            reject(
              new Error(
                `Timeout: Build not found after ${this.config.timeout} seconds`
              )
            )
            return
          }

          core.info(`Attempt ${attempts}: Searching for build...`)

          const buildInfo = await this.findTargetBuild()

          // Build found!
          if (intervalId) clearInterval(intervalId)
          core.info(`found ✓`)
          const elapsedTimeStr = this.formatElapsedTime(elapsedSeconds)
          core.info(
            `\nBuild found after ${attempts} attempts (Total: ${elapsedTimeStr})`
          )
          resolve(buildInfo)
        } catch (error) {
          // Build not found yet, will retry
          if (
            error instanceof Error &&
            (error.message.includes('Build not found') ||
              error.message.includes('No builds found'))
          ) {
            core.info(`not found`)
          } else {
            // Other errors should fail immediately
            if (intervalId) clearInterval(intervalId)
            reject(error)
          }
        }
      }

      // Try immediately
      void tryFindBuild()

      // Then retry at intervals
      intervalId = setInterval(tryFindBuild, intervalMs)
    })
  }

  async waitForProcessing(buildInfo: BuildInfo): Promise<BuildInfo> {
    const startTime = Date.now()
    const intervalMs = this.config.interval * 1000

    core.info(`Build ID: ${buildInfo.id}`)
    core.info(`Initial state: ${buildInfo.processingState}`)

    return new Promise((resolve, reject) => {
      // eslint-disable-next-line prefer-const
      let intervalId: NodeJS.Timeout | undefined

      const checkBuildStatus = async () => {
        try {
          const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000)

          if (elapsedSeconds > this.config.timeout) {
            if (intervalId) clearInterval(intervalId)
            reject(
              new Error(
                `Timeout waiting for build processing after ${this.config.timeout} seconds`
              )
            )
            return
          }

          const build = await this.client.getBuildById(buildInfo.id)
          const processingState = build.attributes.processingState

          core.info(`Checking build status... ${processingState}`)

          if (processingState === 'VALID') {
            if (intervalId) clearInterval(intervalId)
            core.info(`VALID ✓`)
            const elapsedTimeStr = this.formatElapsedTime(elapsedSeconds)
            core.info(`\nProcessing completed (Total: ${elapsedTimeStr})`)
            resolve({
              ...buildInfo,
              processingState
            })
          } else if (
            processingState === 'FAILED' ||
            processingState === 'INVALID'
          ) {
            if (intervalId) clearInterval(intervalId)
            reject(
              new Error(
                `Build processing failed with state: ${processingState}`
              )
            )
          }
        } catch (error) {
          if (intervalId) clearInterval(intervalId)
          reject(error)
        }
      }

      // Check immediately using Promise to avoid sync/async timing issues
      void checkBuildStatus()

      // Then check at intervals
      intervalId = setInterval(checkBuildStatus, intervalMs)
    })
  }
}
