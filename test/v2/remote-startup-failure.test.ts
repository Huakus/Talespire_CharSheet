// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountRemoteStartupFailure } from "../../src/ui/remote-startup-failure";

afterEach(() => { document.body.replaceChildren(); });

function root(): HTMLElement {
  const element = document.createElement("main");
  document.body.append(element);
  return element;
}

describe("remote startup recovery", () => {
  it("keeps recovery actions when the startup handler replaces appRoot", () => {
    const app = root();
    const retry = vi.fn(), changeCampaign = vi.fn();
    const panel = mountRemoteStartupFailure(app, {
      message: "Missing fragment", account: "player@example.com", campaign: "Remembered campaign",
      retry, changeCampaign,
    });
    app.replaceChildren(document.createElement("section"));
    expect(panel.isConnected).toBe(true);
    expect(panel.textContent).toContain("Remembered campaign");
    expect(panel.textContent).toContain("player@example.com");
    panel.querySelector<HTMLButtonElement>('[data-startup-action="change"]')!.click();
    expect(changeCampaign).toHaveBeenCalledOnce();
    expect(retry).not.toHaveBeenCalled();
    panel.querySelector<HTMLButtonElement>('[data-startup-action="retry"]')!.click();
    expect(retry).toHaveBeenCalledOnce();
  });

  it("displays backend messages and campaign names as text", () => {
    const text = '<img src=x onerror="alert(1)">';
    const panel = mountRemoteStartupFailure(root(), { message: text, campaign: text, retry: vi.fn() });
    expect(panel.querySelector("img")).toBeNull();
    expect(panel.querySelector("pre")!.textContent).toBe(text);
    expect(panel.querySelector<HTMLButtonElement>('[data-startup-action="change"]')!.hidden).toBe(true);
    expect(panel.querySelector<HTMLButtonElement>('[data-startup-action="signout"]')!.hidden).toBe(true);
  });

  it("lets the user retry sign-out after an authentication failure", async () => {
    const signOut = vi.fn().mockRejectedValue(new Error("No connection"));
    const panel = mountRemoteStartupFailure(root(), { message: "Invalid campaign", retry: vi.fn(), signOut });
    const button = panel.querySelector<HTMLButtonElement>('[data-startup-action="signout"]')!;
    button.click();
    expect(button.disabled).toBe(true);
    await vi.waitFor(() => expect(button.disabled).toBe(false));
    expect(panel.querySelector('[role="status"]')!.textContent).toBe("No connection");
  });
});
