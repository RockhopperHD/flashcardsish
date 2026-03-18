# Spaced Repetition (SM-2) Feature

## What was added

A full **Spaced Repetition** study mode — the same algorithm behind Anki — was integrated into Flashcardsish as a third study mode called **"Spaced Review"**.

### Why this matters

Spaced Repetition is scientifically the most effective way to memorize information long-term. Rather than studying all cards every session, the SM-2 algorithm schedules each card to reappear right before you'd forget it:

- Easy cards → seen infrequently (weeks/months apart)
- Hard cards → seen frequently (days apart)
- Result: maximum retention for minimum time spent studying

---

## Files changed

### `types.ts`
- Added 4 optional SR fields to the `Card` interface:
  - `srInterval?: number` — current interval in days (undefined = never reviewed)
  - `srEaseFactor?: number` — ease factor, starts at 2.5, floor of 1.3
  - `srDueAt?: number` — Unix timestamp (ms) of next due date
  - `srReps?: number` — count of consecutive successful repetitions
- Added `SPACED_REPETITION = 'SPACED_REPETITION'` to the `GameState` enum

### `components/SpacedRepetitionMode.tsx` *(new file)*
Full review session UI + SM-2 logic. Key exports:
- `SpacedRepetitionMode` — the main React component
- `countDueCards(cards)` — utility used by SetDetail to show the due-count badge

### `components/SetDetail.tsx`
- Added `onStartSpacedRepetition` prop
- Imported `countDueCards` from SpacedRepetitionMode
- Added a **"Spaced Review"** button in the Study Modes grid (full-width, below Learn + Flashcards)
- Badge shows `X due` (amber) or `All caught up` (green) based on due count

### `App.tsx`
- Imported `SpacedRepetitionMode`
- Added `handleStartSpacedRepetitionFromDetail()` handler
- Passed `onStartSpacedRepetition` prop to `<SetDetail>`
- Added render block: `gameState === GameState.SPACED_REPETITION`

---

## How the SM-2 algorithm works here

| Rating | SM-2 quality | Behavior |
|--------|-------------|----------|
| **Again** (1) | q=1 | Resets reps to 0, interval stays 1 day, card re-queued in same session |
| **Hard** (2) | q=3 | Slight ease penalty, interval grows slowly |
| **Good** (3) | q=4 | Normal progression: 1d → 6d → interval × ease |
| **Easy** (4) | q=5 | Ease bonus, interval grows faster |

Ease factor is clamped to a minimum of **1.3** to prevent intervals from stagnating.

Cards with `srDueAt === undefined` are treated as **new** and always appear in a session.

---

## User experience

1. Open any card set → Set Detail page
2. See the new **"Spaced Review"** button showing how many cards are due
3. Click it → review session begins
4. Cards show **Term** side first
5. Press `Space` / `Enter` / `F` or click to reveal the **Definition**
6. Rate yourself with 4 buttons (or keyboard shortcuts `1`–`4`):
   - `1` Again — `2` Hard — `3` Good — `4` Easy
7. Each button previews the **next review date** before you click
8. "Again" cards are re-queued at the end of the session
9. Session summary shows accuracy, counts per rating
10. SR data is persisted to the set and synced via Google Drive / existing storage

---

## Tests to run

### Manual smoke tests

| # | Test | Expected |
|---|------|----------|
| 1 | Open a set → Set Detail | "Spaced Review" button appears with `X due` badge (all cards new = all due) |
| 2 | Click "Spaced Review" | Session starts, first card shows Term side |
| 3 | Press `Space` | Card flips to Definition side |
| 4 | Press `3` (Good) | Card advances, next card shown |
| 5 | Press `1` (Again) on a card | Card disappears, comes back at end of session |
| 6 | Complete all cards | Summary screen shown with stats |
| 7 | Click "Back to Set" from summary | Returns to Set Detail |
| 8 | Reload and re-open Set Detail | Due count has changed (cards rated Good/Easy now show future date) |
| 9 | Re-open "Spaced Review" immediately after session | "All caught up!" empty state shown for non-Again cards |
| 10 | Open a set with 0 due cards (all scheduled far out) | SetDetail badge says "All caught up", clicking opens "All caught up!" screen |

### SR data persistence tests

| # | Test | Expected |
|---|------|----------|
| 11 | Rate a card "Easy" | `srDueAt` is set to ~months from now, `srInterval` > 1, `srReps` = 1 |
| 12 | Rate a card "Again" | `srDueAt` = tomorrow (1 day), `srReps` = 0 |
| 13 | Rate a previously-reviewed card "Good" | Interval grows from previous interval × ease factor |
| 14 | Export set to JSON | SR fields (`srInterval`, `srEaseFactor`, `srDueAt`, `srReps`) are present on rated cards |
| 15 | Import exported set | SR fields preserved, due dates respected |

### Edge case tests

| # | Test | Expected |
|---|------|----------|
| 16 | Set with 1 card, rate "Again" | Card shown again, then session ends when rated Good/Hard/Easy |
| 17 | All cards rated "Again" repeatedly | Session keeps running, no crash |
| 18 | Set with 0 cards | "All caught up!" shown (edge case: empty set) |
| 19 | Multistudy set | Review button appears, SR works per-card |
| 20 | Keyboard shortcuts on non-flipped card | `1-4` do nothing (shouldn't rate before seeing answer) |
| 21 | Light mode | All badge colors and card styling render correctly |
| 22 | Click "Exit" mid-session | Returns to Set Detail; cards already rated have SR data saved |

### Regression tests (existing features)

| # | Test | Expected |
|---|------|----------|
| 23 | Learn mode still works | No change to Game.tsx behavior |
| 24 | Flashcards mode still works | No change to FlashcardsMode.tsx behavior |
| 25 | Set Detail edit/share/export | No regression from added prop/import |
| 26 | TypeScript build: `npx tsc --noEmit` | No new errors beyond the pre-existing two (node/vite types) |

---

## Bugs found and fixed during review

These bugs were caught during the post-implementation sweep and are already fixed in the committed code:

| Bug | Fix |
|-----|-----|
| `dangerouslySetInnerHTML` used with `renderInline()` which returns `React.ReactNode[]`, not a string — would render as `[object Object]` | Replaced with direct JSX: `{renderInline(text, key)}` for terms, `{renderMarkdown(content)}` for definitions |
| `againPending` counter counted ALL remaining cards in the queue, not just "Again" re-queues — showed misleading "4 to retry" on card 1 of 5 | Added `isRequeue?: boolean` flag to `SessionCard`; counter now filters `queue.filter(c => c.isRequeue).length` |
| Exiting mid-session via the "Exit" button discarded all SR progress for reviewed cards (ref was never flushed) | Added `handleExit()` that flushes `updatedCardsRef` to the set before calling `onExit()` |
| Double-flush risk: session completion flushed the ref, then "Back to Set" on the done screen would flush again via `handleExit` | `updatedCardsRef.current.clear()` called after every flush, making subsequent flushes no-ops |

---

## Known limitations / future work

- **"Exit" mid-session flushes updates** — cards already rated are saved. Cards not yet rated retain old SR values. This is intentional (partial progress is preserved).
- **No "Undo" on ratings** — once rated, the SR update is committed to the ref immediately. A future "Undo last card" button could be added.
- **No per-session new-card limit** — currently shows ALL new cards in one session if none have been scheduled. A "Limit to N new cards per session" setting would help large sets.
- **Custom fields shown on back** — when a card has custom fields they appear on the definition side in the SR card, matching the definition label.
- **`srDueAt` survives cloud sync** — the merge logic in `App.tsx` keeps the max of local/cloud mastery; SR fields ride along with card objects and will be preserved in Google Drive sync since they're part of the Card object.

---

## Build

```bash
npm run dev     # Dev server
npm run build   # Production build
```

No new dependencies were added. SM-2 is implemented in pure TypeScript.
