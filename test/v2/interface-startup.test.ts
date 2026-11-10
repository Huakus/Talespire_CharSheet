// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  playerStart: vi.fn(async () => {}), gmStart: vi.fn(async () => {}),
  createPlayer: vi.fn(), createGm: vi.fn(), loadViews: vi.fn(),
  seed: vi.fn(async () => 0), configure: vi.fn(),
  role: vi.fn(async () => "gm"),
}));
vi.mock("../../src/ui/interface-views", () => ({ loadInterfaceViews: mocks.loadViews }));
vi.mock("../../src/ui/backend-status", () => ({ mountBackendStatus: vi.fn(async () => {}) }));
vi.mock("../../src/ui/remote-persistence-setup", () => ({ configureRemotePersistence: mocks.configure }));
vi.mock("../../src/infrastructure/talespire/talespire-client-role", () => ({ resolveTaleSpireClientRole: mocks.role }));

beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks();
  localStorage.clear(); document.body.innerHTML = '<main id="app"></main>';
  window.history.replaceState(null, "", "/v2.html");
  delete window.TS;
  mocks.playerStart.mockResolvedValue(); mocks.gmStart.mockResolvedValue();
  mocks.createPlayer.mockReturnValue({ start: mocks.playerStart, stop: vi.fn(), savePendingChanges: async () => true });
  mocks.createGm.mockReturnValue({ start: mocks.gmStart, stop: vi.fn() });
  mocks.loadViews.mockResolvedValue({ createPlayer: mocks.createPlayer, createGm: mocks.createGm });
  mocks.configure.mockImplementation(async repository => repository);
});
afterEach(() => { vi.restoreAllMocks(); delete window.TS; document.body.replaceChildren(); localStorage.clear(); });

describe("interface routing in the shared startup", () => {
  it("keeps the default browser startup on Actual", async () => {
    await import("../../src/main");
    await vi.waitFor(() => expect(mocks.playerStart).toHaveBeenCalledOnce());
    expect(mocks.loadViews).toHaveBeenCalledExactlyOnceWith("classic");
    expect(mocks.gmStart).not.toHaveBeenCalled();
    expect(document.querySelector("#app")!.getAttribute("data-interface-version")).toBe("classic");
  });

  it("uses a local choice for Nueva and honors forced recovery", async () => {
    localStorage.setItem("talespire-charsheet:v2:preference:interface-version", "next");
    window.history.replaceState(null, "", "/v2.html?ui=classic");
    await import("../../src/main");
    await vi.waitFor(() => expect(mocks.playerStart).toHaveBeenCalledOnce());
    expect(mocks.loadViews).toHaveBeenCalledExactlyOnceWith("classic");
  });

  it("does not start twice or seed content when GM selects the read-only pilot", async () => {
    localStorage.setItem("talespire-charsheet:v2:preference:interface-version", "next");
    const setBlob = vi.fn(async () => {});
    window.TS = { localStorage: { campaign: { getBlob: async () => null, setBlob } },
      clients: { whoAmI: async () => ({}), getClientsInThisBoard: async () => [], getMoreInfo: async () => [] } };
    mocks.configure.mockImplementation(async (repository, _root, receive) => {
      receive({ content: { seedOfficialContent: mocks.seed } });
      return repository;
    });
    await import("../../src/main");
    expect(mocks.loadViews).not.toHaveBeenCalled();
    window.onStateChangeEvent!({ kind: "hasInitialized" });
    window.onStateChangeEvent!({ kind: "hasInitialized" });
    await vi.waitFor(() => expect(mocks.gmStart).toHaveBeenCalledOnce());
    expect(mocks.loadViews).toHaveBeenCalledExactlyOnceWith("next");
    expect(mocks.seed).not.toHaveBeenCalled();
    expect(mocks.playerStart).not.toHaveBeenCalled();
    expect(setBlob).not.toHaveBeenCalled();
  });

  it("keeps a recovery control available if the chosen module cannot load", async () => {
    localStorage.setItem("talespire-charsheet:v2:preference:interface-version", "next");
    mocks.loadViews.mockRejectedValueOnce(new Error("module unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await import("../../src/main");
    await vi.waitFor(() => expect(document.querySelector(".startup-failure")).not.toBeNull());
    expect(document.querySelector<HTMLButtonElement>("[data-interface-recovery]")!.hidden).toBe(false);
    expect(mocks.configure).not.toHaveBeenCalled();
    expect(mocks.playerStart).not.toHaveBeenCalled();
    expect(mocks.gmStart).not.toHaveBeenCalled();
  });
});
