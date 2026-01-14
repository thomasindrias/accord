import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import * as host from "./index";

describe("host runtime", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    host._resetForTest();
    document.head.innerHTML = "";
  });

  it("loads a remote script once per url", async () => {
    host.registerRemote({ id: "remote-1", url: "https://example.com/remote.js" });

    const appendSpy = vi
      .spyOn(document.head, "appendChild")
      .mockImplementation((node: Node) => {
        const script = node as HTMLScriptElement;
        script.onload?.(new Event("load"));
        return node;
      });

    await host.loadRemote("remote-1");

    expect(appendSpy).toHaveBeenCalledTimes(1);
  });

  it("throws when loading an unregistered remote", async () => {
    await expect(host.loadRemote("missing-id")).rejects.toThrow(
      'Remote "missing-id" is not registered'
    );
  });

  it("dedupes concurrent remote loads by url", async () => {
    host.registerRemote({ id: "remote-2", url: "https://example.com/shared.js" });

    const appendSpy = vi
      .spyOn(document.head, "appendChild")
      .mockImplementation((node: Node) => {
        const script = node as HTMLScriptElement;
        script.onload?.(new Event("load"));
        return node;
      });

    await Promise.all([host.loadRemote("remote-2"), host.loadRemote("remote-2")]);

    expect(appendSpy).toHaveBeenCalledTimes(1);
  });

  it("clears cached script on load error", async () => {
    host.registerRemote({ id: "id", url: "https://example.com/error.js" });

    const appendSpy = vi
      .spyOn(document.head, "appendChild")
      .mockImplementation((node: Node) => {
        const script = node as HTMLScriptElement;
        script.onerror?.(new Event("error"));
        return node;
      });

    await expect(host.loadRemote("id")).rejects.toThrow(
      'Failed to load remote script for "id"'
    );
    await expect(host.loadRemote("id")).rejects.toThrow(
      'Failed to load remote script for "id"'
    );

    expect(appendSpy).toHaveBeenCalledTimes(2);
  });

  it("mounts elements with props, host api, and event validation", async () => {
    host.registerRemote({ id: "remote-3", url: "https://example.com/remote-3.js" });

    vi.spyOn(document.head, "appendChild").mockImplementation((node: Node) => {
      const script = node as HTMLScriptElement;
      queueMicrotask(() => script.onload?.(new Event("load")));
      return node;
    });

    const container = document.createElement("div");

    const onEvent = vi.fn();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const { element } = await host.mount({
      remoteId: "remote-3",
      tagName: "demo-element",
      container,
      props: {
        userId: "123",
        count: 2,
        active: true,
        hidden: false,
        complex: { nested: true }
      },
      hostApi: {
        audit: {
          log: vi.fn()
        }
      },
      onEvent,
      dev: true,
      manifest: {
        props: z.object({
          userId: z.string(),
          count: z.number(),
          active: z.boolean(),
          hidden: z.boolean(),
          complex: z.object({ nested: z.boolean() })
        }),
        events: {
          "user:selected": z.object({ id: z.string() })
        }
      }
    });

    expect(container.firstElementChild).toBe(element);
    expect(element.getAttribute("userId")).toBe("123");
    expect(element.getAttribute("count")).toBe("2");
    expect(element.getAttribute("active")).toBe("");
    expect(element.hasAttribute("hidden")).toBe(false);
    expect((element as { complex?: unknown }).complex).toEqual({ nested: true });
    expect((element as { host?: unknown }).host).toBeDefined();

    element.dispatchEvent(new CustomEvent("user:selected", { detail: { id: 42 } }));
    expect(warnSpy).toHaveBeenCalled();
    expect(onEvent).not.toHaveBeenCalled();

    element.dispatchEvent(new CustomEvent("user:selected", { detail: { id: "ok" } }));
    expect(onEvent).toHaveBeenCalledWith("user:selected", { id: "ok" });
  });

  it("renders fallback content on mount failure", async () => {
    host.registerRemote({ id: "remote-4", url: "https://example.com/remote-4.js" });

    vi.spyOn(document.head, "appendChild").mockImplementation((node: Node) => {
      const script = node as HTMLScriptElement;
      queueMicrotask(() => script.onerror?.(new Event("error")));
      return node;
    });

    const container = document.createElement("div");

    await expect(
      host.mount({
        remoteId: "remote-4",
        tagName: "demo-fallback",
        container,
        fallback: "Failed to load"
      })
    ).rejects.toThrow('Failed to load remote script for "remote-4"');

    expect(container.textContent).toBe("Failed to load");
  });

  it("throws when loading an unregistered remote", async () => {
    await expect(host.loadRemote("missing-id")).rejects.toThrow(
      'Remote "missing-id" is not registered'
    );
  });

  it("rejects and clears cache when script fails to load", async () => {
    host.registerRemote({ id: "fail-remote", url: "https://example.com/fail.js" });

    const appendSpy = vi
      .spyOn(document.head, "appendChild")
      .mockImplementation((node: Node) => {
        const script = node as HTMLScriptElement;
        // Trigger onerror asynchronously so scriptCache.set happens first
        queueMicrotask(() => script.onerror?.(new Event("error")));
        return node;
      });

    await expect(host.loadRemote("fail-remote")).rejects.toThrow(
      'Failed to load remote script for "fail-remote"'
    );

    // Second call should trigger appendChild again (cache was cleared)
    await expect(host.loadRemote("fail-remote")).rejects.toThrow(
      'Failed to load remote script for "fail-remote"'
    );

    expect(appendSpy).toHaveBeenCalledTimes(2);
  });
});
