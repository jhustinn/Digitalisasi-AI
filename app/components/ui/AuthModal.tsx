import React, { useState } from 'react';
import { Dialog } from './Dialog';
import { Input } from './Input';
import { Button } from './Button';
import { getSupabaseClient } from '~/lib/stores/supabase';

// Icon SVG
const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: 8 }}>
    <g clipPath="url(#clip0_88_980)"><path d="M19.805 10.2305C19.805 9.55078 19.7483 8.86719 19.625 8.19922H10.2V12.0508H15.6017C15.3775 13.2734 14.6275 14.332 13.5775 15.025V17.275H16.6017C18.4017 15.6172 19.805 13.2305 19.805 10.2305Z" fill="#4285F4"/><path d="M10.2 20C12.7 20 14.7775 19.1914 16.6017 17.275L13.5775 15.025C12.5775 15.6914 11.3775 16.082 10.2 16.082C7.80167 16.082 5.7775 14.4102 5.05167 12.2422H1.9275V14.5586C3.7775 17.8008 6.7775 20 10.2 20Z" fill="#34A853"/><path d="M5.05167 12.2422C4.85167 11.6758 4.73333 11.0664 4.73333 10.4375C4.73333 9.80859 4.85167 9.19922 5.05167 8.63281V6.31641H1.9275C1.2775 7.56641 0.933334 8.94922 0.933334 10.4375C0.933334 11.9258 1.2775 13.3086 1.9275 14.5586L5.05167 12.2422Z" fill="#FBBC05"/><path d="M10.2 4.79297C11.4775 4.79297 12.6275 5.23047 13.5275 6.08203L16.6667 2.94141C14.7775 1.19141 12.7 0.000976562 10.2 0.000976562C6.7775 0.000976562 3.7775 2.19922 1.9275 5.44141L5.05167 7.75781C5.7775 5.58984 7.80167 4.79297 10.2 4.79297Z" fill="#EA4335"/><path d="M19.805 10.2305C19.805 9.55078 19.7483 8.86719 19.625 8.19922H10.2V12.0508H15.6017C15.3775 13.2734 14.6275 14.332 13.5775 15.025V17.275H16.6017C18.4017 15.6172 19.805 13.2305 19.805 10.2305Z" fill="#4285F4"/><path d="M10.2 20C12.7 20 14.7775 19.1914 16.6017 17.275L13.5775 15.025C12.5775 15.6914 11.3775 16.082 10.2 16.082C7.80167 16.082 5.7775 14.4102 5.05167 12.2422H1.9275V14.5586C3.7775 17.8008 6.7775 20 10.2 20Z" fill="#34A853"/><path d="M5.05167 12.2422C4.85167 11.6758 4.73333 11.0664 4.73333 10.4375C4.73333 9.80859 4.85167 9.19922 5.05167 8.63281V6.31641H1.9275C1.2775 7.56641 0.933334 8.94922 0.933334 10.4375C0.933334 11.9258 1.2775 13.3086 1.9275 14.5586L5.05167 12.2422Z" fill="#FBBC05"/><path d="M10.2 4.79297C11.4775 4.79297 12.6275 5.23047 13.5275 6.08203L16.6667 2.94141C14.7775 1.19141 12.7 0.000976562 10.2 0.000976562C6.7775 0.000976562 3.7775 2.19922 1.9275 5.44141L5.05167 7.75781C5.7775 5.58984 7.80167 4.79297 10.2 4.79297Z" fill="#EA4335"/></g>
    <defs><clipPath id="clip0_88_980"><rect width="20" height="20" fill="white"/></clipPath></defs>
  </svg>
);
const GitHubIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: 8 }}>
    <path d="M12 2C6.477 2 2 6.484 2 12.021c0 4.428 2.865 8.184 6.839 9.504.5.092.682-.217.682-.482 0-.237-.009-.868-.014-1.703-2.782.605-3.369-1.342-3.369-1.342-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.004.07 1.532 1.032 1.532 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.339-2.221-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.295 2.748-1.025 2.748-1.025.546 1.378.202 2.397.1 2.65.64.7 1.028 1.595 1.028 2.688 0 3.847-2.337 4.695-4.566 4.944.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.749 0 .267.18.577.688.479C19.138 20.2 22 16.448 22 12.021 22 6.484 17.523 2 12 2z" fill="#fff"/>
  </svg>
);

export function AuthModal({ open, onClose, onAuthSuccess }: { open: boolean; onClose: () => void; onAuthSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'login' | 'register'>('login');

  const supabase = getSupabaseClient();

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      let res;
      if (mode === 'login') {
        res = await supabase.auth.signInWithPassword({ email, password });
      } else {
        res = await supabase.auth.signUp({ email, password });
      }
      if (res.error) throw res.error;
      onAuthSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth(provider: 'google' | 'github') {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider });
      if (error) throw error;
      // OAuth will redirect, so no need to call onAuthSuccess here
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <div style={{ padding: 32, minWidth: 350, background: 'rgba(20,20,20,0.98)', borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          {/* Ganti dengan logo jika ada */}
          <span style={{ fontWeight: 700, fontSize: 28, letterSpacing: 1, color: '#fff' }}>Masuk digitalisasi.ai</span>
        </div>
        {error && <div style={{ background: '#ffeded', color: '#b00', borderRadius: 8, padding: 8, marginBottom: 16, textAlign: 'center', fontSize: 14 }}>{error}</div>}
        <form onSubmit={handleEmailAuth} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={{ fontSize: 16, padding: '10px 12px', borderRadius: 8 }} />
          <Input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required style={{ fontSize: 16, padding: '10px 12px', borderRadius: 8 }} />
          <Button type="submit" disabled={loading} style={{ fontWeight: 600, fontSize: 16, borderRadius: 8, background: '#7c3aed', color: '#fff', marginTop: 8 }}>{mode === 'login' ? 'Login' : 'Register'}</Button>
        </form>
        <div style={{ margin: '18px 0 10px 0', textAlign: 'center', color: '#aaa', fontSize: 14 }}>or</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 8 }}>
          <Button onClick={() => handleOAuth('google')} disabled={loading} style={{ background: '#fff', color: '#222', fontWeight: 600, borderRadius: 8, display: 'flex', alignItems: 'center', minWidth: 170 }}>
            <GoogleIcon /> Login with Google
          </Button>
          <Button onClick={() => handleOAuth('github')} disabled={loading} style={{ background: '#222', color: '#fff', fontWeight: 600, borderRadius: 8, display: 'flex', alignItems: 'center', minWidth: 170 }}>
            <GitHubIcon /> Login with GitHub
          </Button>
        </div>
        <div style={{ marginTop: 18, textAlign: 'center', fontSize: 15 }}>
          {mode === 'login' ? (
            <span style={{ color: '#bbb' }}>Don't have an account?{' '}
              <a href="#" onClick={e => { e.preventDefault(); setMode('register'); }} style={{ color: '#7c3aed', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}>Register</a>
            </span>
          ) : (
            <span style={{ color: '#bbb' }}>Already have an account?{' '}
              <a href="#" onClick={e => { e.preventDefault(); setMode('login'); }} style={{ color: '#7c3aed', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}>Login</a>
            </span>
          )}
        </div>
      </div>
    </Dialog>
  );
} 