import { authApi } from './api.js';

const form          = document.getElementById('reset-form');
const alertBox      = document.getElementById('form-alert');
const submitBtn     = document.getElementById('submit-btn');
const subtitleEl    = document.getElementById('auth-subtitle');
const footerEl      = document.getElementById('auth-footer');

function showAlert(message, tone = 'error') {
  alertBox.textContent = message;
  alertBox.classList.remove('is-success');
  if (tone === 'success') alertBox.classList.add('is-success');
  alertBox.classList.add('is-visible');
}

function clearFieldErrors() {
  form.querySelectorAll('.field-error').forEach((el) => (el.textContent = ''));
  form.querySelectorAll('input').forEach((el) => el.removeAttribute('aria-invalid'));
}

function setFieldError(field, message) {
  const errorEl = document.getElementById(`error-${field}`);
  const inputEl = document.getElementById(field);
  if (errorEl) errorEl.textContent = message;
  if (inputEl) inputEl.setAttribute('aria-invalid', 'true');
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.textContent = isLoading ? 'Resetting…' : 'Reset password';
}

const token = new URLSearchParams(window.location.search).get('token');

// No token in the URL at all means this page was opened directly, not via
// a reset email - there's nothing useful to submit, so don't show a form
// that can only ever fail.
if (!token) {
  form.style.display = 'none';
  subtitleEl.textContent = 'This password reset link is missing or invalid.';
  showAlert('Open the link from your password reset email, or request a new one below.');
  footerEl.innerHTML = '';
  footerEl.appendChild(Object.assign(document.createElement('a'), {
    href: 'forgot-password.html',
    textContent: 'Request a new reset link',
  }));
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  alertBox.classList.remove('is-visible', 'is-success');
  clearFieldErrors();

  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  // Client-side check for UX only - the server re-validates everything.
  if (password !== confirmPassword) {
    setFieldError('confirmPassword', 'Passwords do not match.');
    return;
  }

  setLoading(true);

  try {
    await authApi.resetPassword({ token, password });
    showAlert('Your password has been reset. Redirecting to sign in…', 'success');
    form.reset();
    setTimeout(() => window.location.assign('login.html'), 1800);
  } catch (err) {
    if (err.details && err.details.length) {
      err.details.forEach(({ field, message }) => setFieldError(field, message));
    } else {
      showAlert(err.message);
    }
    setLoading(false);
  }
});
