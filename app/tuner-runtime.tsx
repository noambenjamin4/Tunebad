"use client";

import { useEffect } from "react";
import * as lamejs from "lamejs";

export default function TunerRuntime() {
  useEffect(() => {
    window.lamejs = lamejs;
    window.TUNER_TURNSTILE_SITE_KEY =
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA";
  }, []);

  return null;
}
