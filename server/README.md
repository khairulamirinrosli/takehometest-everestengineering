# Locker Server

Express + TypeScript API for the Smart Package Locker system.

## Running

```bash
npm install
npm run dev      # starts on http://localhost:3000 (PORT env var to override)
```

## Testing

```bash
npm test
npm run test:watch
npm run typecheck
npm run build      # compiles to dist/
```

Level 3 (tiered storage fee) specifically is covered at three layers —
pure function boundary tests, domain integration tests with a fake clock,
and HTTP-level tests:

```bash
npx vitest run src/domain/pricing.test.ts src/domain/lockerBank.test.ts src/api/routes.test.ts
```

## API

| Method | Path        | Body                                   | Success                                                     | Notes                                                                                 |
| ------ | ----------- | -------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| POST   | `/lockers`  | `{ size: "SMALL"\|"MEDIUM"\|"LARGE" }` | 201 `{ id, size, available }`                               |                                                                                       |
| GET    | `/lockers`  | —                                      | 200 `LockerView[]`                                          | includes `pickupCode`/`storedAt` while occupied, `lastRetrievedAt` if previously used |
| POST   | `/packages` | `{ size }`                             | 201 `{ lockerId, pickupCode }`                              | 422 if no locker fits/is free                                                         |
| POST   | `/pickups`  | `{ lockerId, pickupCode }`             | 200 `{ lockerId, packageId, size, daysStored, feeCharged }` | 404 unknown locker / empty locker, 400 wrong code                                     |

### Demoing Level 3 live (no waiting real days)

The server normally runs on the real system clock. To manually watch the
tiered storage fee apply through the running app instead of trusting the
test suite, start it with the dev clock enabled:

```bash
ENABLE_DEV_CLOCK=true npm run dev
```

This mounts two extra routes (absent otherwise — `GET /dev/clock` returns
404 without the flag):

| Method | Path                 | Body                | Effect                           |
| ------ | -------------------- | ------------------- | -------------------------------- |
| GET    | `/dev/clock`         | —                   | current server time              |
| POST   | `/dev/clock/advance` | `{ hours: number }` | fast-forwards the server's clock |

```bash
# store a package, then jump 6 days forward and retrieve it
curl -X POST localhost:3000/lockers  -d '{"size":"SMALL"}' -H 'Content-Type: application/json'
curl -X POST localhost:3000/packages -d '{"size":"SMALL"}' -H 'Content-Type: application/json'
curl -X POST localhost:3000/dev/clock/advance -d '{"hours":144}' -H 'Content-Type: application/json'
curl -X POST localhost:3000/pickups  -d '{"lockerId":"<id>","pickupCode":"<code>"}' -H 'Content-Type: application/json'
# -> daysStored: 6, feeCharged: 70  (5 days @ X=10 + 1 day @ 2X=20)
```

## Layout

```
src/
  domain/       pure business logic — no Express dependency
  repository/   storage interface + in-memory implementation
  api/          Express routes and app wiring
  testUtils/    FakeClock etc., shared across test files
```
