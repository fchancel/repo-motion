import type { ProductBrief } from '../../domain/analysis/product-brief'
import type { Personas } from '../../domain/persona/persona'
import type { ProjectFolder } from '../../domain/project/project-folder'
import type { Failure } from '../../shared/errors'
import type { Result } from '../../shared/result'

/**
 * Whether the Claude Code installed on this machine can be used. The application never
 * signs anyone in and never sees a credential: it runs the user's own Claude Code.
 */
export type ClaudeCodeStatus =
  | { readonly state: 'missing' }
  /** `executable`: how to call it from a terminal, which matters when it is not in the PATH. */
  | { readonly state: 'signed_out'; readonly version: string; readonly executable: string }
  | { readonly state: 'ready'; readonly version: string; readonly executable: string }

export interface ClaudeCode {
  status(): Promise<ClaudeCodeStatus>
}

export interface CodebaseAnalysisRequest {
  readonly folder: ProjectFolder
  /** Called with a short description each time Claude moves on to something new. */
  readonly onActivity?: (activity: string) => void
}

export interface CodebaseAnalysisFailed extends Failure<'CodebaseAnalysisFailed'> {
  /** True when trying again may succeed (rate limit, timeout), false when the setup or the input is the problem. */
  readonly retryable: boolean
}

/**
 * Reads a codebase and explains what the product is, for whom, and how it looks.
 * Failures (Claude Code missing, timeout, unusable output) are returned, never thrown.
 */
export interface CodebaseAnalyzer {
  analyze(request: CodebaseAnalysisRequest): Promise<Result<ProductBrief, CodebaseAnalysisFailed>>
}

export interface PersonaWritingRequest {
  readonly brief: ProductBrief
  /** The project's folder: Claude runs there, but writes personas from the brief alone. */
  readonly folder: ProjectFolder
}

export interface PersonaWritingFailed extends Failure<'PersonaWritingFailed'> {
  readonly retryable: boolean
}

/** Imagines the product's typical users from its brief. Failures are returned, never thrown. */
export interface PersonaWriter {
  write(request: PersonaWritingRequest): Promise<Result<Personas, PersonaWritingFailed>>
}
