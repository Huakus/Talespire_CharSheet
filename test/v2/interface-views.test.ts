import { beforeEach, describe, expect, it, vi } from "vitest";

const loaded = vi.hoisted(() => ({ classic: vi.fn(), next: vi.fn() }));
vi.mock("../../src/ui/classic-views", () => { loaded.classic(); return { createPlayer: vi.fn(), createGm: vi.fn() }; });
vi.mock("../../src/ui/next/next-views", () => { loaded.next(); return { createPlayer: vi.fn(), createGm: vi.fn() }; });
beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

describe("isolated presentation loading", () => {
  it("does not import Nueva when Actual is selected", async () => {
    const { loadInterfaceViews } = await import("../../src/ui/interface-views");
    await loadInterfaceViews("classic");
    expect(loaded.classic).toHaveBeenCalledOnce();
    expect(loaded.next).not.toHaveBeenCalled();
  });

  it("does not import Actual when Nueva is selected", async () => {
    const { loadInterfaceViews } = await import("../../src/ui/interface-views");
    await loadInterfaceViews("next");
    expect(loaded.next).toHaveBeenCalledOnce();
    expect(loaded.classic).not.toHaveBeenCalled();
  });
});
