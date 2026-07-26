"use client";

// Client boundary for the DAW: the panel is 100% Web-Audio-dependent, so it
// never renders on the server and its chunk loads only on /daw.
import dynamic from "next/dynamic";

const StudioPanel = dynamic(() => import("./StudioPanel").then((m) => m.StudioPanel), {
  ssr: false,
});

export function StudioClient() {
  return <StudioPanel />;
}
