/*
 * Whether the job sheet on screen was opened from a list in this tab. If so,
 * closing it goes Back (the list is the previous history entry, scroll and
 * all); a deep link from an email or another tab has no such entry, so
 * closing replaces the URL with the list instead.
 */
let fromList = false;

export function markOpenedFromList() {
  fromList = true;
}

export function takeOpenedFromList(): boolean {
  const was = fromList;
  fromList = false;
  return was;
}

export function peekOpenedFromList(): boolean {
  return fromList;
}
