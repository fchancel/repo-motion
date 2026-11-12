import { stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { extname, isAbsolute, join, resolve } from 'node:path'
import type { AudioTracks, Result, TrackNotFound } from '@repo-motion/core'
import { err, ok } from '@repo-motion/core'

/** The formats the video engine can put under a video. */
export const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.aac'] as const

const notFound = (message: string): TrackNotFound => ({ type: 'TrackNotFound', message })

/** Finds an audio file on this machine from what the user typed. */
export class NodeAudioTracks implements AudioTracks {
  async resolve(input: string): Promise<Result<string, TrackNotFound>> {
    const typed = input.trim()
    const expanded = typed === '~' || typed.startsWith('~/') ? join(homedir(), typed.slice(1)) : typed
    if (!isAbsolute(expanded)) return err(notFound('Donnez le chemin complet du fichier audio (ex. ~/Music/son.mp3).'))

    const path = resolve(expanded)
    if (!(AUDIO_EXTENSIONS as readonly string[]).includes(extname(path).toLowerCase())) {
      return err(notFound(`Ce fichier n'est pas un son utilisable. Formats acceptés : ${AUDIO_EXTENSIONS.join(', ')}.`))
    }
    const isFile = await stat(path).then(
      (file) => file.isFile(),
      () => false,
    )
    return isFile ? ok(path) : err(notFound(`Le fichier audio « ${typed} » est introuvable.`))
  }
}
