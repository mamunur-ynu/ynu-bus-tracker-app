// Centered, premium header with a display font and gradient title.
export default function Header() {
  return (
    <header className="mb-10 flex flex-col items-center text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-brand-400">
        Yunnan University &middot; School of Software &amp; AI
      </p>
      <h1
        className="mt-4 bg-gradient-to-r from-white via-sky-100 to-violet-200 bg-clip-text text-4xl font-extrabold leading-[1.05] tracking-tight text-transparent md:text-6xl"
        style={{ fontFamily: "Sora, Inter, sans-serif" }}
      >
        Smart Campus Bus Tracker
      </h1>
      <p className="mt-4 max-w-xl text-base text-slate-400">
        A live, cloud-based route optimizer for the campus shuttle network.
      </p>
      <div className="mt-6 h-px w-24 bg-gradient-to-r from-transparent via-brand-500/60 to-transparent" />
    </header>
  );
}
