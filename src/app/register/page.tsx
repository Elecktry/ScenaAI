
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    if (password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await authClient.signUp.email({
        name: name.trim(),
        email: email.trim(),
        password,
        callbackURL: "/",
      });

      if (result.error) {
        setError(result.error.message || "Não foi possível criar a conta.");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setError("Erro ao conectar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#09090b] px-5 py-12 text-white">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <Link href="/login" className="text-3xl font-bold tracking-[0.2em]">
            SCENA<span className="text-violet-400">.AI</span>
          </Link>
          <p className="mt-3 text-sm text-zinc-500">
            Seu estúdio de criação cinematográfica.
          </p>
        </div>

        <section className="rounded-2xl border border-white/10 bg-zinc-900/70 p-7 shadow-2xl sm:p-9">
          <h1 className="text-2xl font-semibold">Crie sua conta</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Comece a transformar suas ideias em projetos.
          </p>

          <form onSubmit={handleRegister} className="mt-8 space-y-5">
            <div>
              <label htmlFor="name" className="mb-2 block text-sm text-zinc-300">
                Nome
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                required
                maxLength={100}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Seu nome"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none transition focus:border-violet-400"
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-2 block text-sm text-zinc-300">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="seu@email.com"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none transition focus:border-violet-400"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm text-zinc-300">
                Senha
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Mínimo de 8 caracteres"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none transition focus:border-violet-400"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="mb-2 block text-sm text-zinc-300">
                Confirmar senha
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Digite a senha novamente"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none transition focus:border-violet-400"
              />
            </div>

            {error && (
              <p role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-violet-600 py-3 font-medium transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Criando conta..." : "Criar minha conta"}
            </button>
          </form>

          <div className="mt-7 border-t border-white/10 pt-6 text-center">
            <p className="text-sm text-zinc-400">
              Já tem uma conta?{" "}
              <Link href="/login" className="font-medium text-violet-400 hover:text-violet-300">
                Entrar
              </Link>
            </p>
          </div>
        </section>

        <p className="mt-8 text-center text-xs text-zinc-600">
          SCENA.AI — Sua ideia, nosso estúdio.
        </p>
      </div>
    </main>
  );
}
