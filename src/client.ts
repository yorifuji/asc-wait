import { Config } from './types.js'
import { getAuthorizationHeader } from './auth.js'

interface APIResponse<T> {
  data: T
  links?: any
  meta?: any
}

interface App {
  id: string
  type: string
  attributes: {
    bundleId: string
    name: string
  }
}

interface Build {
  id: string
  type: string
  attributes: {
    version: string
    uploadedDate: string
    processingState: string
    minOsVersion?: string
    iconAssetToken?: {
      templateUrl: string
      width: number
      height: number
    }
  }
  relationships?: {
    preReleaseVersion?: {
      data?: {
        id: string
        type: string
      }
    }
  }
}

export class AppStoreConnectClient {
  private baseUrl = 'https://api.appstoreconnect.apple.com/v1'
  private authHeader: string

  constructor(config: Config) {
    this.authHeader = getAuthorizationHeader({
      issuerId: config.issuerId,
      keyId: config.keyId,
      key: config.key
    })
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json',
        ...options.headers
      }
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${error}`)
    }

    return response.json() as Promise<T>
  }

  async getAppByBundleId(bundleId: string): Promise<App> {
    const response = await this.request<APIResponse<App[]>>(
      `/apps?filter[bundleId]=${encodeURIComponent(bundleId)}`
    )

    if (!response.data || response.data.length === 0) {
      throw new Error(`App not found with bundle ID: ${bundleId}`)
    }

    return response.data[0]
  }

  async getBuilds(appId: string, version?: string): Promise<Build[]> {
    let path = `/builds?filter[app]=${appId}&sort=-uploadedDate&limit=200`
    
    if (version) {
      path += `&filter[preReleaseVersion.version]=${encodeURIComponent(version)}`
    }

    const response = await this.request<APIResponse<Build[]>>(path)
    return response.data || []
  }

  async getBuildById(buildId: string): Promise<Build> {
    const response = await this.request<APIResponse<Build>>(
      `/builds/${buildId}`
    )
    return response.data
  }
}