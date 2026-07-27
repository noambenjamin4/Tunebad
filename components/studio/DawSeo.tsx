"use client";

// The readable half of /daw: what the tool is, how a beat switch is actually
// made, and which of the four overlapping audio tools a visitor wants.
//
// The page was the editor, a FAQ, and nothing else — no prose a search engine
// or an answer engine could quote, and a single inbound link on the whole
// site. Same pattern as ToolFaq: a client component so it reads in the
// visitor's language, but the I18nProvider SSRs English so crawlers get the
// English copy in the server HTML, and the JSON-LD is built from the canonical
// English strings whatever the visitor's locale.
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/i18n/locales/en";
import en from "@/lib/i18n/locales/en";
import { SITE_URL } from "@/lib/site";
import { howToJsonLd } from "@/lib/seo/jsonld";

const STEP_KEYS = ["studio.how1", "studio.how2", "studio.how3", "studio.how4"] as const;

// The four tools that overlap in what they do. Naming them side by side is the
// fastest way to answer "which one do I need", which is the question the
// handoff buttons exist to paper over.
const COMPARE: { href: string; nameKey: DictKey; whenKey: DictKey }[] = [
  { href: "/daw", nameKey: "tools.cardDaw", whenKey: "studio.whenDaw" },
  { href: "/audio-joiner", nameKey: "tools.cardAudioJoiner", whenKey: "studio.whenJoiner" },
  { href: "/mp3-cutter", nameKey: "nav.cutter", whenKey: "studio.whenCutter" },
  { href: "/slowed-reverb", nameKey: "nav.remix", whenKey: "studio.whenRemix" },
];

const HOW_TO = howToJsonLd({
  name: en["studio.howHeading"],
  description: en["studio.seoLede2"],
  steps: STEP_KEYS.map((key) => en[key]),
  url: `${SITE_URL}/daw`,
});

export function DawSeo() {
  const { t } = useI18n();
  return (
    <section className="daw-seo" aria-label={en["studio.seoHeading"]}>
      <h2 className="tool-faq-heading">{t("studio.seoHeading")}</h2>
      <p className="daw-seo-lede">{t("studio.seoLede")}</p>
      <p className="daw-seo-lede">{t("studio.seoLede2")}</p>

      <h2 className="tool-faq-heading">{t("studio.howHeading")}</h2>
      <ol className="daw-steps">
        {STEP_KEYS.map((key, index) => (
          <li key={key} id={`step-${index + 1}`}>
            {t(key)}
          </li>
        ))}
      </ol>

      <h2 className="tool-faq-heading">{t("studio.compareHeading")}</h2>
      <div className="daw-compare-scroll">
        <table className="daw-compare">
          <thead>
            <tr>
              <th scope="col">{t("studio.compareTool")}</th>
              <th scope="col">{t("studio.compareWhen")}</th>
            </tr>
          </thead>
          <tbody>
            {COMPARE.map((row) => (
              <tr key={row.href}>
                <th scope="row">
                  <Link href={row.href}>{t(row.nameKey)}</Link>
                </th>
                <td>{t(row.whenKey)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(HOW_TO) }} />
    </section>
  );
}
