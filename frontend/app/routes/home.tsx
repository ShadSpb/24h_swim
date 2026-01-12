import type { Route } from "./+types/home";
import { useOutletContext } from "react-router";
import type { Language } from "../lib/i18n";
import { translations } from "../lib/i18n";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Home" },
    { name: "description", content: "Welcome to the 24-hour swimming competition" },
  ];
}

export default function Home() {
  const context = useOutletContext<{ language: Language; t: typeof translations.en }>();
  const t = context?.t || translations.en;

  return (
    <main className="flex items-center justify-center pt-16 pb-4 w-full min-h-screen">
      <div className="flex-1 flex flex-col items-center gap-8 min-h-0 max-w-5xl px-4">
        <div className="text-center space-y-6">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
            24h Swim
          </h1>
          <p className="text-xl text-gray-700 dark:text-gray-200">
            Welcome to the 24-hour swimming competition
          </p>
        </div>
      </div>
    </main>
  );
}
