# Manual scroll-feel pass — Scroll Engineering (Phase 5b)

Date: 2026-07-02 · Build: branch `feat/finish-the-app` · Method: live Chromium
(Playwright) against `vite dev` with a 230-message seeded transcript, driving
real wheel/scroll/click events and measuring DOM geometry between steps.

Core rule under test: **never move the reader against their intent.**

## Checklist — the 15 principles

| #   | Principle                                               | Result | Evidence                                                                                                                                                                                                                |
| --- | ------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Move only on reader intent — auto-scroll never default  | PASS   | the `[messages]` scrollIntoView effect is deleted; appends while READING produced zero programmatic movement                                                                                                            |
| 2   | Follow only while following                             | PASS   | pinned-to-bottom growth only in FOLLOWING; READING held position                                                                                                                                                        |
| 3   | Every interaction is intent                             | PASS   | wheel-up flipped state to READING before any further movement                                                                                                                                                           |
| 4   | New turn starts near top of viewport                    | PASS   | submit-while-FOLLOWING anchors the new user turn at ~24% from top (`requestMessageAnchor(id, 0.24)`)                                                                                                                    |
| 5   | Answer streams into available space                     | PASS   | streamed content grows below the anchored turn                                                                                                                                                                          |
| 6   | Part of previous turn stays visible                     | PASS   | 24% anchor leaves the prior turn's tail above the new turn                                                                                                                                                              |
| 7   | New content arrives offscreen without moving the reader | PASS   | append while READING: top message `m-127` stayed at **-57px offset, pixel-identical**, through a 200-message window slide                                                                                               |
| 8   | Show what's happening out of view                       | PASS   | jump pill counted "2 new" live; amber unread divider at first unread                                                                                                                                                    |
| 9   | Easy jump-to-latest resuming follow                     | PASS   | pill click → distanceToBottom 0, pill cleared, state FOLLOWING                                                                                                                                                          |
| 10  | Jump anywhere                                           | PASS   | unread divider + pill navigation; message-level keyboard nav (↑/↓)                                                                                                                                                      |
| 11  | Reopen at last meaningful turn                          | PASS   | reopen anchors last user message ~20% from top (incl. during an active stream)                                                                                                                                          |
| 12  | Keep place through layout changes                       | PASS   | ResizeObserver + `{messageId, offsetWithinMessage}` restore; verified through the window-slide append                                                                                                                   |
| 13  | Interruptions never steal position                      | PASS   | Stop preserves anchor; focus moves to the stopped article (preventScroll)                                                                                                                                               |
| 14  | Stay responsive in long threads                         | PASS   | 230 messages → exactly 200 rendered articles + "Load earlier" with anchor restore                                                                                                                                       |
| 15  | Accessible without noise                                | PASS   | single polite live region announcing exactly {started, complete, stopped, error}; messages are focusable articles; jump focuses the latest assistant message (verified: `document.activeElement.tagName === "ARTICLE"`) |

## Recorded measurements (live browser)

- Append while READING: scrollTop 6380 → 6288 (window-slide compensation),
  visual anchor `m-127 @ -57px` → `m-127 @ -57px` (**anchor held exactly**).
- Jump-to-latest: distanceToBottom **0px**, unread pill removed, focus landed
  on the newest assistant `<article>`.
- Rendered articles with 232-message store: **200** + Load earlier button.

Re-run procedure: `GAME_THEORY_ANALYSIS_TEST_MODE=1 bun run dev`, open
`/editor`, seed messages via the ai-store in the console, then walk the
checklist above.
