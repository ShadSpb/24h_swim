import type { Route } from "./+types/about";
import { useOutletContext } from "react-router";
import type { Language } from "../lib/i18n";
import { translations } from "../lib/i18n";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "About Competition - 24h Swim" },
    { name: "description", content: "Learn about the 24-hour swimming competition" },
  ];
}

export default function About() {
  const context = useOutletContext<{ language: Language; t: typeof translations.en }>();
  const t = context?.t || translations.en;

  return (
    <main className="flex items-center justify-center pt-16 pb-4 w-full min-h-screen">
      <div className="flex-1 flex flex-col items-center gap-8 min-h-0 max-w-4xl px-4">
        <div className="w-full space-y-6">
          {/* Competition Details */}
          <section className="rounded-3xl border-2 border-stone-300 dark:border-slate-600 p-8 bg-gradient-to-br from-stone-50 to-neutral-100 dark:from-slate-800 dark:to-slate-900 shadow-md hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-3 mb-6">
              <svg className="w-8 h-8 text-slate-600 dark:text-slate-300" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11 5H5a2 2 0 00-2 2v12a2 2 0 002 2h14a2 2 0 002-2v-5m-7 1l7-7m0 0V8m0 0H9"/>
              </svg>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-slate-600 to-slate-700 dark:from-slate-300 dark:to-slate-400 bg-clip-text text-transparent">
                {t.about.detailsTitle}
              </h2>
            </div>
            <p className="text-slate-700 dark:text-slate-200 mb-6 leading-relaxed text-lg">
              {t.about.detailsDescription}
            </p>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-slate-600 dark:bg-slate-400 mt-2 flex-shrink-0"></span>
                <span className="text-slate-700 dark:text-slate-200">
                  <strong>{t.about.duration}:</strong> {t.about.durationValue}
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-slate-600 dark:bg-slate-400 mt-2 flex-shrink-0"></span>
                <span className="text-slate-700 dark:text-slate-200">
                  <strong>{t.about.participants}:</strong> {t.about.participantsValue}
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-slate-600 dark:bg-slate-400 mt-2 flex-shrink-0"></span>
                <span className="text-slate-700 dark:text-slate-200">
                  <strong>{t.about.categories}:</strong> {t.about.categoriesValue}
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-slate-600 dark:bg-slate-400 mt-2 flex-shrink-0"></span>
                <span className="text-slate-700 dark:text-slate-200">
                  <strong>{t.about.format}:</strong> {t.about.formatValue}
                </span>
              </li>
            </ul>
          </section>

          {/* Why Participate */}
          <section className="rounded-3xl border-2 border-stone-400 dark:border-slate-600 p-8 bg-gradient-to-br from-stone-50 to-neutral-100 dark:from-slate-800 dark:to-slate-900 shadow-md hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-3 mb-6">
              <svg className="w-8 h-8 text-slate-600 dark:text-slate-300" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-slate-600 to-slate-700 dark:from-slate-300 dark:to-slate-400 bg-clip-text text-transparent">
                {t.about.whyJoinTitle}
              </h2>
            </div>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-slate-600 dark:bg-slate-400 mt-2 flex-shrink-0"></span>
                <span className="text-slate-700 dark:text-slate-200">
                  <strong>{t.about.challenge}:</strong> {t.about.challengeDesc}
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-slate-600 dark:bg-slate-400 mt-2 flex-shrink-0"></span>
                <span className="text-slate-700 dark:text-slate-200">
                  <strong>{t.about.community}:</strong> {t.about.communityDesc}
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-slate-600 dark:bg-slate-400 mt-2 flex-shrink-0"></span>
                <span className="text-slate-700 dark:text-slate-200">
                  <strong>{t.about.recognition}:</strong> {t.about.recognitionDesc}
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-slate-600 dark:bg-slate-400 mt-2 flex-shrink-0"></span>
                <span className="text-slate-700 dark:text-slate-200">
                  <strong>{t.about.fitness}:</strong> {t.about.fitnessDesc}
                </span>
              </li>
            </ul>
          </section>

          {/* Official Rules */}
          <section className="rounded-3xl border-2 border-stone-400 dark:border-slate-600 p-8 bg-gradient-to-br from-neutral-100 to-stone-50 dark:from-slate-800 dark:to-slate-900 shadow-md hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-3 mb-6">
              <svg className="w-8 h-8 text-slate-600 dark:text-slate-300" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-slate-600 to-slate-700 dark:from-slate-300 dark:to-slate-400 bg-clip-text text-transparent">
                {t.about.rulesTitle}
              </h2>
            </div>
            <p className="text-slate-700 dark:text-slate-200 leading-relaxed mb-4">
              {t.about.rulesDesc}
            </p>
            <div className="mt-6">
              <a
                href="/rules"
                className="inline-block px-8 py-3 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 dark:from-slate-600 dark:to-slate-700 dark:hover:from-slate-500 dark:hover:to-slate-600 text-white font-bold rounded-lg transition-all transform hover:scale-102 shadow-md"
              >
                {t.about.viewRules}
              </a>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
