"use client"

// Whether you've seen this year's review yet. It appears on Stats on
// 1 December (see reviewable in yearReview); until you've looked, the nav
// says it's ready. Kept in this browser only.

const KEY = "yearReviewSeen"
export const REVIEW_SEEN_EVENT = "year-review-seen"

// this year's review is out, and you haven't looked at it yet
export function reviewWaiting(now = new Date()) {
  if (now.getMonth() !== 11) return false
  try {
    return localStorage.getItem(KEY) !== String(now.getFullYear())
  } catch {
    return false
  }
}

export function markReviewSeen(now = new Date()) {
  try {
    localStorage.setItem(KEY, String(now.getFullYear()))
  } catch {}
  window.dispatchEvent(new Event(REVIEW_SEEN_EVENT))
}
