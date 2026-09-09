// A cloud fetch can come back with an empty list for reasons that have
// nothing to do with the campus data actually being empty - the most common
// one being a Row Level Security policy that blocks anonymous reads on just
// ONE of the two tables, or the whole Supabase project being paused (both
// have actually happened to this app - see CASE_STUDY.md). Applying that
// blindly would wipe every stop/route off the screen for every visitor,
// which is exactly the kind of "looks completely broken" bug that's worse
// than any styling issue.
//
// So: only accept an empty result when we don't already have something
// better on screen. Real admin deletions go through cloudDeleteStop /
// cloudDeleteRoute directly and update state right away, so they are never
// blocked by this - this guard only ever refuses an *unexplained* empty
// result, never a deliberate one.
export function safeApply<T>(current: T[], incoming: T[]): T[] {
  return incoming.length > 0 || current.length === 0 ? incoming : current;
}
