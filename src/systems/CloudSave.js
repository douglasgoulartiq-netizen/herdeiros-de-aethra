// Login com Google (Supabase Auth) e salvamento automático na nuvem.
// Implementado com fetch puro (sem SDK) para o jogo continuar 100% independente de CDNs externos.
const SUPABASE_URL = "https://qimennnhincqtygrvcwu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVubm5oaW5jcXR5Z3J2Y3d1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwMjQ5NzQsImV4cCI6MjEwMjYwMDk3NH0.Nsxz-aT2GeVgF0STQ-oBmNZjToI6dxqTCdbzFSfW144";

const TOKEN_KEY = "rpg_pt_auth_v1";

function lerTokens() {
  try {
    return JSON.parse(localStorage.getItem(TOKEN_KEY) || "null");
  } catch {
    return null;
  }
}

function salvarTokens(t) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(t));
}

function limparTokens() {
  localStorage.removeItem(TOKEN_KEY);
}

function decodificarJWT(jwt) {
  try {
    const payload = jwt.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function iniciarLoginGoogle() {
  const redirect = window.location.origin + window.location.pathname;
  const url = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirect)}`;
  window.location.href = url;
}

// Processa o retorno do login (o Supabase redireciona de volta com os tokens no #hash da URL).
export function processarRetornoLogin() {
  if (!window.location.hash.includes("access_token")) return false;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const tokens = {
    access_token: params.get("access_token"),
    refresh_token: params.get("refresh_token"),
    expires_at: Date.now() + (parseInt(params.get("expires_in") || "3600", 10) * 1000),
  };
  salvarTokens(tokens);
  history.replaceState(null, "", window.location.pathname);
  return true;
}

async function renovarTokenSeNecessario() {
  const t = lerTokens();
  if (!t) return null;
  if (Date.now() < t.expires_at - 30000) return t;
  try {
    const resp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: t.refresh_token }),
    });
    if (!resp.ok) { limparTokens(); return null; }
    const dados = await resp.json();
    const novo = {
      access_token: dados.access_token,
      refresh_token: dados.refresh_token,
      expires_at: Date.now() + (dados.expires_in || 3600) * 1000,
    };
    salvarTokens(novo);
    return novo;
  } catch {
    return null;
  }
}

export async function usuarioAtual() {
  const t = await renovarTokenSeNecessario();
  if (!t) return null;
  const payload = decodificarJWT(t.access_token);
  if (!payload) return null;
  return { id: payload.sub, email: payload.email, nome: payload.user_metadata?.full_name || payload.email };
}

export async function sair() {
  const t = lerTokens();
  if (t) {
    try {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${t.access_token}` },
      });
    } catch { /* ignora falha de rede ao sair */ }
  }
  limparTokens();
}

export async function salvarNaNuvem(estado) {
  const t = await renovarTokenSeNecessario();
  if (!t) return { ok: false, motivo: "nao_logado" };
  const payload = decodificarJWT(t.access_token);
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/saves`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${t.access_token}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({ user_id: payload.sub, dados: estado, atualizado_em: new Date().toISOString() }),
  });
  return { ok: resp.ok };
}

export async function carregarDaNuvem() {
  const t = await renovarTokenSeNecessario();
  if (!t) return null;
  const payload = decodificarJWT(t.access_token);
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/saves?user_id=eq.${payload.sub}&select=dados`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${t.access_token}` },
  });
  if (!resp.ok) return null;
  const linhas = await resp.json();
  return linhas.length ? linhas[0].dados : null;
}

export function estaLogado() {
  return !!lerTokens();
}
