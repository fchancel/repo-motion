#!/usr/bin/env node
// Photographs pages of a running application, the way a phone shows them.
// Usage: node capture.mjs <job.json>, where the job is { output: folder, addresses: [url, …], lenient?, language? }.
//
// Prints one JSON object per line: `{"screen":{…}}` for each page, then `{"done":true}`
// or `{"error":"…"}`. The message of an error is shown to the user as it is.
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { browserExecutable } from './lib/browser.mjs'

/** A recent phone, in CSS pixels. Pictures are twice as dense, to stay sharp once enlarged. */
const PHONE = { width: 390, height: 844, density: 2 }
const USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
/** A page is filmed over this many screens at most: nobody watches a video scroll further. */
const MAX_SCREENS = 3.2
const LOAD_TIMEOUT_MS = 25_000
/** The language of this computer: the one the application is opened in when the job names none. */
const HERE = Intl.DateTimeFormat().resolvedOptions().locale || 'en-US'

const say = (message) => process.stdout.write(`${JSON.stringify(message)}\n`)
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

/** An error whose message is meant for the user. */
class CaptureError extends Error {}

/** Starts the headless browser Remotion already installed, and finds where to talk to it. */
const launch = async () => {
  const executable = await browserExecutable()
  if (!executable) throw new CaptureError('Le navigateur de capture est introuvable.')

  const profile = await mkdtemp(join(tmpdir(), 'repo-motion-capture-'))
  const child = spawn(
    executable,
    [
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--hide-scrollbars',
      '--mute-audio',
      // Software rendering, so that pages drawing in 3D still show something.
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  )

  const endpoint = await new Promise((resolve, reject) => {
    let output = ''
    const timer = setTimeout(() => reject(new CaptureError("Le navigateur de capture n'a pas démarré.")), 15_000)
    child.stderr.on('data', (chunk) => {
      output += chunk
      const match = /DevTools listening on (ws:\/\/\S+)/.exec(output)
      if (!match) return
      clearTimeout(timer)
      resolve(match[1])
    })
    child.on('exit', () => reject(new CaptureError("Le navigateur de capture s'est arrêté au démarrage.")))
  })

  const close = async () => {
    child.kill('SIGKILL')
    await rm(profile, { recursive: true, force: true }).catch(() => undefined)
  }
  return { endpoint, close }
}

/** A minimal client of the browser's debugging protocol: commands, answers, and events. */
const connect = async (endpoint) => {
  const socket = new WebSocket(endpoint)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', () => reject(new CaptureError('Connexion au navigateur de capture impossible.')), { once: true })
  })

  let nextId = 0
  const pending = new Map()
  const listeners = new Set()

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data))
    if (message.id === undefined) return listeners.forEach((listener) => listener(message))
    const waiting = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) waiting?.reject(new Error(message.error.message))
    else waiting?.resolve(message.result)
  })

  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      nextId += 1
      pending.set(nextId, { resolve, reject })
      socket.send(JSON.stringify({ id: nextId, method, params, ...(sessionId ? { sessionId } : {}) }))
    })

  /** Resolves with the first event that matches, or with null once the time is up. */
  const once = (matches, timeoutMs) =>
    new Promise((resolve) => {
      const listener = (message) => {
        if (!matches(message)) return
        clearTimeout(timer)
        listeners.delete(listener)
        resolve(message)
      }
      const timer = setTimeout(() => {
        listeners.delete(listener)
        resolve(null)
      }, timeoutMs)
      listeners.add(listener)
    })

  return { send, once, close: () => socket.close() }
}

const capture = async (browser, address, file, locale) => {
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true })
  const page = (method, params) => browser.send(method, params, sessionId)
  const evaluate = async (expression) => (await page('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value

  try {
    await page('Page.enable')
    await page('Network.enable')
    await page('Page.setLifecycleEventsEnabled', { enabled: true })
    await page('Emulation.setDeviceMetricsOverride', { width: PHONE.width, height: PHONE.height, deviceScaleFactor: PHONE.density, mobile: true })
    await page('Emulation.setTouchEmulationEnabled', { enabled: true })
    // The application is seen in the language the video is written in.
    await page('Emulation.setUserAgentOverride', { userAgent: USER_AGENT, acceptLanguage: `${locale},${locale.split('-')[0]};q=0.9,en;q=0.5` })
    await page('Emulation.setLocaleOverride', { locale }).catch(() => undefined)

    const fromPage = (message) => message.sessionId === sessionId
    const loaded = browser.once((message) => fromPage(message) && message.method === 'Page.loadEventFired', LOAD_TIMEOUT_MS)
    const answered = browser.once(
      (message) => fromPage(message) && message.method === 'Network.responseReceived' && message.params.type === 'Document',
      LOAD_TIMEOUT_MS,
    )
    const quiet = browser.once(
      (message) => fromPage(message) && message.method === 'Page.lifecycleEvent' && message.params.name === 'networkIdle',
      LOAD_TIMEOUT_MS,
    )

    const navigation = await page('Page.navigate', { url: address })
    if (navigation.errorText) {
      throw new CaptureError(`L'application ne répond pas à ${address}. Lancez-la, puis réessayez.`)
    }
    if (!(await loaded)) throw new CaptureError(`La page ${address} met trop de temps à se charger.`)

    const status = (await Promise.race([answered, wait(500).then(() => null)]))?.params.response.status
    if (status >= 400) throw new CaptureError(`La page ${address} a répondu avec une erreur ${status}.`)
    await Promise.race([quiet, wait(8_000)])

    // A window that greets every first visit (rules, cookies, a welcome) hides what the page
    // is for. It is closed the way a visitor would: by its own button. Nothing else is clicked.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const closed = await evaluate(`(() => {
        const visible = (element) => {
          const box = element.getBoundingClientRect()
          return box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== 'hidden'
        }
        const goOn = /compris|d.accord|accepte|continuer|commencer|c.est parti|ok\\b|got it|accept|agree|continue|close|fermer|dismiss/i
        const buttons = (root) => [...root.querySelectorAll('button, [role="button"]')].filter(visible)
        const dialogs = [...document.querySelectorAll('dialog[open], [role="dialog"], [role="alertdialog"], [aria-modal="true"]')].filter(visible)
        for (const dialog of dialogs) {
          const button = buttons(dialog).find((candidate) => goOn.test(candidate.textContent ?? '')) ?? buttons(dialog).at(-1)
          if (button) return button.click(), true
        }
        // Not announced as a dialog, but laid over the whole page all the same.
        for (const button of buttons(document).filter((candidate) => goOn.test(candidate.textContent ?? ''))) {
          for (let parent = button.parentElement; parent; parent = parent.parentElement) {
            const style = getComputedStyle(parent)
            const box = parent.getBoundingClientRect()
            if (style.position === 'fixed' && box.width >= innerWidth * 0.8 && box.height >= innerHeight * 0.6) return button.click(), true
          }
        }
        return false
      })()`)
      if (!closed) break
      await wait(900)
    }

    // Walk down the page so that what loads on scroll is there, then come back to the top.
    await evaluate(`(async () => {
      const step = innerHeight * 0.8
      for (let y = 0; y < ${PHONE.height * MAX_SCREENS}; y += step) {
        scrollTo(0, y)
        await new Promise((resolve) => setTimeout(resolve, 160))
      }
      scrollTo(0, 0)
      await document.fonts.ready
    })()`)
    await wait(900)

    const title = (await evaluate('document.title')) || new URL(address).host
    const full = await evaluate('Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0)')
    const height = Math.round(Math.min(Math.max(full, PHONE.height), PHONE.height * MAX_SCREENS))

    const { data } = await page('Page.captureScreenshot', {
      format: 'jpeg',
      quality: 88,
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: PHONE.width, height, scale: 1 },
    })
    await writeFile(file, Buffer.from(data, 'base64'))
    return { address, title: String(title).slice(0, 120), file, height }
  } finally {
    await browser.send('Target.closeTarget', { targetId }).catch(() => undefined)
  }
}

const main = async () => {
  const [jobFile] = process.argv.slice(2)
  if (!jobFile) throw new Error('Usage: node capture.mjs <job.json>')
  const job = JSON.parse(await readFile(jobFile, 'utf8'))
  await mkdir(job.output, { recursive: true })

  const chrome = await launch()
  try {
    const browser = await connect(chrome.endpoint)
    // `lenient`: the pages were picked by reading the code, so one that does not open is
    // left out, as long as another does. Otherwise the user listed them, and is told which fails.
    const refused = []
    let filmed = 0
    for (const [index, address] of job.addresses.entries()) {
      try {
        say({ screen: await capture(browser, address, join(job.output, `screen-${index + 1}.jpg`), job.language || HERE) })
        filmed += 1
      } catch (error) {
        if (!job.lenient || !(error instanceof CaptureError)) throw error
        refused.push(error)
        say({ skipped: { address, reason: error.message } })
      }
    }
    browser.close()
    if (filmed === 0) throw refused[0] ?? new CaptureError("Aucune page de l'application n'a pu être filmée.")
  } finally {
    await chrome.close()
  }
  say({ done: true })
}

main().then(
  () => process.exit(0),
  (error) => {
    say({ error: error instanceof CaptureError ? error.message : "La capture de l'application a échoué." })
    console.error(error)
    process.exit(1)
  },
)
