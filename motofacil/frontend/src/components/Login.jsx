import React, { useState } from 'react';
import { auth } from '../services/api';

// A rota desenhada abaixo é o único momento de "espetáculo" visual do
// produto inteiro — todo o resto do painel é discreto por decisão, para
// deixar essa cena (o mapa de Santa Maria ao entardecer) ser o que fica
// na memória de quem vê o produto pela primeira vez.
const ROUTE_PATH = 'M20,210 C90,60 150,240 230,140 S 340,20 420,90';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('admin@motofacil.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await auth.login(email, password);
      localStorage.setItem('motofacil_admin_token', data.token);
      onLogin();
    } catch (err) {
      setError('E-mail ou senha incorretos.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2 bg-paper">
      {/* Painel de identidade — some no mobile para priorizar o formulário */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 px-14 py-12 text-paper">
        <svg
          viewBox="0 0 460 260"
          fill="none"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-90"
          preserveAspectRatio="xMidYMid slice"
        >
          <path
            d={ROUTE_PATH}
            stroke="#F0C589"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="route-path"
          />
          <circle r="6" fill="#E8A94C">
            <animateMotion dur="2.4s" begin="0.2s" fill="freeze" path={ROUTE_PATH} />
          </circle>
        </svg>

        <div className="relative z-10">
          <p className="font-display text-2xl">MotoFácil</p>
          <p className="mt-1 text-sm text-brand-100/70">Central de mobilidade</p>
        </div>

        <div className="relative z-10 max-w-sm">
          <h1 className="font-display text-4xl leading-tight">
            Cada corrida de Santa Maria, sob seus olhos.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-brand-100/75">
            Motoboys, clientes e faturamento em um único painel — nascido
            para acompanhar o WhatsApp de perto, sem perder o ritmo da rua.
          </p>
        </div>

        <p className="relative z-10 text-xs text-brand-100/50">
          © {new Date().getFullYear()} MotoFácil — Santa Maria, RS
        </p>
      </div>

      {/* Formulário */}
      <div className="flex min-h-screen items-center justify-center px-6 py-16">
        <form onSubmit={handleSubmit} className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <p className="font-display text-2xl text-ink">MotoFácil</p>
            <p className="mt-1 text-sm text-ink/55">Central de mobilidade</p>
          </div>

          <h2 className="font-display text-2xl text-ink">Entrar no painel</h2>
          <p className="mt-1 mb-7 text-sm text-ink/55">
            Acesso restrito à equipe administrativa.
          </p>

          {error && (
            <p className="mb-5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <label htmlFor="email" className="mb-1.5 block text-sm text-ink/75">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-5 w-full rounded-md border border-ink/15 bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-ember-500"
          />

          <label htmlFor="password" className="mb-1.5 block text-sm text-ink/75">
            Senha
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-7 w-full rounded-md border border-ink/15 bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-ember-500"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-brand-700 py-3 text-sm font-medium text-paper transition-colors hover:bg-brand-800 disabled:opacity-60"
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
