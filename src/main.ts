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

    // Find target build
    core.info(`Looking for build: version ${config.version}, build ${config.buildNumber}`)
    const buildInfo = await buildService.findTargetBuild()
    
    core.info(`Found build: ${buildInfo.id}`)
    core.info(`Current processing state: ${buildInfo.processingState}`)

    // Wait for processing if needed
    if (buildInfo.processingState !== 'VALID') {
      const processedBuild = await buildService.waitForProcessing(buildInfo)
      buildInfo.processingState = processedBuild.processingState
    }

    // Calculate elapsed time
    const elapsedTime = Math.floor((Date.now() - startTime) / 1000)

    // Set outputs
    core.setOutput('build-id', buildInfo.id)
    core.setOutput('processing-state', buildInfo.processingState)
    core.setOutput('version', buildInfo.version)
    core.setOutput('build-number', buildInfo.buildNumber)
    core.setOutput('elapsed-time', elapsedTime.toString())

    core.info(`✅ Build processing completed successfully in ${elapsedTime}s`)

  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) {
      core.setFailed(error.message)
    } else {
      core.setFailed('An unexpected error occurred')
    }
  }
}