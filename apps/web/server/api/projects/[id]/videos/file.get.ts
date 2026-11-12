import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { ProjectId } from '@repo-motion/core'
import { createError, defineEventHandler, getQuery, getRequestHeader, getRouterParam } from 'nuxt/server'

const slug = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase() || 'video'

/**
 * Serves one persona's MP4: `?persona=Name`, and `&download` to save it instead of playing it.
 * Byte ranges are honoured, which is what lets a browser seek in the video.
 */
export default defineEventHandler(async (event) => {
  const projectId = ProjectId(getRouterParam(event, 'id') ?? '')
  const query = getQuery(event)
  const persona = typeof query.persona === 'string' ? query.persona : ''
  const { getVideoFile } = await useCases()
  const video = unwrap(await getVideoFile.execute({ projectId, persona }))

  const size = await stat(video.file).then(
    (file) => file.size,
    () => null,
  )
  if (size === null) {
    throw createError({ status: 404, statusText: 'VideoNotFound', data: { type: 'VideoNotFound', message: 'Le fichier de cette vidéo a disparu. Générez-la de nouveau.' } })
  }

  const range = /^bytes=(\d*)-(\d*)$/.exec(getRequestHeader(event, 'range') ?? '')
  const headers: Record<string, string> = {
    'content-type': 'video/mp4',
    'accept-ranges': 'bytes',
    // The address changes each time the video is produced again: it can be kept.
    'cache-control': 'private, max-age=3600',
  }
  if ('download' in query) {
    headers['content-disposition'] = `attachment; filename="${slug(video.product)}-${slug(persona)}.mp4"`
  }

  let [start, end] = [0, size - 1]
  if (range && (range[1] || range[2])) {
    // `bytes=-500` asks for the last 500 bytes.
    start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]))
    end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } })
    }
    headers['content-range'] = `bytes ${start}-${end}/${size}`
  }
  headers['content-length'] = String(end - start + 1)

  const stream = Readable.toWeb(createReadStream(video.file, { start, end })) as ReadableStream
  return new Response(stream, { status: range ? 206 : 200, headers })
})
