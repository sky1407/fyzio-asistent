import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-700 text-xl font-bold text-white">
            F
          </div>
          <h1 className="text-2xl font-semibold">Fyzio asistent</h1>
          <p className="mt-1 text-sm text-slate-500">Prihláste sa do svojej ambulancie</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
