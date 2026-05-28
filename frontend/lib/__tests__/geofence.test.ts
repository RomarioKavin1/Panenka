import { describe, it, expect } from "vitest";
import { resolvePosture } from "../geofence";

describe("geofence — resolvePosture", () => {
  it("allows everything for an unknown ISO code (default)", () => {
    const p = resolvePosture("ZZ");
    expect(p.free).toBe("allow");
    expect(p.paid).toBe("allow");
  });

  it("blocks paid contests for a restricted US state", () => {
    expect(resolvePosture("US-NV").paid).toBe("block");
    expect(resolvePosture("US-NV").free).toBe("allow");
    expect(resolvePosture("US-HI").paid).toBe("block");
    expect(resolvePosture("US-LA").paid).toBe("block");
    expect(resolvePosture("US-ID").paid).toBe("block");
    expect(resolvePosture("US-MT").paid).toBe("block");
    expect(resolvePosture("US-WA").paid).toBe("block");
  });

  it("requires KYC for paid in Belgium / Norway / Singapore", () => {
    expect(resolvePosture("BE").paid).toBe("kyc");
    expect(resolvePosture("NO").paid).toBe("kyc");
    expect(resolvePosture("SG").paid).toBe("kyc");
  });

  it("blocks all participation in sanctioned countries", () => {
    for (const iso of ["KP", "IR", "CU", "SY", "CN"]) {
      const p = resolvePosture(iso);
      expect(p.free).toBe("block");
      expect(p.paid).toBe("block");
    }
  });

  it("allows by default for a non-restricted US state", () => {
    expect(resolvePosture("US-CA").free).toBe("allow");
    expect(resolvePosture("US-CA").paid).toBe("allow");
  });

  it("is case-insensitive on the ISO code", () => {
    expect(resolvePosture("us-nv").paid).toBe("block");
    expect(resolvePosture("be").paid).toBe("kyc");
  });
});
