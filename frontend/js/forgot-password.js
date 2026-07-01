import { authApi } from './api.js';

const form      = document.getElementById('forgot-form');
const alertBox  = document.getElementById('form-alert');
const submitBtn = document.getElementById('submit-btn');

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

function showFieldErrors(details) {
  details.forEach(({ field, message }) => {
    const errorEl = document.getElementById(`error-${field}`);
    const inputEl = document.getElementById(field);
    if (errorEl) errorEl.textContent = message;
    if (inputEl) inputEl.setAttribute('aria-invalid', 'true');
  });
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.textContent = isLoading ? 'Sending…' : 'Send reset link';
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  alertBox.classList.remove('is-visible', 'is-success');
  clearFieldErrors();
  setLoading(true);

  const email = document.getElementById('email').value.trim();

  try {
    const { message } = await authApi.forgotPassword({ email });
    // The backend always returns the same generic message whether or not
    // the email has an account - this page just displays whatever it
    // sent, it doesn't add its own logic on top of that.
    showAlert(message, 'success');
    form.reset();
  } catch (err) {
    if (err.details && err.details.length) showFieldErrors(err.details);
    else showAlert(err.message);
  } finally {
    setLoading(false);
  }
});
