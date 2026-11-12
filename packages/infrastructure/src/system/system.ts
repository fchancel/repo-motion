import { randomUUID } from 'node:crypto'
import type { Clock, IdGenerator } from '@repo-motion/core'

export class SystemClock implements Clock {
  now(): Date {
    return new Date()
  }
}

export class RandomUuidGenerator implements IdGenerator {
  next(): string {
    return randomUUID()
  }
}
