/* Password rules for NEW passwords (register + change password).
   Mirrors api/lib/password_policy.php; keep the two in sync. */
(function () {
  'use strict';

  const MIN = 8;
  const MAX = 16;
  const MESSAGE = 'Password must be 8–16 characters and include an uppercase letter, a lowercase letter, a number, and a symbol or space.';
  const RULES = [
    // [...p] counts characters the way PHP mb_strlen does (emoji = 1, not 2).
    { id: 'length', label: '8–16 characters', test: (p) => [...p].length >= MIN && [...p].length <= MAX },
    { id: 'lower', label: 'Lowercase letter (a–z)', test: (p) => /[a-z]/.test(p) },
    { id: 'upper', label: 'Uppercase letter (A–Z)', test: (p) => /[A-Z]/.test(p) },
    { id: 'digit', label: 'Number (0–9)', test: (p) => /[0-9]/.test(p) },
    { id: 'symbol', label: 'Symbol or space', test: (p) => /[^A-Za-z0-9]/.test(p) },
  ];

  function isValid(password) {
    return RULES.every((rule) => rule.test(String(password || '')));
  }

  /* Renders a progress bar under the field plus a list of ONLY the rules still missing.
     Nothing is listed until the user starts typing; each rule disappears once it is met.
     Returns { isValid } for the current value. */
  function mountChecklist(input, onChange) {
    const box = document.createElement('div');
    box.className = 'pw-meter';
    box.id = input.id + 'Rules';
    box.innerHTML =
      '<div class="pw-progress" role="progressbar" aria-valuemin="0" aria-valuemax="' + RULES.length + '" aria-valuenow="0" aria-label="Password requirements met">' +
      '<span class="pw-progress-fill"></span></div>' +
      '<p class="pw-progress-label" aria-hidden="true"></p>' +
      '<ul class="pw-missing" aria-live="polite" aria-label="Still needed" hidden>' +
      RULES.map((rule) => '<li data-rule="' + rule.id + '" hidden></li>').join('') +
      '</ul>';
    // Labels are static, but set them as text rather than HTML anyway.
    RULES.forEach((rule) => { box.querySelector('li[data-rule="' + rule.id + '"]').textContent = rule.label; });

    (input.closest('.password-wrap') || input).insertAdjacentElement('afterend', box);
    const describedBy = (input.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
    if (!describedBy.includes(box.id)) input.setAttribute('aria-describedby', describedBy.concat(box.id).join(' '));

    const bar = box.querySelector('.pw-progress');
    const fill = box.querySelector('.pw-progress-fill');
    const label = box.querySelector('.pw-progress-label');
    const missingList = box.querySelector('.pw-missing');

    const sync = () => {
      const value = input.value;
      const typed = value.length > 0;
      let met = 0;
      RULES.forEach((rule) => {
        const ok = rule.test(value);
        if (ok) met++;
        // Show a rule only while it is still missing, and only after typing starts.
        box.querySelector('li[data-rule="' + rule.id + '"]').hidden = ok || !typed;
      });
      const all = met === RULES.length;
      missingList.hidden = !typed || all;
      fill.style.width = (met / RULES.length * 100) + '%';
      box.dataset.level = !typed ? 'empty' : all ? 'strong' : met >= 3 ? 'fair' : 'weak';
      bar.setAttribute('aria-valuenow', String(met));
      bar.setAttribute('aria-valuetext', met + ' of ' + RULES.length + ' requirements met');
      label.textContent = !typed ? '' : all ? 'Strong password ✓' : met + ' of ' + RULES.length + ' requirements met';
      if (typeof onChange === 'function') onChange(isValid(value));
    };
    input.addEventListener('input', sync);
    sync();
    return { isValid: () => isValid(input.value), sync };
  }

  window.SevenPasswordPolicy = { MIN, MAX, MESSAGE, RULES, isValid, mountChecklist };
})();
