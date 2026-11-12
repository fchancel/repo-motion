import type {
  AddProjectError,
  ChooseScriptError,
  ChooseStyleError,
  ProjectNotFound,
  RequestAnalysisError,
  RequestPersonasError,
  RequestVideoError,
  SetUpVideosError,
  SuggestStylesError,
  Result,
  VideoNotFound,
  WorkInProgress,
} from '@repo-motion/core'
import { createError } from 'nuxt/server'
import type { ApiErrorData } from '#shared/types/api'

type UseCaseFailure =
  | ProjectNotFound
  | AddProjectError
  | RequestAnalysisError
  | RequestPersonasError
  | RequestVideoError
  | ChooseScriptError
  | SetUpVideosError
  | ChooseStyleError
  | SuggestStylesError
  | VideoNotFound
  | WorkInProgress

/**
 * The only place that knows about HTTP status codes. `Record` makes it exhaustive:
 * adding a failure type to a use case breaks the build until it is mapped here.
 */
const STATUS_BY_FAILURE: Record<UseCaseFailure['type'], number> = {
  ProjectNotFound: 404,
  FolderNotFound: 422,
  ProjectAlreadyAdded: 409,
  ClaudeCodeNotReady: 409,
  InvalidAnalysisTransition: 409,
  InvalidPersonasTransition: 409,
  BriefRequired: 409,
  PersonaNotFound: 404,
  InvalidVideoTransition: 409,
  VideoNotFound: 404,
  InvalidVideoSetup: 422,
  InvalidVideoStyle: 422,
  InvalidScript: 422,
  PersonasRequired: 409,
  // Claude was asked while the user waits, and did not answer usably.
  StyleSuggestionFailed: 502,
  TrackNotFound: 422,
  WorkInProgress: 409,
}

const toHttpError = (failure: UseCaseFailure) => {
  // What is wrong with a form is said in full: the message alone would not tell which field.
  const message =
    failure.type === 'InvalidVideoSetup' || failure.type === 'InvalidVideoStyle' || failure.type === 'InvalidScript'
      ? failure.violations.join(' ')
      : failure.message
  const data: ApiErrorData = { type: failure.type, message }
  if (failure.type === 'ProjectAlreadyAdded') data.projectId = failure.projectId
  // The status line only carries ASCII: the user-facing (French) message travels in `data`.
  return createError({ status: STATUS_BY_FAILURE[failure.type], statusText: failure.type, data })
}

/** Returns the value, or throws the matching HTTP error. */
export const unwrap = <T>(result: Result<T, UseCaseFailure>): T => {
  if (!result.ok) throw toHttpError(result.error)
  return result.value
}
