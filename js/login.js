/* ============================================================
   BudgeWise Login Page — Interaction Logic
   Frontend-only simulation (backend not ready)
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  // ── Elements ──
  const loginForm     = document.getElementById('loginForm');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const pwToggleBtn   = document.getElementById('pwToggle');
  const signinBtn     = document.getElementById('signinBtn');
  const errorEl       = document.getElementById('loginError');

  const stepLogin     = document.getElementById('stepLogin');
  const stepDuo       = document.getElementById('stepDuo');
  const stepSuccess   = document.getElementById('stepSuccess');

  const duoTimerEl    = document.getElementById('duoTimerValue');
  const resendBtn     = document.getElementById('duoResend');

  // ── Particles ──
  createParticles();

  // ── Password show / hide ──
  pwToggleBtn.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    pwToggleBtn.innerHTML = isPassword ? eyeOffSVG() : eyeOnSVG();
  });

  // ── Button ripple effect ──
  signinBtn.addEventListener('mousemove', (e) => {
    const rect = signinBtn.getBoundingClientRect();
    signinBtn.style.setProperty('--x', ((e.clientX - rect.left) / rect.width * 100) + '%');
    signinBtn.style.setProperty('--y', ((e.clientY - rect.top) / rect.height * 100) + '%');
  });

  // ── Form submission ──
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    hideError();

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    // Basic validation
    if (!username) {
      showError('Please enter your username.');
      shakeField(usernameInput);
      return;
    }
    if (!password) {
      showError('Please enter your password.');
      shakeField(passwordInput);
      return;
    }

    // Simulate login request
    signinBtn.classList.add('loading');
    signinBtn.disabled = true;

    setTimeout(() => {
      signinBtn.classList.remove('loading');
      signinBtn.disabled = false;
      goToStep('duo');
    }, 1500);
  });

  // ── Resend Duo push ──
  resendBtn.addEventListener('click', () => {
    resendBtn.textContent = 'Push Sent!';
    resendBtn.disabled = true;
    clearInterval(duoInterval);
    duoCountdown = 60;
    duoTimerEl.textContent = duoCountdown;
    duoInterval = startDuoTimer();
    setTimeout(() => {
      resendBtn.textContent = 'Resend Push';
      resendBtn.disabled = false;
    }, 2000);
  });

  // ── Step navigation ──
  let duoInterval = null;
  let duoCountdown = 60;

  function goToStep(step) {
    // Hide all steps
    [stepLogin, stepDuo, stepSuccess].forEach(s => {
      s.classList.remove('active');
    });

    if (step === 'duo') {
      stepDuo.classList.add('active');
      duoCountdown = 60;
      duoTimerEl.textContent = duoCountdown;
      duoInterval = startDuoTimer();

      // Simulate Duo approval after 4 seconds
      setTimeout(() => {
        clearInterval(duoInterval);
        goToStep('success');
      }, 4000);
    } else if (step === 'success') {
      stepSuccess.classList.add('active');
      // Redirect to main app after 2 seconds
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 2500);
    }
  }

  function startDuoTimer() {
    return setInterval(() => {
      duoCountdown--;
      if (duoTimerEl) duoTimerEl.textContent = duoCountdown;
      if (duoCountdown <= 0) {
        clearInterval(duoInterval);
      }
    }, 1000);
  }

  // ── Validation helpers ──
  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.add('visible');
  }
  function hideError() {
    errorEl.classList.remove('visible');
  }
  function shakeField(input) {
    const wrap = input.closest('.input-wrap');
    wrap.classList.add('shake');
    setTimeout(() => wrap.classList.remove('shake'), 500);
  }

  // ── SVG helpers ──
  function eyeOnSVG() {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  }
  function eyeOffSVG() {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
  }

  // ── Floating particles ──
  function createParticles() {
    const container = document.getElementById('particles');
    const symbols = ['£', '💰', '📊', '💳', '🪙', '📈', '💎', '🏦', '%', '$', '€'];
    const count = 18;

    for (let i = 0; i < count; i++) {
      const el = document.createElement('span');
      el.className = 'particle';
      el.textContent = symbols[Math.floor(Math.random() * symbols.length)];
      el.style.left = Math.random() * 100 + '%';
      el.style.fontSize = (0.8 + Math.random() * 1.2) + 'rem';
      el.style.animationDuration = (12 + Math.random() * 20) + 's';
      el.style.animationDelay = (Math.random() * 15) + 's';
      container.appendChild(el);
    }
  }
});
