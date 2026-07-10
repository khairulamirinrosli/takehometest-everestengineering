# Smart Package Locker Management System

Coding challenge submission for Everest Engineering. Implements Levels 1–4
(concurrency handling included, though marked optional in the brief).

## Structure

- `server/` — Express + TypeScript API, domain logic, tests (Vitest)
- `web/` — React + TypeScript UI (Vite)

## Running locally

```bash
# terminal 1 — API on http://localhost:3000
cd server && npm install && npm run dev

# terminal 2 — UI on http://localhost:5173 (proxies /api to the server)
cd web && npm install && npm run dev
```

Then open http://localhost:5173. Three panels: create lockers and store a
package as the delivery agent, then retrieve it as the customer using the
locker ID and pickup code shown. For a fast demo loop: after storing, the
locker tile itself shows the pickup code — click it to auto-fill the
Customer panel.

## Testing

```bash
cd server && npm test
```

82 tests: domain unit tests, repository unit tests, Express integration
tests (supertest), and a concurrency test that fires many simultaneous
store requests against a small pool of lockers.

Level 3's tiered storage fee can also be checked **live**, through the
actual running server, without waiting real days — see "Demoing Level 3
live" in `server/README.md` (`ENABLE_DEV_CLOCK=true`, then
`POST /dev/clock/advance`).

## Architecture

The domain logic (`server/src/domain/`) has no dependency on Express — it's
plain TypeScript, tested directly without spinning up HTTP. `LockerBank` is
the single entry point coordinating allocation, retrieval, and pricing; it
depends only on a `LockerRepository` interface (swappable for a persistent
store later) and an injected `Clock` (so time-dependent behavior is
deterministic in tests, not tied to wall-clock time). The Express layer in
`server/src/api/` is a thin adapter: it validates input, calls into
`LockerBank`, and maps structured domain results to HTTP status codes.

## Design decisions & assumptions

- **Smallest-fit allocation.** Sizes are an ordered enum (`SMALL < MEDIUM <
  LARGE`); a package fits a locker of equal or greater size. Among fitting,
  unoccupied lockers, the smallest is always chosen.
- **Locker ids are short and friendly** (`L1-4821`, `L2-0193`, ...) rather
  than UUIDs, so they're easy to read and type by hand while demoing.
  Uniqueness comes from the sequential part alone — the random suffix just
  avoids looking like a raw guessable counter. This is a readability
  tradeoff, not a security one: retrieval still requires the pickup code,
  which carries the actual entropy (33^6 ≈ 1.3 billion combinations).
  Package ids stay random UUIDs since they're internal and never
  user-facing.
- **`GET /lockers` includes the current occupant's pickup code, store
  time, and last-retrieved time.** This is deliberately more than a
  typical customer-facing listing would expose — it's a single shared
  demo/ops view where the delivery agent and customer use the same
  screen, so seeing "what's in locker L1 right now" is the point rather
  than a leak. A multi-tenant, customer-facing version of this API would
  not return another customer's pickup code from a general listing
  endpoint. The UI uses this to show the code directly on an occupied
  tile and let clicking it fill in the Customer panel.
- **Pickup codes** are 6-character alphanumeric (ambiguous characters like
  `0`/`O`, `1`/`I`/`L` excluded), unique among currently *active* packages
  only — a code can be reused once its package is retrieved. Delivery to
  the customer (SMS/email) is out of scope, per the brief.
- **Billed days** = `max(1, ceil(hours_stored / 24))`. An instant pickup
  still incurs a 1-day minimum charge; any partial day rounds up.
- **Tiered pricing**: `X`/day for days 1–5, `2X`/day for days 6–10, `3X`/day
  for day 11 onward, where `X` (`ratePerDay`) defaults to 10 and is
  configurable per `LockerBank` instance.
- **Retrieval error codes** are distinguished by cause: unknown locker ID
  and an empty locker both return 404 (nothing to retrieve); a locker with
  an active package but a wrong pickup code returns 400 (bad credentials
  for an otherwise-valid request). A failed attempt never releases the
  locker.
- **Concurrency (Level 4).** The in-memory repository's find-then-assign is
  synchronous, so Node's single-threaded execution already makes it atomic
  today. A `Mutex` around that critical section makes the guarantee
  explicit and keeps it correct even if the repository later gains real
  `await` boundaries (e.g. a database). A test fires 20 concurrent store
  requests at 5 lockers and asserts: exactly 5 succeed, none share a locker
  or pickup code, and the rest are cleanly rejected.
- **Extensibility.** New locker sizes just extend the `Size` enum (ranking
  and fit logic are generic). A persistent store means implementing
  `LockerRepository` against a database — `LockerBank` doesn't change. A
  new interface (CLI, gRPC, etc.) can call `LockerBank` directly without
  touching Express.

## Commit history

Each commit is a complete, independently green (typecheck + tests + build)
step through the levels: setup → domain types → Level 1 → Level 2 → Level
3 → Level 4 → UI.
