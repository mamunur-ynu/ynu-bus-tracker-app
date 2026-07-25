import { useLang } from "../lib/i18n";

// Centered, premium header with a display font and gradient title.
export default function Header() {
  const { t } = useLang();
  return (
    <header className="mb-10 flex flex-col items-center text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-brand-400">
        {t("header.kicker")}
      </p>
      <h1
        className="mt-4 bg-gradient-to-r from-white via-sky-100 to-violet-200 bg-clip-text text-4xl font-extrabold leading-[1.05] tracking-tight text-transparent md:text-6xl"
        style={{ fontFamily: "Sora, Inter, sans-serif" }}
      >
        {t("header.title")}
      </h1>
      <p className="mt-4 max-w-xl text-base text-slate-400">
        {t("header.subtitle")}
      </p>
      <div className="mt-6 h-px w-24 bg-gradient-to-r from-transparent via-brand-500/60 to-transparent" />
    </header>
  );
}
