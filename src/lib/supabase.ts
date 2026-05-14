// ============================================================
// Supabase-Compatible Client Shim
// Routes all Supabase JS client calls to the local Express backend
// ============================================================

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ============================================
// Auth shim (mimics supabase.auth)
// ============================================

const authState = {
  user: null,
  session: null,
  listeners: [],
};

function notifyAuthListeners() {
  authState.listeners.forEach(cb => cb('SIGNED_IN', authState.session, authState.user));
}

async function signInAnonymously() {
  const res = await fetch(`${API_BASE}/api/auth/sign-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) throw new Error('匿名登录失败');
  const data = await res.json();

  authState.user = { id: data.user.id, anonymous: true, user_metadata: data.user };
  authState.session = {
    access_token: data.session.access_token,
    user: authState.user,
  };

  // Persist token
  localStorage.setItem('rex_token', data.session.access_token);
  localStorage.setItem('rex_user', JSON.stringify(authState.user));

  notifyAuthListeners();
  return { data };
}

async function getSession() {
  // Try restore from localStorage
  if (!authState.session) {
    const token = localStorage.getItem('rex_token');
    const userStr = localStorage.getItem('rex_user');

    if (token && userStr) {
      const res = await fetch(`${API_BASE}/api/auth/session`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (data.session) {
        authState.session = data.session;
        authState.user = data.user;
      } else {
        localStorage.removeItem('rex_token');
        localStorage.removeItem('rex_user');
      }
    }
  }

  return { data: { session: authState.session } };
}

async function getUser() {
  await getSession();
  return { data: { user: authState.user } };
}

async function signOut() {
  const token = localStorage.getItem('rex_token');
  if (token) {
    await fetch(`${API_BASE}/api/auth/sign-out`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  }
  authState.user = null;
  authState.session = null;
  localStorage.removeItem('rex_token');
  localStorage.removeItem('rex_user');
  notifyAuthListeners();
}

function onAuthStateChange(callback) {
  authState.listeners.push(callback);
  // Immediately fire with current state
  if (authState.session) {
    callback('SIGNED_IN', authState.session, authState.user);
  } else {
    callback('SIGNED_OUT', null, null);
  }
  return { data: { subscription: { unsubscribe: () => {
    authState.listeners = authState.listeners.filter(cb => cb !== callback);
  } } } };
}

// ============================================
// REST API shim (mimics supabase.from() and supabase.functions.invoke())
// ============================================

function getAuthHeaders() {
  const token = localStorage.getItem('rex_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function invokeFunction(name, options = {}) {
  const method = options.method || 'GET';
  const url = `${API_BASE}/api/${name}`;

  const res = await fetch(url, {
    method,
    headers: getAuthHeaders(),
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json();

  if (!res.ok) {
    return { data: null, error: { message: data.message || 'Request failed' } };
  }

  return { data, error: null };
}

// Table query builder (mimics Supabase PostgREST)
class TableQuery {
  constructor(table) {
    this.table = table;
    this.filters = {};
    this._order = null;
    this._limit = null;
    this._offset = null;
    this._selectCols = '*';
    this._count = false;
  }

  select(cols, opts) {
    this._selectCols = cols || '*';
    if (opts?.count) this._count = true;
    return this;
  }

  eq(col, val) { this.filters[col] = val; return this; }
  neq(col, val) { this.filters[`neq:${col}`] = val; return this; }
  gt(col, val) { this.filters[`gt:${col}`] = val; return this; }
  gte(col, val) { this.filters[`gte:${col}`] = val; return this; }
  lt(col, val) { this.filters[`lt:${col}`] = val; return this; }
  lte(col, val) { this.filters[`lte:${col}`] = val; return this; }
  in(col, vals) { this.filters[`in:${col}`] = vals.join(','); return this; }
  like(col, pattern) { this.filters[`like:${col}`] = pattern; return this; }

  order(col, opts = {}) {
    this._order = `${col}.${opts.ascending ? 'asc' : 'desc'}`;
    return this;
  }

  limit(n) { this._limit = n; return this; }
  range(from, to) { this._offset = from; this._limit = to - from + 1; return this; }

  single() { this._limit = 1; this._single = true; return this; }
  maybeSingle() { this._limit = 1; this._maybeSingle = true; return this; }

  async execute() {
    const params = new URLSearchParams();

    // Add simple equality filters
    for (const [key, value] of Object.entries(this.filters)) {
      if (!key.includes(':')) params.set(key, value);
    }

    if (this._order) params.set('order', this._order);
    if (this._limit) params.set('limit', this._limit);
    if (this._offset != null) params.set('offset', this._offset);

    const url = `${API_BASE}/api/rest/${this.table}?${params.toString()}`;

    const res = await fetch(url, {
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Request failed' }));
      return { data: null, error: { message: err.message }, count: 0 };
    }

    let data = await res.json();

    if (this._single) {
      data = data[0] || null;
    } else if (this._maybeSingle) {
      data = data[0] || null;
    }

    return { data, error: null, count: data?.length || 0 };
  }

  // Insert
  async insert(row) {
    const url = `${API_BASE}/api/rest/${this.table}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(row),
    });
    const data = await res.json();
    if (!res.ok) return { data: null, error: { message: data.message } };
    return { data, error: null };
  }

  // Update
  async update(updates) {
    const url = `${API_BASE}/api/rest/${this.table}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ updates, filters: this.filters }),
    });
    const data = await res.json();
    if (!res.ok) return { data: null, error: { message: data.message } };
    return { data, error: null };
  }

  // Delete
  async delete() {
    const url = `${API_BASE}/api/rest/${this.table}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      body: JSON.stringify({ filters: this.filters }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { data: null, error: { message: data.message || 'Delete failed' } };
    return { data: null, error: null };
  }
}

// ============================================
// Main client export
// ============================================

const supabase = {
  auth: {
    signInAnonymously,
    getSession,
    getUser,
    signOut,
    onAuthStateChange,
  },
  from: (table) => new TableQuery(table),
  functions: {
    invoke: invokeFunction,
  },
  channel: () => ({
    on: () => ({ subscribe: () => ({}) }),
  }),
};

export { supabase, signInAnonymously, getCurrentUser, getCurrentSession, signOut };

async function getCurrentUser() {
  const { data } = await getUser();
  return data.user;
}

async function getCurrentSession() {
  const { data } = await getSession();
  return data.session;
}
