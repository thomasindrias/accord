"use client";

import { useEffect, useRef } from "react";
import { mount, registerRemote } from "@accord/host";

const remoteId = "csx-user-card";

registerRemote({
  id: remoteId,
  url: "http://localhost:3001/csx-user-card.js"
});

export default function HomePage() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    let handle: { unmount: () => void } | null = null;

    mount({
      remoteId,
      tagName: "csx-user-card",
      container: containerRef.current,
      props: {
        userId: "user-123",
        readonly: false
      },
      hostApi: {
        audit: {
          log: (event) => {
            console.log("audit", event);
          }
        },
        nav: {
          navigate: ({ to }) => {
            console.log("navigate", to);
          }
        },
        store: {
          subscribe: () => () => undefined,
          getSnapshot: () => ({})
        }
      },
      onEvent: (eventName, payload) => {
        console.log("event", eventName, payload);
      },
      fallback: "Component failed to load",
      dev: true
    }).then((result) => {
      handle = result;
    });

    return () => {
      handle?.unmount();
    };
  }, []);

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Accord Next.js Host</h1>
      <div ref={containerRef} />
    </main>
  );
}
