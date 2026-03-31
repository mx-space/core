import { execSync } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import axios from 'axios'

function githubToken() {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN
  try {
    return execSync('gh auth token', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return undefined
  }
}

const require = createRequire(import.meta.url)
const __dirname = fileURLToPath(new URL('.', import.meta.url))

const {
  dashboard: { repo },
} = require('./package.json')

const Package = require('./package.json')

const endpoint = `https://api.github.com/repos/${repo}/releases/latest`

const latestVersion = async () => {
  const token = githubToken()
  const res = await axios
    .get(endpoint, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
    .catch((error) => {
      console.error(error.message)
      process.exit(1)
    })
  return res.data.tag_name.replace(/^v/, '')
}
async function main() {
  const version = await latestVersion()

  Package.dashboard.version = version

  await writeFile(
    resolve(__dirname, './package.json'),
    JSON.stringify(Package, null, 2),
  )

  console.info('Updated version to', version)
}

main()
