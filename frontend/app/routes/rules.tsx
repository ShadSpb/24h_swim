import type { Route } from "./+types/rules";
import { useOutletContext } from "react-router";
import type { Language } from "../lib/i18n";
import { translations } from "../lib/i18n";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Competition Rules - 24h Swim" },
    { name: "description", content: "Official rules and guidelines for the 24-hour swimming competition" },
  ];
}

export default function Rules() {
  const context = useOutletContext<{ language: Language; t: typeof translations.en }>();
  const t = context?.t || translations.en;

  return (
    <main className="flex items-center justify-center pt-16 pb-4 w-full min-h-screen">
      <div className="flex-1 flex flex-col items-center gap-8 min-h-0 max-w-4xl px-4">
        <header className="flex flex-col items-center gap-6 w-full">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-stone-50 text-center">
            {t.rules.pageTitle}
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300 text-center">
            {t.rules.pageSubtitle}
          </p>
        </header>

        <div className="w-full space-y-6">
          {/* Limitations Section */}
          <section className="rounded-3xl border border-stone-300 dark:border-slate-700 p-8 bg-gradient-to-br from-stone-50 to-neutral-100 dark:from-slate-800 dark:to-slate-900">
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-stone-50 mb-6">
              {t.rules.limitationsTitle}
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-stone-50 mb-2">
                  1. {t.rules.limitation1Title}
                </h3>
                <p className="text-slate-700 dark:text-slate-200 mb-3">
                  {t.rules.limitation1Text}
                </p>
                <p className="text-sm bg-stone-100 dark:bg-slate-900/20 border border-stone-300 dark:border-slate-600 rounded-lg p-3 text-slate-700 dark:text-slate-200">
                  <strong>{t.rules.correction}:</strong> {t.rules.limitation1Correction}
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 dark:text-stone-50 mb-2">
                  2. {t.rules.limitation2Title}
                </h3>
                <p className="text-slate-700 dark:text-slate-200">
                  {t.rules.limitation2Text}
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 dark:text-stone-50 mb-2">
                  3. {t.rules.limitation3Title}
                </h3>
                <p className="text-slate-700 dark:text-slate-200">
                  {t.rules.limitation3Text}
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 dark:text-stone-50 mb-2">
                  4. {t.rules.limitation4Title}
                </h3>
                <p className="text-slate-700 dark:text-slate-200">
                  {t.rules.limitation4Text}
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 dark:text-stone-50 mb-2">
                  5. {t.rules.limitation5Title}
                </h3>
                <ul className="space-y-2 text-slate-700 dark:text-slate-200">
                  <li>• {t.rules.limitation5Item1}</li>
                  <li>• {t.rules.limitation5Item2}</li>
                  <li>• {t.rules.limitation5Item3}</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Rules Section */}
          <section className="rounded-3xl border border-stone-300 dark:border-slate-700 p-8 bg-gradient-to-br from-neutral-100 to-stone-50 dark:from-slate-800 dark:to-slate-900">
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-stone-50 mb-6">
              {t.rules.officialRulesTitle}
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-stone-50 mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-slate-600 dark:bg-slate-400 text-white flex items-center justify-center text-sm">1</span>
                  {t.rules.rule1Title}
                </h3>
                <p className="text-slate-700 dark:text-slate-200 ml-8">
                  {t.rules.rule1Text}
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 dark:text-stone-50 mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-slate-600 dark:bg-slate-400 text-white flex items-center justify-center text-sm">2</span>
                  {t.rules.rule2Title}
                </h3>
                <p className="text-slate-700 dark:text-slate-200 ml-8">
                  {t.rules.rule2Text}
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 dark:text-stone-50 mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-slate-600 dark:bg-slate-400 text-white flex items-center justify-center text-sm">3</span>
                  {t.rules.rule3Title}
                </h3>
                <p className="text-slate-700 dark:text-slate-200 ml-8">
                  {t.rules.rule3Text}
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 dark:text-stone-50 mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-slate-600 dark:bg-slate-400 text-white flex items-center justify-center text-sm">4</span>
                  {t.rules.rule4Title}
                </h3>
                <p className="text-slate-700 dark:text-slate-200 ml-8 mb-2">
                  {t.rules.rule4Text}
                </p>
                <p className="text-slate-700 dark:text-slate-200 ml-8 text-sm bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <strong>{t.rules.note}:</strong> {t.rules.rule4Note}
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 dark:text-stone-50 mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-slate-600 dark:bg-slate-400 text-white flex items-center justify-center text-sm">5</span>
                  {t.rules.rule5Title}
                </h3>
                <p className="text-slate-700 dark:text-slate-200 ml-8">
                  {t.rules.rule5Text}
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 dark:text-stone-50 mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-slate-600 dark:bg-slate-400 text-white flex items-center justify-center text-sm">6</span>
                  {t.rules.rule6Title}
                </h3>
                <p className="text-slate-700 dark:text-slate-200 ml-8 mb-2">
                  {t.rules.rule6Text}
                </p>
                <p className="text-slate-700 dark:text-slate-200 ml-8 text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <strong>{t.rules.critical}:</strong> {t.rules.rule6Critical}
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 dark:text-stone-50 mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-slate-600 dark:bg-slate-400 text-white flex items-center justify-center text-sm">7</span>
                  {t.rules.rule7Title}
                </h3>
                <p className="text-slate-700 dark:text-slate-200 ml-8 mb-2">
                  {t.rules.rule7Text}
                </p>
                <p className="text-slate-700 dark:text-slate-200 ml-8 text-sm bg-stone-100 dark:bg-slate-900/20 border border-stone-300 dark:border-slate-600 rounded-lg p-3">
                  <strong>{t.rules.note}:</strong> {t.rules.rule7Note}
                </p>
              </div>
            </div>
          </section>

          {/* Age-Related Rules Section */}
          <section className="rounded-3xl border border-stone-300 dark:border-slate-700 p-8 bg-gradient-to-br from-stone-100 to-neutral-50 dark:from-slate-800 dark:to-slate-900">
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-stone-50 mb-6">
              {t.rules.specialRulesTitle}
            </h2>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-slate-600 dark:bg-slate-400 text-white">
                    ⚠
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-stone-50 mb-2">
                    {t.rules.youngSwimmersTitle}
                  </h3>
                  <ul className="space-y-2 text-slate-700 dark:text-slate-200">
                    <li>• {t.rules.youngSwimmers1}</li>
                    <li>• {t.rules.youngSwimmers2}</li>
                    <li>• {t.rules.youngSwimmers3}</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* System Components Section */}
          <section className="rounded-3xl border border-stone-300 dark:border-slate-700 p-8 bg-neutral-50 dark:bg-slate-800">
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-stone-50 mb-6">
              {t.rules.systemComponentsTitle}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-stone-100 dark:bg-slate-700">
                <h3 className="font-semibold text-slate-900 dark:text-stone-50 mb-2">
                  {t.rules.organizer}
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-200">
                  {t.rules.organizerDesc}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-stone-100 dark:bg-slate-700">
                <h3 className="font-semibold text-slate-900 dark:text-stone-50 mb-2">
                  {t.rules.teams}
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-200">
                  {t.rules.teamsDesc}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-stone-100 dark:bg-slate-700">
                <h3 className="font-semibold text-slate-900 dark:text-stone-50 mb-2">
                  {t.rules.referees}
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-200">
                  {t.rules.refereesDesc}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-stone-100 dark:bg-slate-700">
                <h3 className="font-semibold text-slate-900 dark:text-stone-50 mb-2">
                  {t.rules.lanes}
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-200">
                  {t.rules.lanesDesc}
                </p>
              </div>
            </div>
          </section>

          {/* Competition Goals Section */}
          <section className="rounded-3xl border border-stone-300 dark:border-slate-700 p-8 bg-gradient-to-br from-neutral-100 to-stone-50 dark:from-slate-800 dark:to-slate-900">
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-stone-50 mb-6">
              {t.rules.competitionGoalsTitle}
            </h2>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-slate-600 dark:text-slate-300 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-slate-700 dark:text-slate-200">
                  {t.rules.goal1}
                </span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-slate-600 dark:text-slate-300 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-slate-700 dark:text-slate-200">
                  {t.rules.goal2}
                </span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-slate-600 dark:text-slate-300 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-slate-700 dark:text-slate-200">
                  {t.rules.goal3}
                </span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-slate-600 dark:text-slate-300 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-slate-700 dark:text-slate-200">
                  {t.rules.goal4}
                </span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-slate-600 dark:text-slate-300 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-slate-700 dark:text-slate-200">
                  {t.rules.goal5}
                </span>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
