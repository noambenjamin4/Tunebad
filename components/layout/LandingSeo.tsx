"use client";

// Homepage-only About/FAQ section. A client component so it renders in the
// visitor's language via i18n, while still landing in the server HTML in
// English (the I18nProvider's SSR default locale is "en"), which is what
// crawlers index. The FAQPage JSON-LD stays canonical English regardless of
// the visitor's locale.
import { useI18n } from "@/lib/i18n";
import en from "@/lib/i18n/locales/en";
import type { DictKey } from "@/lib/i18n/locales/en";

const VALUE_KEYS: { title: DictKey; body: DictKey }[] = [
  { title: "landing.value1Title", body: "landing.value1Body" },
  { title: "landing.value2Title", body: "landing.value2Body" },
  { title: "landing.value3Title", body: "landing.value3Body" },
  { title: "landing.value4Title", body: "landing.value4Body" },
];

// The "tour" grid below the value cards: one line per tool, each with a real
// link so it also works as a plain sitemap for crawlers.
const TOUR_KEYS: { title: DictKey; body: DictKey; link: DictKey; href: string }[] = [
  { title: "landing.tour1Title", body: "landing.tour1Body", link: "landing.tour1Link", href: "/key-bpm-finder" },
  { title: "landing.tour2Title", body: "landing.tour2Body", link: "landing.tour2Link", href: "/songs" },
  { title: "landing.tour3Title", body: "landing.tour3Body", link: "landing.tour3Link", href: "/mp3-cutter" },
  { title: "landing.tour4Title", body: "landing.tour4Body", link: "landing.tour4Link", href: "/slowed-reverb" },
  { title: "landing.tour5Title", body: "landing.tour5Body", link: "landing.tour5Link", href: "/loudness" },
  { title: "landing.tour6Title", body: "landing.tour6Body", link: "landing.tour6Link", href: "/tools" },
];

// Some FAQ answers point at a specific tool. `t()` only does plain-text
// interpolation, so a link can't live inside the answer string itself — the
// answer is written as a complete sentence on its own, and the link (when
// present) is a separate translated call-to-action appended after it. Same
// pattern as the dbProof line above the value cards.
const FAQ_KEYS: { q: DictKey; a: DictKey; linkHref?: string; linkText?: DictKey }[] = [
  { q: "landing.faq1Q", a: "landing.faq1A" },
  { q: "landing.faq2Q", a: "landing.faq2A" },
  { q: "landing.faq3Q", a: "landing.faq3A" },
  { q: "landing.faq4Q", a: "landing.faq4A" },
  { q: "landing.faq5Q", a: "landing.faq5A" },
  { q: "landing.faq6Q", a: "landing.faq6A" },
  { q: "landing.faq7Q", a: "landing.faq7A", linkHref: "/camelot-wheel", linkText: "landing.faq7Link" },
  { q: "landing.faq8Q", a: "landing.faq8A", linkHref: "/playlist-analyzer", linkText: "landing.faq8Link" },
  { q: "landing.faq9Q", a: "landing.faq9A" },
  { q: "landing.faq10Q", a: "landing.faq10A", linkHref: "/mp3-cutter", linkText: "landing.faq10Link" },
  { q: "landing.faq11Q", a: "landing.faq11A", linkHref: "/loudness", linkText: "landing.faq11Link" },
  { q: "landing.faq12Q", a: "landing.faq12A", linkHref: "/tunebad-vs-tunebat", linkText: "landing.faq12Link" },
];

// Canonical English schema, independent of the visitor's UI language.
const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_KEYS.map((k) => ({
    "@type": "Question",
    name: en[k.q],
    acceptedAnswer: { "@type": "Answer", text: en[k.a] },
  })),
};

export function LandingSeo({ songCount }: { songCount?: number }) {
  const { t } = useI18n();
  return (
    <section className="seo-landing" aria-label="About TuneBad">
      <div className="seo-inner">
        <h2 className="seo-heading">{t("landing.heading")}</h2>
        <p className="seo-lede">{t("landing.lede")}</p>
        {songCount != null && songCount > 100 && (
          <p className="seo-lede seo-db-proof">
            {t("landing.dbProof", { count: songCount.toLocaleString("en-US") })}{" "}
            <a href="/songs">{t("landing.dbBrowse")}</a>
            {" · "}
            <a href="/camelot-wheel">{t("landing.dbWheel")}</a>
          </p>
        )}

        <ul className="seo-values">
          {VALUE_KEYS.map((v) => (
            <li key={v.title} className="seo-value">
              <h3>{t(v.title)}</h3>
              <p>{t(v.body)}</p>
            </li>
          ))}
        </ul>

        <h2 className="seo-heading seo-heading-tour">{t("landing.tourHeading")}</h2>
        <ul className="seo-values seo-tour">
          {TOUR_KEYS.map((item) => (
            <li key={item.title} className="seo-value seo-tour-item">
              <h3>{t(item.title)}</h3>
              <p>{t(item.body)}</p>
              <a href={item.href} className="seo-tour-link">
                {t(item.link)}
              </a>
            </li>
          ))}
        </ul>

        <h2 className="seo-heading seo-heading-faq">{t("landing.faqHeading")}</h2>
        <div className="seo-faq">
          {FAQ_KEYS.map((f) => (
            <details key={f.q} className="seo-faq-item">
              <summary>{t(f.q)}</summary>
              <p>
                {t(f.a)}
                {f.linkHref && f.linkText && (
                  <>
                    {" "}
                    <a href={f.linkHref}>{t(f.linkText)}</a>
                  </>
                )}
              </p>
            </details>
          ))}
        </div>
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }} />
    </section>
  );
}
