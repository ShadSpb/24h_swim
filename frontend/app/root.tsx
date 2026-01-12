import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  Link,
} from "react-router";
import { useState, useEffect } from "react";

import type { Route } from "./+types/root";
import "./app.css";
import type { Language } from "./lib/i18n";
import { translations } from "./lib/i18n";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const [language, setLanguage] = useState<Language>("en");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Get language from localStorage or browser preference
    const stored = localStorage.getItem("preferred_language");
    const preferred =
      (stored as Language) ||
      (navigator.language.startsWith("de") ? "de" : "en");

    setLanguage(preferred);
    setIsLoaded(true);
  }, []);

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem("preferred_language", lang);
  };

  if (!isLoaded) {
    return null;
  }

  const t = translations[language];

  return (
    <div className="flex flex-col min-h-screen">
      <nav className="bg-gradient-to-r from-slate-600 via-slate-700 to-slate-600 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800 shadow-xl border-b-2 border-slate-400 dark:border-slate-700 sticky top-0 z-50 backdrop-blur-sm bg-opacity-90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="relative">
                <div className="absolute inset-0 bg-white dark:bg-cyan-500 rounded-lg blur opacity-40 group-hover:opacity-60 transition duration-300"></div>
                <span className="relative text-2xl font-bold text-white drop-shadow-md group-hover:scale-105 transition-transform duration-300 px-2 py-1 bg-gradient-to-r from-white/20 to-white/10 rounded-lg">
                  24h Swim
                </span>
              </div>
            </Link>
            <ul className="flex items-center gap-1">
              <li>
                <Link
                  to="/"
                  className="px-4 py-2 rounded-lg text-white font-semibold relative group/nav overflow-hidden transition-all duration-300 hover:shadow-md hover:shadow-slate-400/30"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-white/25 to-white/15 opacity-0 group-hover/nav:opacity-100 transition-opacity duration-300 rounded-lg"></span>
                  <span className="relative">{t.nav.home}</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/rules"
                  className="px-4 py-2 rounded-lg text-white font-semibold relative group/nav overflow-hidden transition-all duration-300 hover:shadow-md hover:shadow-slate-400/30"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-white/25 to-white/15 opacity-0 group-hover/nav:opacity-100 transition-opacity duration-300 rounded-lg"></span>
                  <span className="relative">{t.nav.rules}</span>
                </Link>
              </li>
              <li className="relative group/lang ml-2">
                <button className="w-14 h-10 rounded-lg text-white font-semibold flex items-center justify-center gap-1 relative group/btn overflow-hidden transition-all duration-300 hover:shadow-md hover:shadow-slate-400/30">
                  <span className="absolute inset-0 bg-gradient-to-r from-white/25 to-white/15 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300 rounded-lg"></span>
                  <span className="relative w-6 text-center text-sm">{language.toUpperCase()}</span>
                  <svg className="w-4 h-4 flex-shrink-0 relative group-hover/btn:rotate-180 transition-transform duration-300" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7 10l5 5 5-5z" />
                  </svg>
                </button>
                <div className="absolute right-0 mt-1 w-40 bg-stone-50 dark:bg-slate-900 rounded-xl shadow-xl py-2 opacity-0 invisible group-hover/lang:opacity-100 group-hover/lang:visible transition-all duration-300 transform origin-top scale-95 group-hover/lang:scale-100 border border-stone-300 dark:border-slate-700 z-10">
                  <button
                    onClick={() => handleLanguageChange("en")}
                    className={`block w-full text-left px-4 py-2.5 text-sm font-medium transition-all duration-200 relative overflow-hidden group/lang-btn ${
                      language === "en"
                        ? "bg-gradient-to-r from-slate-300 to-slate-400 text-slate-900"
                        : "text-slate-700 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span className="relative flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full transition-transform duration-300 ${language === "en" ? "bg-slate-700 scale-125" : "bg-slate-400"}`}></span>
                      English
                    </span>
                  </button>
                  <button
                    onClick={() => handleLanguageChange("de")}
                    className={`block w-full text-left px-4 py-2.5 text-sm font-medium transition-all duration-200 relative overflow-hidden group/lang-btn ${
                      language === "de"
                        ? "bg-gradient-to-r from-slate-400 to-slate-300 text-slate-900"
                        : "text-slate-700 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span className="relative flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full transition-transform duration-300 ${language === "de" ? "bg-slate-700 scale-125" : "bg-slate-400"}`}></span>
                      Deutsch
                    </span>
                  </button>
                </div>
              </li>
              <li>
                <a
                  href="/login"
                  className="px-6 py-2 rounded-lg bg-gradient-to-r from-stone-200 to-stone-300 dark:from-slate-600 dark:to-slate-700 text-slate-700 dark:text-stone-100 font-bold ml-4 shadow-md hover:shadow-lg hover:from-stone-300 hover:to-stone-400 dark:hover:from-slate-500 dark:hover:to-slate-600 transition-all duration-300 hover:scale-102 inline-block"
                >
                  {t.nav.login}
                </a>
              </li>
            </ul>
          </div>
        </div>
      </nav>
      <main className="flex-1">
        <Outlet context={{ language, t }} />
      </main>
      <footer className="bg-gradient-to-r from-slate-600 via-slate-700 to-slate-600 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800 border-t-2 border-slate-400 dark:border-slate-700 text-slate-100 dark:text-stone-100 py-6 px-4 mt-12">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-slate-300 dark:text-slate-400 text-xs">
            Making waves in the pool since {new Date().getFullYear()} 
          </p>
        </div>
      </footer>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
