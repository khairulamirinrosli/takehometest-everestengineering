import type { Clock } from "./clock.js";
import type { IdGenerator } from "./id.js";
import { randomId } from "./id.js";
import type { LockerView } from "./locker.js";
import { generatePickupCode } from "./pickupCode.js";
import type { Size } from "./size.js";
import type { LockerRepository } from "../repository/lockerRepository.js";

export type StoreResult =
  | { status: "stored"; lockerId: string; pickupCode: string }
  | { status: "no_locker_available" };

export interface LockerBankOptions {
  repository: LockerRepository;
  clock?: Clock;
  /** Id generator for lockers. Defaults to random UUIDs; pass a short/memorable one for demos. */
  lockerIdGenerator?: IdGenerator;
  /** Id generator for packages. Not user-facing, so random UUIDs are fine as-is. */
  packageIdGenerator?: IdGenerator;
}

/**
 * Domain service coordinating locker allocation. Deliberately framework-free
 * (no Express) so it can be unit-tested directly and reused behind any
 * transport (REST, CLI, ...).
 */
export class LockerBank {
  private readonly repository: LockerRepository;
  private readonly clock: Clock;
  private readonly generateLockerId: IdGenerator;
  private readonly generatePackageId: IdGenerator;

  constructor(options: LockerBankOptions) {
    this.repository = options.repository;
    this.clock = options.clock ?? { now: () => new Date() };
    this.generateLockerId = options.lockerIdGenerator ?? randomId;
    this.generatePackageId = options.packageIdGenerator ?? randomId;
  }

  createLocker(size: Size): LockerView {
    const locker = this.repository.createLocker(this.generateLockerId(), size);
    return { ...locker, available: true };
  }

  listLockers(): LockerView[] {
    return this.repository.listLockers();
  }

  async storePackage(size: Size): Promise<StoreResult> {
    const candidates = this.repository.findAvailableLockers(size);
    const locker = candidates[0];
    if (!locker) {
      return { status: "no_locker_available" };
    }

    const pickupCode = this.generateUniquePickupCode();
    this.repository.assign(locker.id, {
      id: this.generatePackageId(),
      size,
      lockerId: locker.id,
      pickupCode,
      storedAt: this.clock.now(),
    });

    return { status: "stored", lockerId: locker.id, pickupCode };
  }

  private generateUniquePickupCode(): string {
    let code = generatePickupCode();
    while (this.repository.isPickupCodeInUse(code)) {
      code = generatePickupCode();
    }
    return code;
  }
}
