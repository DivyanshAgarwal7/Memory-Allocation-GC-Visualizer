import { authApi } from './api.js';

const usernameEl = document.getElementById('dash-username');
const logoutBtn  = document.getElementById('logout-btn');

authApi.me().then(
  ({ user }) => {
    usernameEl.textContent = user.username;
  },
  () => {
    window.location.replace('login.html');
  }
);

logoutBtn.addEventListener('click', async () => {
  logoutBtn.disabled = true;
  try {
    await authApi.logout();
  } finally {
    window.location.replace('login.html');
  }
});
