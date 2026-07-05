/**
 * Bouton profil (haut à droite) + panneau de paramètres.
 * Partagé entre l'accueil/questionnaire (index) et le calendrier.
 *
 * - Affiche l'avatar de l'utilisateur connecté.
 * - Ouvre un panneau avec : refaire le questionnaire, voir les conférences,
 *   se déconnecter.
 * - « Refaire le questionnaire » renvoie vers `/?redo=1` : la page d'accueil
 *   force alors l'affichage du questionnaire même si l'utilisateur l'a déjà
 *   terminé (voir app.js).
 */
(function () {
  const btn = document.getElementById('profile-btn');
  const avatarEl = document.getElementById('profile-avatar');
  const overlay = document.getElementById('settings-overlay');
  const closeBtn = document.getElementById('settings-close');
  const userBox = document.getElementById('settings-user');
  const redoBtn = document.getElementById('btn-redo');
  const logoutBtn = document.getElementById('btn-logout');
  if (!btn || !overlay) return;

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function avatarHtml(user) {
    if (user.avatar) return `<img src="${user.avatar}" alt="" />`;
    const initial = (user.username || '?').trim().charAt(0).toUpperCase();
    return `<span class="avatar-initial">${esc(initial)}</span>`;
  }

  async function loadUser() {
    let me = null;
    try {
      me = await (await fetch('/auth/me')).json();
    } catch {
      /* non connecté : le bouton reste caché */
    }
    const user = me && me.user;
    if (!user) return;

    const html = avatarHtml(user);
    avatarEl.innerHTML = html;
    btn.hidden = false;
    userBox.innerHTML = `
      <span class="settings-avatar">${html}</span>
      <span class="settings-name">${esc(user.username)}</span>
    `;

    // Lien "Espace admin" affiché uniquement pour les administrateurs.
    const adminLink = document.getElementById('settings-admin');
    if (adminLink && me.isAdmin) adminLink.hidden = false;
  }

  function open() {
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add('show'));
  }
  function close() {
    overlay.classList.remove('show');
    setTimeout(() => (overlay.hidden = true), 200);
  }

  btn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hidden) close();
  });

  if (redoBtn) {
    redoBtn.addEventListener('click', () => {
      window.location.href = '/?redo=1';
    });
  }
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await fetch('/auth/logout', { method: 'POST' });
      } catch {
        /* on redirige quoi qu'il arrive */
      }
      window.location.href = '/';
    });
  }

  loadUser();
})();
