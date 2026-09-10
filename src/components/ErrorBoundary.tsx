import { Component, type ErrorInfo, type ReactNode } from "react";
// The standalone t(), not useLang(): this is a class component and cannot
// call hooks. It reads the current language at render time either way.
import { t } from "../lib/i18n";

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  message: string;
}

// Catches runtime render errors so users see a friendly screen instead of a
// blank white page.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("App error:", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-xl font-semibold text-white">{t("error.generic")}</h1>
        <p className="mt-2 text-sm text-slate-400">
          {t("error.body")}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 rounded-full border border-brand-500/50 bg-brand-500/15 px-5 py-2 text-sm font-semibold text-brand-400"
        >
          {t("error.reload")}
        </button>
      </div>
    );
  }
}
