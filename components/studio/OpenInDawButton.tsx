"use client";

// "Open in TuneBad DAW" cross-promotion button for the joiner / cutter /
// slowed-reverb pages: stashes the tool's loaded File(s) in the module-level
// handoff and client-navigates to /daw, where StudioPanel picks them up on
// mount. Renders nothing until the tool actually has a file.

import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { stashFilesForStudio } from "@/lib/files/tool-handoff";

export function OpenInDawButton({ files }: { files: (File | null)[] }) {
  const router = useRouter();
  const { t } = useI18n();
  const real = files.filter((f): f is File => f !== null);
  if (real.length === 0) return null;
  return (
    <button
      type="button"
      className="text-button studio-open-in"
      onClick={() => {
        stashFilesForStudio(real);
        router.push("/daw");
      }}
    >
      {t("studio.openIn")}
    </button>
  );
}
