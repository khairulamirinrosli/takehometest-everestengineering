import { beforeEach, describe, expect, it, vi } from "vitest";
import { LockerBank } from "./lockerBank.js";
import { InMemoryLockerRepository } from "../repository/lockerRepository.js";

describe("LockerBank", () => {
  let repository: InMemoryLockerRepository;
  let bank: LockerBank;

  beforeEach(() => {
    repository = new InMemoryLockerRepository();
    bank = new LockerBank({ repository });
  });

  describe("createLocker", () => {
    it("creates a locker that is initially available", () => {
      const locker = bank.createLocker("MEDIUM");
      expect(locker.size).toBe("MEDIUM");
      expect(locker.available).toBe(true);
      expect(bank.listLockers()).toContainEqual(locker);
    });

    it("assigns each locker a unique id", () => {
      const a = bank.createLocker("SMALL");
      const b = bank.createLocker("SMALL");
      expect(a.id).not.toBe(b.id);
    });
  });

  describe("storePackage", () => {
    it("assigns the smallest available locker that fits the package", async () => {
      bank.createLocker("LARGE");
      const medium = bank.createLocker("MEDIUM");
      bank.createLocker("SMALL"); // too small, should be skipped

      const result = await bank.storePackage("MEDIUM");

      expect(result).toMatchObject({ status: "stored", lockerId: medium.id });
    });

    it("falls back to a larger locker when no exact-size locker is available", async () => {
      const large = bank.createLocker("LARGE");

      const result = await bank.storePackage("SMALL");

      expect(result).toMatchObject({ status: "stored", lockerId: large.id });
    });

    it("returns no_locker_available when no locker is big enough", async () => {
      bank.createLocker("SMALL");
      bank.createLocker("MEDIUM");

      const result = await bank.storePackage("LARGE");

      expect(result).toEqual({ status: "no_locker_available" });
    });

    it("returns no_locker_available when all fitting lockers are occupied", async () => {
      bank.createLocker("SMALL");
      await bank.storePackage("SMALL"); // occupies the only locker

      const result = await bank.storePackage("SMALL");

      expect(result).toEqual({ status: "no_locker_available" });
    });

    it("marks the assigned locker as unavailable afterwards", async () => {
      const locker = bank.createLocker("SMALL");
      await bank.storePackage("SMALL");

      const view = bank.listLockers().find((l) => l.id === locker.id);
      expect(view?.available).toBe(false);
    });

    it("returns a pickup code alongside the locker id on success", async () => {
      bank.createLocker("SMALL");

      const result = await bank.storePackage("SMALL");

      expect(result.status).toBe("stored");
      if (result.status === "stored") {
        expect(result.pickupCode).toMatch(/^[A-Z0-9]{6}$/);
      }
    });

    it("regenerates the pickup code if a collision is detected", async () => {
      bank.createLocker("SMALL");
      const spy = vi.spyOn(repository, "isPickupCodeInUse");
      spy.mockReturnValueOnce(true).mockReturnValue(false);

      const result = await bank.storePackage("SMALL");

      expect(result.status).toBe("stored");
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });
});
