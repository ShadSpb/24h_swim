import type { Route } from "./+types/logon";
import { useState } from "react";
import { useOutletContext } from "react-router";
import type { Language } from "../lib/i18n";
import { translations } from "../lib/i18n";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Login" },
    { name: "description", content: "Login to your account" },
  ];
}

export default function Logon() {
  const context = useOutletContext<{ language: Language; t: typeof translations.en }>();
  const t = context?.t || translations.en;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess(false);

    // Simulate API call with delay
    setTimeout(() => {
      if (email && password) {
        setSuccess(true);
        setEmail("");
        setPassword("");
      } else {
        setError("Please fill in all fields");
      }
      setIsLoading(false);
    }, 500);
  };

  return (
    <main className="flex items-center justify-center pt-16 pb-4 w-full min-h-screen">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            {t.login.welcomeBack}
          </h1>
          <p className="text-slate-600 dark:text-slate-300">
            {t.login.subtitle}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-white dark:bg-slate-800 p-6 rounded-lg">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-900 dark:text-white mb-1">
              {t.login.email}
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-900 dark:text-white mb-1">
              {t.login.password}
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700">
              <p className="text-red-700 dark:text-red-200 text-sm">
                {error}
              </p>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900 border border-green-300 dark:border-green-700">
              <p className="text-green-700 dark:text-green-200 text-sm">
                Login successful!
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 px-4 bg-slate-600 hover:bg-slate-700 dark:bg-slate-600 dark:hover:bg-slate-500 disabled:bg-slate-400 text-white font-semibold rounded-lg transition-colors"
          >
            {isLoading ? t.login.loggingIn : t.login.loginButton}
          </button>
        </form>

        <p className="text-center text-sm text-slate-600 dark:text-slate-400 mt-4">
          So far it doesn't work. Use it for fun and enjoy your swimming!
        </p>
      </div>
    </main>
  );
}
