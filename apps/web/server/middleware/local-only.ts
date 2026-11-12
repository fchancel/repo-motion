import { createError, defineEventHandler, getRequestHeader, getRequestHost } from 'nuxt/server'

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/

/**
 * This server reads folders and runs Claude Code on the user's machine: it must only
 * answer to the user's own browser, on this machine.
 * - A request addressed to another host name is refused (DNS rebinding).
 * - A request sent by another website is refused (cross-site requests to localhost).
 */
export default defineEventHandler((event) => {
  const host = getRequestHost(event)
  if (!LOCAL_HOST.test(host)) {
    throw createError({ status: 403, statusText: 'Forbidden', message: 'repo-motion only answers on localhost.' })
  }

  const origin = getRequestHeader(event, 'origin')
  if (origin && URL.parse(origin)?.host !== host) {
    throw createError({ status: 403, statusText: 'Forbidden', message: 'Cross-site requests are not allowed.' })
  }
})
