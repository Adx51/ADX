export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-bordeaux-500 to-bordeaux-700 font-display text-2xl font-bold text-white">
            A
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold text-white">ADX</h1>
            <p className="text-sm text-neutral-500">Votre cave, sublimée par l’IA</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
