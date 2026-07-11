// Top header with the project title and the companion note.
export default function Header() {
  return (
    <header className="mb-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-brand-400">
            School of Software and Artificial Intelligence | C++ Final Project
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-white md:text-3xl">
            Yunnan University Smart Campus Bus Tracker and Route Optimizer
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Visual companion dashboard for the C++ console system
          </p>
        </div>
        <div className="rounded-xl border border-brand-500/30 bg-brand-500/10 px-4 py-3 text-sm text-brand-400">
          <span className="font-medium text-brand-400">Note: </span>
          <span className="text-slate-300">
            This is a visual companion dashboard for the C++ console project.
          </span>
        </div>
      </div>
    </header>
  );
}
