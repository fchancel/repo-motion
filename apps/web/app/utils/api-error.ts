import type { ApiErrorData } from '#shared/types/api'

/** Reads the structured error the API attached to a failed `$fetch`. */
export const apiErrorData = (error: unknown): Partial<ApiErrorData> =>
  (error as { data?: { data?: Partial<ApiErrorData> } } | null)?.data?.data ?? {}

export const apiErrorMessage = (error: unknown): string =>
  apiErrorData(error).message ?? 'Une erreur inattendue est survenue.'
