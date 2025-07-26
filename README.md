# App Store Connect Build Wait

[![CI](https://github.com/yorifuji/asc-wait/actions/workflows/ci.yml/badge.svg)](https://github.com/yorifuji/asc-wait/actions/workflows/ci.yml)
[![Check dist/](https://github.com/yorifuji/asc-wait/actions/workflows/check-dist.yml/badge.svg)](https://github.com/yorifuji/asc-wait/actions/workflows/check-dist.yml)
[![Coverage](./badges/coverage.svg)](./badges/coverage.svg)

A GitHub Action that waits for App Store Connect build processing to complete. This action monitors the processing state of a specific build and waits until it becomes valid.

## Features

- 🕐 Wait for App Store Connect build processing to complete
- 🔍 Find builds by version and build number
- ⏱️ Configurable timeout and polling intervals
- 🔐 Secure JWT authentication
- 📊 Detailed progress logging

## Usage

```yaml
- name: Wait for Build Processing
  uses: yorifuji/asc-wait@v1
  with:
    issuer-id: ${{ secrets.ASC_ISSUER_ID }}
    key-id: ${{ secrets.ASC_KEY_ID }}
    key: ${{ secrets.ASC_PRIVATE_KEY }}
    bundle-id: com.example.app
    version: "1.2.0"
    build-number: "123"
    timeout: 1200  # Optional: default 20 minutes
    interval: 30   # Optional: default 30 seconds
```

## Inputs

| Name | Description | Required | Default |
|------|-------------|----------|---------|
| `issuer-id` | App Store Connect API Issuer ID | ✅ | - |
| `key-id` | App Store Connect API Key ID | ✅ | - |
| `key` | App Store Connect API Private Key | ✅ | - |
| `bundle-id` | Bundle ID of the app | ✅ | - |
| `version` | Version to check (e.g., "1.2.0") | ✅ | - |
| `build-number` | Build number to check | ✅ | - |
| `timeout` | Timeout in seconds (60-1200) | ❌ | `1200` |
| `interval` | Polling interval in seconds | ❌ | `30` |

## Outputs

| Name | Description |
|------|-------------|
| `build-id` | ID of the processed build |
| `processing-state` | Final processing state |
| `version` | Version of the build |
| `build-number` | Build number |
| `elapsed-time` | Time taken for processing in seconds |

## Example Workflow

Here's a complete example that uploads a build to App Store Connect and waits for processing:

```yaml
name: Deploy to App Store Connect

on:
  push:
    branches: [main]

jobs:
  upload:
    runs-on: macos-latest
    outputs:
      version: ${{ steps.version.outputs.version }}
      build-number: ${{ steps.version.outputs.build-number }}
    steps:
      - uses: actions/checkout@v4
      
      - name: Get Version Info
        id: version
        run: |
          VERSION=$(xcrun agvtool what-marketing-version -terse1)
          BUILD=$(xcrun agvtool what-version -terse)
          echo "version=$VERSION" >> $GITHUB_OUTPUT
          echo "build-number=$BUILD" >> $GITHUB_OUTPUT
      
      - name: Build and Upload
        run: |
          # Your build and upload commands here
          xcrun altool --upload-app -f MyApp.ipa -t ios \
            --apiKey ${{ secrets.ASC_KEY_ID }} \
            --apiIssuer ${{ secrets.ASC_ISSUER_ID }}

  wait:
    needs: upload
    runs-on: ubuntu-latest
    steps:
      - name: Wait for Build Processing
        uses: yorifuji/asc-wait@v1
        with:
          issuer-id: ${{ secrets.ASC_ISSUER_ID }}
          key-id: ${{ secrets.ASC_KEY_ID }}
          key: ${{ secrets.ASC_PRIVATE_KEY }}
          bundle-id: com.example.app
          version: ${{ needs.upload.outputs.version }}
          build-number: ${{ needs.upload.outputs.build-number }}
      
      - name: Continue with deployment
        run: echo "Build processing complete!"
```

## Setup

### 1. Create App Store Connect API Key

1. Go to [App Store Connect](https://appstoreconnect.apple.com/)
2. Navigate to "Users and Access"
3. Go to the "Integrations" tab
4. Click "App Store Connect API"
5. Create a new API key with appropriate permissions
6. Download the private key (`.p8` file)

### 2. Add Secrets to GitHub

Add the following secrets to your repository:

- `ASC_ISSUER_ID`: The Issuer ID from App Store Connect
- `ASC_KEY_ID`: The Key ID from App Store Connect
- `ASC_PRIVATE_KEY`: The contents of the downloaded `.p8` file

## Build Processing States

The action monitors the following processing states:

- `PROCESSING`: Build is being processed
- `VALID`: Build processing completed successfully ✅
- `INVALID`: Build processing failed ❌
- `FAILED`: Build processing failed ❌

The action will wait until the build reaches `VALID` state or fail if it reaches `INVALID` or `FAILED` state.

## Development

### Prerequisites

- Node.js 20.x or later
- npm

### Setup

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build the action
npm run package
```

### Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run coverage

# Run tests in watch mode
npm run test:ui
```

## License

MIT