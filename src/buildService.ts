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

  async findTargetBuild(): Promise<BuildInfo> {
    core.info(`Finding app with bundle ID: ${this.config.bundleId}`)
    const app = await this.client.getAppByBundleId(this.config.bundleId)
    
    core.info(`Finding builds for version: ${this.config.version}`)
    const builds = await this.client.getBuilds(app.id, this.config.version)
    
    if (builds.length === 0) {
      throw new Error(`No builds found for version ${this.config.version}`)
    }

    // Find the specific build with matching build number
    const targetBuild = builds.find(build => 
      build.attributes.version === this.config.buildNumber
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

  async waitForProcessing(buildInfo: BuildInfo): Promise<BuildInfo> {
    const startTime = Date.now()
    const intervalMs = this.config.interval * 1000

    core.info(`Waiting for build ${buildInfo.buildNumber} to finish processing...`)
    core.info(`Timeout: ${this.config.timeout}s, Interval: ${this.config.interval}s`)

    return new Promise((resolve, reject) => {
      let intervalId: NodeJS.Timeout | undefined

      const checkBuildStatus = async () => {
        try {
          const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000)
          
          if (elapsedSeconds > this.config.timeout) {
            if (intervalId) clearInterval(intervalId)
            reject(new Error(`Timeout waiting for build processing after ${this.config.timeout} seconds`))
            return
          }

          const build = await this.client.getBuildById(buildInfo.id)
          const processingState = build.attributes.processingState

          core.info(`[${elapsedSeconds}s] Build processing state: ${processingState}`)

          if (processingState === 'VALID') {
            if (intervalId) clearInterval(intervalId)
            resolve({
              ...buildInfo,
              processingState
            })
          } else if (processingState === 'FAILED' || processingState === 'INVALID') {
            if (intervalId) clearInterval(intervalId)
            reject(new Error(`Build processing failed with state: ${processingState}`))
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