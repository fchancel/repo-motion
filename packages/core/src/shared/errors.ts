/**
 * Every expected failure is a tagged object. Delivery adapters (HTTP, the job queue)
 * switch on `type` to translate it — the core never knows about status codes.
 */
export interface Failure<Type extends string> {
  readonly type: Type
  readonly message: string
}
