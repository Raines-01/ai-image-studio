/* API fetch wrappers */
const API = {
  async getConfig() {
    const r = await fetch('/api/config');
    return r.json();
  },

  async createConfig(data) {
    const r = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return r.json();
  },

  async updateConfig(id, data) {
    const r = await fetch(`/api/config/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return r.json();
  },

  async deleteConfig(id) {
    const r = await fetch(`/api/config/${id}`, { method: 'DELETE' });
    return r.json();
  },

  async testConfig(data) {
    const r = await fetch('/api/config/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return r.json();
  },

  async activateConfig(id) {
    const r = await fetch(`/api/config/activate/${id}`, { method: 'POST' });
    return r.json();
  },

  async browseDirectory() {
    const r = await fetch('/api/browse-directory', { method: 'POST' });
    return r.json();
  },

  async generate(formData) {
    const r = await fetch('/api/generate', { method: 'POST', body: formData });
    return r.json();
  },

  async getQueue() {
    const r = await fetch('/api/queue');
    return r.json();
  },

  async cancelTask(id) {
    const r = await fetch(`/api/queue/${id}`, { method: 'DELETE' });
    return r.json();
  },

  async getHistory(q) {
    const url = q ? `/api/history?q=${encodeURIComponent(q)}` : '/api/history';
    const r = await fetch(url);
    return r.json();
  },

  async deleteHistory(id) {
    const r = await fetch(`/api/history/${id}`, { method: 'DELETE' });
    return r.json();
  }
};
