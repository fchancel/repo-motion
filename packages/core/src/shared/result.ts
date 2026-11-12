/**
 * Expected failures are values, not exceptions.
 * Exceptions are reserved for bugs and infrastructure crashes.
 */
export type Result<T, E> = Ok<T> | Err<E>

export interface Ok<T> {
  readonly ok: true
  readonly value: T
}

export interface Err<E> {
  readonly ok: false
  readonly error: E
}

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value })

export const err = <E>(error: E): Err<E> => ({ ok: false, error })

export const okVoid: Ok<void> = ok(undefined)
