/**
 * The snippet shown in `CodeWindow`. It lives here rather than in the component:
 * a `.vue` file cannot contain a literal closing script tag inside its own script.
 */
export type CodeToken = [text: string, kind?: 'tag' | 'key' | 'fn' | 'str' | 'dim']

export const SAMPLE_CODE: CodeToken[][] = [
  [['<script setup ', 'tag'], ['lang', 'key'], ['=', 'dim'], ['"ts"', 'str'], ['>', 'tag']],
  [['const ', 'key'], ['{ data: shifts } = '], ['await ', 'key'], ['useFetch', 'fn'], ['('], ["'/api/shifts'", 'str'], [')']],
  [['const ', 'key'], ['week = '], ['useWeek', 'fn'], ['()']],
  [],
  [['function ', 'key'], ['assign', 'fn'], ['(shift: Shift, staff: Staff) {']],
  [['  shift.staffId = staff.id']],
  [['  '], ['notify', 'fn'], ['(staff, '], ['`Nouveau service ${shift.label}`', 'str'], [')']],
  [['}']],
  [['</script>', 'tag']],
  [],
  [['<template>', 'tag']],
  [['  <WeekGrid ', 'tag'], [':shifts', 'key'], ['=', 'dim'], ['"shifts"', 'str'], [' @drop', 'key'], ['=', 'dim'], ['"assign"', 'str'], [' />', 'tag']],
  [['</template>', 'tag']],
]
