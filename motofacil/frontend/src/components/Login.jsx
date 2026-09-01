import React, { useState } from 'react';
import { auth } from '../services/api';

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
    <div className="min-h-screen flex items-center justify-center bg-brand-700 px-4">
      <form onSubmit={handleSubmit} className="bg-paper w-full max-w-sm p-8 rounded-sm">
        <h1 className="text-2xl mb-1">MotoFácil</h1>
        <p className="text-sm text-ink/60 mb-6">Painel administrativo</p>

        {error && <p className="text-sm text-red-700 mb-4">{error}</p>}

        <label className="block text-sm mb-1">E-mail</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-ink/20 rounded-sm px-3 py-2 mb-4 text-sm"
        />

        <label className="block text-sm mb-1">Senha</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-ink/20 rounded-sm px-3 py-2 mb-6 text-sm"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-700 text-paper py-2.5 rounded-sm font-medium text-sm hover:bg-brand-800 transition-colors"
        >
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
