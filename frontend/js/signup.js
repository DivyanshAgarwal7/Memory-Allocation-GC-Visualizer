import { authApi } from './api.js';

const form      = document.getElementById('signup-form');
const alertBox  = document.getElementById('form-alert');
const submitBtn = document.getElementById('submit-btn');

function showAlert(message, tone = 'error') {
  alertBox.textContent = message;
  alertBox.classList.remove('is-success');
  if (tone === 'success') alertBox.classList.add('is-success');
  alertBox.classList.add('is-visible');
}

function clearAlert() {
  alertBox.classList.remove('is-visible', 'is-success');
  alertBox.textContent = '';
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

function showFieldErrors(details) {
  details.forEach(({ field, message }) => setFieldError(field, message));
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.textContent = isLoading ? 'Creating account…' : 'Create account';
}

// If a session is already active, skip straight to the dashboard.
authApi.me().then(
  () => { window.location.replace('dashboard.html'); },
  () => { /* not signed in - stay on this page */ }
);

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearAlert();
  clearFieldErrors();

  const username = document.getElementById('username').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  // Client-side check for UX only - the server re-validates everything.
  if (password !== confirmPassword) {
    setFieldError('confirmPassword', 'Passwords do not match.');
    return;
  }

  setLoading(true);

  try {
    await authApi.signup({ username, email, password });
    window.location.assign('dashboard.html');
  } catch (err) {
    if (err.details && err.details.length) showFieldErrors(err.details);
    showAlert(err.message);
  } finally {
    setLoading(false);
  }
});
