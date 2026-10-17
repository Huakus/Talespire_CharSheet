// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CampaignRepository } from "../../src/application/ports/campaign-repository";

const backend = "https://startup-test.supabase.co";
const bindingKey = `talespire-charsheet:remote-campaign:${backend}`;
const mocks = vi.hoisted(() => ({
  signOut: vi.fn(async () => ({ error: null as Error | null })),
  readCampaign: vi.fn(async () => { throw new Error("No se pudo reconstruir la campaña remota: combat.hitPoints.current"); }),
}));
vi.mock("../../src/infrastructure/remote/backend-config", () => ({
  loadRemoteBackendConfig: () => ({ url: "https://startup-test.supabase.co", publishableKey: "test" }),
}));
vi.mock("../../src/infrastructure/remote/persistence-mode", () => ({ loadPersistenceMode: () => "remote" }));
vi.mock("../../src/infrastructure/remote/supabase-campaign-document-client", async (original) => ({
  ...await original<object>(),
  createRemoteSupabaseClient: () => ({ auth: {
    getUser: async () => ({ data: { user: { id: "player", email: "player@example.com" } } }),
    signOut: mocks.signOut,
  } }),
  SupabaseCampaignDocumentClient: class {
    async listCampaigns() {
      return [{ id: "remembered", name: "Remembered campaign", ownerUserId: "owner", updatedAt: "2026-10-17T00:00:00Z" }];
    }
  },
}));
vi.mock("../../src/infrastructure/remote/supabase-campaign-fragment-client", async (original) => ({
  ...await original<object>(),
  SupabaseCampaignFragmentClient: class { readCampaign = mocks.readCampaign; },
}));
vi.mock("../../src/ui/app-user-invitations", () => ({
  mountAppInvitationAcceptance: vi.fn(), mountAppInvitationSender: vi.fn(),
}));
vi.mock("../../src/ui/app-chrome", () => ({
  registerPersistencePanelOpener: vi.fn(), setAppConnectionStatus: vi.fn(),
}));

import { configureRemotePersistence } from "../../src/ui/remote-persistence-setup";

beforeEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
  vi.clearAllMocks();
  mocks.signOut.mockResolvedValue({ error: null });
});
afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); localStorage.clear(); });

async function failOnRememberedCampaign() {
  localStorage.setItem(bindingKey, "remembered");
  localStorage.setItem("unrelated-campaign-data", "keep");
  const root = document.createElement("main");
  document.body.append(root);
  const primary = { load: vi.fn(), save: vi.fn() } as unknown as CampaignRepository;
  await expect(configureRemotePersistence(primary, root)).rejects.toThrow("combat.hitPoints.current");
  expect(primary.load).not.toHaveBeenCalled();
  expect(primary.save).not.toHaveBeenCalled();
  expect(mocks.readCampaign).toHaveBeenCalledWith("remembered");
  return document.querySelector<HTMLElement>(".remote-startup-failure")!;
}

describe("failed startup with a remembered campaign", () => {
  it("can return to the selector without deleting campaign data or signing out", async () => {
    const reload = vi.spyOn(window.location, "reload").mockImplementation(() => {});
    const panel = await failOnRememberedCampaign();
    expect(panel.textContent).toContain("Remembered campaign");
    expect(panel.textContent).toContain("player@example.com");
    expect(panel.textContent).toContain("combat.hitPoints.current");
    panel.querySelector<HTMLButtonElement>('[data-startup-action="change"]')!.click();
    expect(localStorage.getItem(bindingKey)).toBeNull();
    expect(localStorage.getItem("unrelated-campaign-data")).toBe("keep");
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledOnce();
  });

  it("keeps the remembered selection on retry", async () => {
    const reload = vi.spyOn(window.location, "reload").mockImplementation(() => {});
    const panel = await failOnRememberedCampaign();
    panel.querySelector<HTMLButtonElement>('[data-startup-action="retry"]')!.click();
    expect(localStorage.getItem(bindingKey)).toBe("remembered");
    expect(reload).toHaveBeenCalledOnce();
  });

  it("offers a local-session sign-out and preserves other local data", async () => {
    const reload = vi.spyOn(window.location, "reload").mockImplementation(() => {});
    const panel = await failOnRememberedCampaign();
    panel.querySelector<HTMLButtonElement>('[data-startup-action="signout"]')!.click();
    await vi.waitFor(() => expect(reload).toHaveBeenCalledOnce());
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(localStorage.getItem(bindingKey)).toBeNull();
    expect(localStorage.getItem("unrelated-campaign-data")).toBe("keep");
  });
});
