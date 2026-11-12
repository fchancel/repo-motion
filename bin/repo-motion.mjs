#!/usr/bin/env node
/**
 * Starts repo-motion on this machine and opens it in the browser.
 * Run it from the folder of the application you want videos for: that folder is
 * offered as the first project.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

// Optional settings, in a .env file at the root of this repository (see .env.example).
// A variable already set in the shell wins over the file.
const envFile = join(root, '.env')
if (existsSync(envFile)) process.loadEnvFile(envFile)

const server = join(root, 'apps', 'web', '.output', 'server', 'index.mjs')
const port = process.env.PORT ?? '4477'
const url = `http://localhost:${port}`

if (!existsSync(server)) {
  console.error(`repo-motion is not built yet. Run "pnpm build" in ${root}, then try again.`)
  process.exit(1)
}

const child = spawn(process.execPath, [server], {
  stdio: 'inherit',
  env: {
    ...process.env,
    // Only this machine can reach the server.
    HOST: '127.0.0.1',
    PORT: port,
    REPO_MOTION_LAUNCH_DIR: process.env.REPO_MOTION_LAUNCH_DIR ?? process.cwd(),
    // Videos are rendered by a script of this repository, wherever the server was started from.
    REPO_MOTION_RENDER_SCRIPT: process.env.REPO_MOTION_RENDER_SCRIPT ?? join(root, 'packages', 'video', 'render.mjs'),
  },
})

const open = () => {
  const [command, args] =
    process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]]
  spawn(command, args, { stdio: 'ignore', detached: true }).on('error', () => undefined).unref()
}

console.log(`repo-motion runs on ${url} (Ctrl+C to stop)`)
if (!process.env.REPO_MOTION_NO_OPEN) setTimeout(open, 800)

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
child.on('exit', (code) => process.exit(code ?? 0))
