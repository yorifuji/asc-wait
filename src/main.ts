import * as core from '@actions/core'
import { BuildService } from './buildService.js'
import { inputSchema, configSchema } from './types.js'

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  const startTime = Date.now()
  let findBuildStartTime: number
  let processingStartTime: number
  let findBuildTime = 0
  let processingTime = 0

  try {
    // Get inputs
    const rawInput = {
      issuerId: core.getInput('issuer-id'),
      keyId: core.getInput('key-id'),
      key: core.getInput('key'),
      bundleId: core.getInput('bundle-id'),
      version: core.getInput('version'),
      buildNumber: core.getInput('build-number'),
      timeout: core.getInput('timeout'),
      interval: core.getInput('interval')
    }

    // Validate and transform inputs
    const validatedInput = inputSchema.parse(rawInput)
    const config = configSchema.parse(validatedInput)

    // Create build service
    const buildService = new BuildService(config)

    // Find target build with retry
    core.startGroup('🔍 Finding Build')
    findBuildStartTime = Date.now()
    const buildInfo = await buildService.findTargetBuildWithRetry()
    findBuildTime = Math.floor((Date.now() - findBuildStartTime) / 1000)
    core.endGroup()

    // Wait for processing if needed
    if (buildInfo.processingState !== 'VALID') {
      core.startGroup('⏳ Waiting for Processing')
      processingStartTime = Date.now()
      const processedBuild = await buildService.waitForProcessing(buildInfo)
      buildInfo.processingState = processedBuild.processingState
      processingTime = Math.floor((Date.now() - processingStartTime) / 1000)
      core.endGroup()
    }

    // Calculate elapsed time
    const elapsedTime = Math.floor((Date.now() - startTime) / 1000)

    // Set outputs
    core.setOutput('build-id', buildInfo.id)
    core.setOutput('processing-state', buildInfo.processingState)
    core.setOutput('version', buildInfo.version)
    core.setOutput('build-number', buildInfo.buildNumber)
    core.setOutput('elapsed-time', elapsedTime.toString())

    core.info(`✅ Build processing completed successfully`)
    core.info('')
    core.info('Summary:')
    core.info(`- Build ID: ${buildInfo.id}`)
    core.info(
      `- Version: ${buildInfo.version} (Build ${buildInfo.buildNumber})`
    )
    core.info(`- Total time: ${formatElapsedTime(elapsedTime)}`)
    if (findBuildTime > 0) {
      core.info(`  - Finding build: ${formatElapsedTime(findBuildTime)}`)
    }
    if (processingTime > 0) {
      core.info(`  - Processing: ${formatElapsedTime(processingTime)}`)
    }
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) {
      core.setFailed(error.message)
    } else {
      core.setFailed('An unexpected error occurred')
    }
  }

  function formatElapsedTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${seconds}s`
  }
}
