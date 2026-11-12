import type { Failure } from '../shared/errors'

export type ProjectNotFound = Failure<'ProjectNotFound'>

export const projectNotFound = (): ProjectNotFound => ({ type: 'ProjectNotFound', message: 'Projet introuvable.' })
