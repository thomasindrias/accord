import pTimeout from "p-timeout";
import { z } from "zod";

export type RemoteRegistration = {
  id: string;
  url: string;
  integrity?: string;
  versionRange?: string;
};

export type HostApi = {
  auth?: {
    getToken: () => Promise<string>;
  };
  audit?: {
    log: (event: { action: string; entity: string; metadata?: Record<string, unknown> }) => void;
  };
  nav?: {
    navigate: (input: { to: string }) => void;
  };
  i18n?: {
    t: (key: string, params?: Record<string, string>) => string;
  };
  theme?: {
    tokens: () => Record<string, string>;
  };
  store?: {
    subscribe: (listener: (value: unknown) => void) => () => void;
    getSnapshot: () => unknown;
  };
};

export type ManifestRuntime = {
  props?: z.ZodTypeAny;
  events?: Record<string, z.ZodTypeAny>;
};

export type MountOptions = {
  remoteId: string;
  tagName: string;
  container: HTMLElement;
  props?: Record<string, unknown>;
  hostApi?: HostApi;
  onEvent?: (eventName: string, payload: unknown) => void;
  fallback?: HTMLElement | string | (() => HTMLElement);
  timeoutMs?: number;
  dev?: boolean;
  manifest?: ManifestRuntime;
};

export type MountHandle = {
  element: HTMLElement;
  unmount: () => void;
};

type ScriptState = {
  promise: Promise<void>;
};

const remoteRegistry = new Map<string, RemoteRegistration>();
const scriptCache = new Map<string, ScriptState>();

export const registerRemote = (registration: RemoteRegistration) => {
  remoteRegistry.set(registration.id, registration);
};

export const loadRemote = async (id: string, timeoutMs = 10000): Promise<void> => {
  const registration = remoteRegistry.get(id);
  if (!registration) {
    throw new Error(`Remote \"${id}\" is not registered`);
  }

  const cached = scriptCache.get(registration.url);
  if (cached) {
    return pTimeout(cached.promise, {
      milliseconds: timeoutMs,
      message: `Timed out loading remote \"${id}\" after ${timeoutMs}ms`
    });
  }

  const scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = registration.url;
    script.async = true;
    if (registration.integrity) {
      script.integrity = registration.integrity;
      script.crossOrigin = "anonymous";
    }

    script.onload = () => {
      resolve();
    };

    script.onerror = () => {
      scriptCache.delete(registration.url);
      script.remove();
      reject(new Error(`Failed to load remote script for \"${id}\"`));
    };

    document.head.appendChild(script);
  });

  scriptCache.set(registration.url, { promise: scriptPromise });
  return pTimeout(scriptPromise, {
    milliseconds: timeoutMs,
    message: `Timed out loading remote \"${id}\" after ${timeoutMs}ms`
  });
};

const renderFallback = (
  container: HTMLElement,
  fallback: HTMLElement | string | (() => HTMLElement)
) => {
  let element: HTMLElement;
  if (typeof fallback === "function") {
    element = fallback();
  } else if (typeof fallback === "string") {
    element = document.createElement("div");
    element.textContent = fallback;
  } else {
    element = fallback;
  }

  container.replaceChildren(element);
};

const applyProps = (element: HTMLElement, props: Record<string, unknown>) => {
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined) {
      continue;
    }

    if (typeof value === "string" || typeof value === "number") {
      element.setAttribute(key, String(value));
      (element as Record<string, unknown>)[key] = value;
    } else if (typeof value === "boolean") {
      (element as Record<string, unknown>)[key] = value;
      if (value) {
        element.setAttribute(key, "");
      } else {
        element.removeAttribute(key);
      }
    } else {
      (element as Record<string, unknown>)[key] = value;
    }
  }
};

export const mount = async (options: MountOptions): Promise<MountHandle> => {
  const {
    remoteId,
    tagName,
    container,
    props = {},
    hostApi,
    onEvent,
    fallback,
    timeoutMs = 10000,
    dev = false,
    manifest
  } = options;

  try {
    await loadRemote(remoteId, timeoutMs);
    const element = document.createElement(tagName);

    if (manifest?.props && dev) {
      manifest.props.parse(props);
    }

    applyProps(element, props);

    if (hostApi) {
      (element as { host?: HostApi }).host = hostApi;
    }

    const listeners: Array<() => void> = [];

    if (manifest?.events) {
      for (const [eventName, schema] of Object.entries(manifest.events)) {
        const handler = (event: Event) => {
          const payload = (event as CustomEvent).detail;
          if (dev) {
            const result = schema.safeParse(payload);
            if (!result.success) {
              console.warn(`Invalid payload for event \"${eventName}\"`, result.error);
              return;
            }
          }
          onEvent?.(eventName, payload);
        };
        element.addEventListener(eventName, handler as EventListener);
        listeners.push(() => element.removeEventListener(eventName, handler as EventListener));
      }
    }

    container.replaceChildren(element);

    return {
      element,
      unmount: () => {
        listeners.forEach((cleanup) => cleanup());
        if (element.parentElement === container) {
          container.removeChild(element);
        }
      }
    };
  } catch (error) {
    if (fallback) {
      renderFallback(container, fallback);
    }
    throw error;
  }
};
