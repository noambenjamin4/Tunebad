declare module "lamejs" {
  export class Mp3Encoder {
    constructor(channels: number, sampleRate: number, kbps: number);
    encodeBuffer(left: Int16Array, right?: Int16Array): Int8Array;
    flush(): Int8Array;
  }

  export const WavHeader: unknown;
}

interface Window {
  lamejs?: typeof import("lamejs");
  TUNER_TURNSTILE_SITE_KEY?: string;
  turnstile?: {
    render: (
      selector: string | HTMLElement,
      options: {
        sitekey: string;
        action?: string;
        theme?: "light" | "dark" | "auto";
        callback?: (token: string) => void;
        "expired-callback"?: () => void;
        "error-callback"?: () => void;
      },
    ) => string;
    reset: (widgetId?: string) => void;
  };
}
