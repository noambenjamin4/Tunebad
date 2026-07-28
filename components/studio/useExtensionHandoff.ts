"use client";

// Audio arriving from the TuneBad browser extension.
//
// The extension records or edits ONE clip at a time; the DAW is where several
// of them go on a timeline. Until now the only way across was Export, find the
// file, drag it back in. This is the same clip, already loaded.
//
// HOW IT GETS HERE. The extension cannot hand a page a file directly. Its
// content script — which runs on this page but in an isolated world — receives
// the bytes over chrome.runtime (JSON, so they travel base64) and re-posts
// them to the page with window.postMessage, which structured-clones, so what
// arrives here is a real Uint8Array rather than a string to parse.
//
// TRUST. A content script posts as the PAGE, so event.origin is our own origin
// and cannot tell us the extension sent it — anything already running script
// here could send the same message. That is the honest threat model, and it is
// a low bar to clear: the payload is audio the visitor then sees on their own
// timeline, and it goes through exactly the decoder a dropped file goes
// through, so malformed bytes fail the same way a corrupt file does. What this
// listener must NOT do is grow: no URLs to fetch, no options, no code. Bytes
// and a name.

import { useEffect, useRef } from "react";

/** Matches the MAX per-file expectation elsewhere; a clip is never this big. */
const MAX_HANDOFF_BYTES = 64 * 1024 * 1024;

const MESSAGE_TYPE = "tunebad:daw-handoff";
const PING = "tunebad:daw-ping";
const READY = "tunebad:daw-ready";

/** Everything here is `unknown`: it arrived from outside and is checked below. */
interface HandoffMessage {
  name: unknown;
  mime: unknown;
  bytes: unknown;
}

function fileFrom(data: HandoffMessage): File | null {
  const { name, mime, bytes } = data;
  if (!(bytes instanceof Uint8Array) && !(bytes instanceof ArrayBuffer)) return null;
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (view.byteLength === 0 || view.byteLength > MAX_HANDOFF_BYTES) return null;
  const safeName = typeof name === "string" && name.trim() ? name.trim().slice(0, 120) : "extension-clip";
  const safeMime = typeof mime === "string" && /^audio\//.test(mime) ? mime : "audio/wav";
  // Copy into a fresh buffer: the transferred one belongs to the message.
  return new File([view.slice()], safeName, { type: safeMime });
}

/**
 * Adds any clip the extension hands over. `onFiles` is the same entry point a
 * drop uses, so caps, decoding and the undo entry are all whatever they
 * already were.
 */
export function useExtensionHandoff(onFiles: (files: File[]) => void): void {
  const sink = useRef(onFiles);
  sink.current = onFiles;

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      const data = event.data as ({ type?: unknown } & HandoffMessage) | null;
      if (!data) return;
      // The bridge asks whether anyone is home. Answering covers the case
      // where it loaded AFTER this listener announced itself and missed it.
      if (data.type === PING) {
        window.postMessage({ type: READY }, window.location.origin);
        return;
      }
      if (data.type !== MESSAGE_TYPE) return;
      const file = fileFrom(data);
      if (!file) return;
      sink.current([file]);
    };
    window.addEventListener("message", onMessage);
    // Tell the content script the page is listening. It holds the bytes until
    // it hears this, so a slow hydration cannot drop the handoff on the floor.
    window.postMessage({ type: READY }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);
}
