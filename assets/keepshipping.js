// Keep Shipping early-access forms.
//
// Posts { email, product: "keepshipping", captchaToken } to the waitlist
// Worker at api.keepshipping.run (Keep-Shipping/waitlist-backend, on the
// Cratefield harness waitlist module). captchaToken is a Cloudflare Turnstile
// token (managed widget, action "waitlist"); the Worker binds it to the apex
// keepshipping.run and refuses a join without one (400, problem type
// .../captcha-failed). A valid join answers 202 whether or not the address was
// already on the list, and a confirmation link is mailed (double opt-in).
//
// The Turnstile widget is rendered into the form being used, on submit, so the
// two forms never show two challenges. With JS off the form's own mailto
// action still sends the request by mail.
(function () {
  var API = 'https://api.keepshipping.run/v1/waitlist';
  var SITEKEY = '0x4AAAAAAFRBJzz7QFTNISC4';
  var TURNSTILE = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=ksTurnstileReady';
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var TO = 'contact@keepshipping.run';
  var forms = document.querySelectorAll('.ks-form');
  var inputs = document.querySelectorAll('.ks-form input[type=email]');

  var loading = false;
  var broken = false;
  var widget = null;     // the one Turnstile widget id
  var widgetForm = null; // the form it lives in
  var token = '';
  var pending = null;    // a form waiting for a token before it sends

  // The two forms share one address, as in the design.
  inputs.forEach(function (input) {
    input.addEventListener('input', function () {
      inputs.forEach(function (other) { if (other !== input) other.value = input.value; });
      forms.forEach(function (f) { status(f, ''); });
    });
    // Fetch the Turnstile script early, so the check is ready by submit.
    input.addEventListener('focus', load);
  });

  // The line under the field: announced politely, or as an alert (with the
  // field marked invalid) when `bad`.
  function status(form, text, bad) {
    var p = line(form);
    var input = form.querySelector('input[type=email]');
    p.setAttribute('role', bad ? 'alert' : 'status');
    p.setAttribute('aria-live', bad ? 'assertive' : 'polite');
    p.textContent = text;
    if (bad) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    if (form.closest('#early-access')) return; // CTA status is white on blue
    p.style.color = bad ? 'oklch(0.5 0.19 25)' : 'oklch(0.48 0.2 263)';
  }
  function line(form) { return form.querySelector('p[id$="-status"]'); }

  var NET = 'We couldn’t reach the waitlist just now. Try again in a moment, or write to ';
  var BAD_EMAIL = 'That email address doesn’t look right. Check it and try again.';

  // Success: the form gives way to a panel that says where the link went.
  function done(form, email) {
    var panel = document.createElement('div');
    panel.className = 'ks-done';
    panel.setAttribute('role', 'status');
    panel.setAttribute('aria-live', 'polite');
    panel.tabIndex = -1;
    var h = document.createElement('p');
    h.className = 'ks-done__h';
    h.textContent = 'Check your inbox';
    var body = document.createElement('p');
    var who = document.createElement('strong');
    who.textContent = email;
    body.append('We sent a confirmation link to ', who, '. Click it to hold your place on the Keep Shipping waitlist.');
    var fine = document.createElement('p');
    fine.className = 'ks-done__fine';
    fine.textContent = 'It can take a minute — check Spam or Promotions if it isn’t there. Already confirmed before? Then you’re already on the list; nothing more to do.';
    var more = document.createElement('p');
    more.className = 'ks-done__fine';
    var again = document.createElement('button');
    again.type = 'button';
    again.className = 'ks-done__again';
    again.textContent = 'Use a different email';
    var mail = document.createElement('a');
    mail.href = 'mailto:' + TO + '?subject=' + encodeURIComponent('Keep Shipping early access');
    mail.textContent = TO;
    more.append(again, ' · Still nothing? Email ', mail, '.');
    panel.append(h, body, fine, more);
    again.addEventListener('click', function () {
      panel.remove();
      form.hidden = false;
      status(form, '');
      token = '';
      if (window.turnstile && widget !== null && widgetForm === form) window.turnstile.reset(widget);
      var input = form.querySelector('input[type=email]');
      input.focus();
      input.select();
    });
    form.hidden = true;
    form.parentNode.insertBefore(panel, form.nextSibling);
    panel.focus();
  }

  // The Worker or Turnstile is unreachable: offer the address to write to.
  function fallback(form, email) {
    var subject = 'Keep Shipping early access';
    var body = 'Please add me to the Keep Shipping early access list.\n\nEmail: ' + email + '\n';
    var a = document.createElement('a');
    a.href = 'mailto:' + TO + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    a.textContent = TO;
    a.style.color = 'inherit';
    var p = line(form);
    status(form, NET, true);
    form.querySelector('input[type=email]').removeAttribute('aria-invalid');
    p.appendChild(a);
    p.appendChild(document.createTextNode(' and we’ll add you.'));
  }

  function load() {
    if (loading || window.turnstile) return;
    loading = true;
    window.ksTurnstileReady = function () { if (pending) render(pending); };
    var tag = document.createElement('script');
    tag.src = TURNSTILE; tag.async = true; tag.defer = true;
    tag.onerror = function () {
      broken = true;
      if (pending) { var f = pending; pending = null; fallback(f, f.querySelector('input[type=email]').value.trim()); }
    };
    document.head.appendChild(tag);
  }

  function box(form) {
    var b = form.querySelector('[data-captcha]');
    if (!b) {
      b = document.createElement('div');
      b.setAttribute('data-captcha', '');
      b.setAttribute('role', 'group');
      b.setAttribute('aria-label', 'Human check');
      form.insertBefore(b, line(form));
    }
    return b;
  }

  // Render the single widget into `form`, moving it if it lives elsewhere.
  function render(form) {
    if (!window.turnstile) return;
    if (widget !== null && widgetForm === form) return;
    if (widget !== null) { window.turnstile.remove(widget); widget = null; token = ''; }
    widgetForm = form;
    widget = window.turnstile.render(box(form), {
      sitekey: SITEKEY,
      action: 'waitlist',
      theme: 'light',
      callback: function (t) {
        token = t;
        if (pending === form) { pending = null; send(form); }
      },
      'expired-callback': function () { token = ''; },
      'error-callback': function () { token = ''; }
    });
  }

  function send(form) {
    var input = form.querySelector('input[type=email]');
    var email = input.value.trim();
    var btn = form.querySelector('button[type=submit]');
    var t = token;
    token = '';
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    btn.dataset.label = btn.textContent;
    btn.textContent = 'Sending…';
    status(form, '');
    fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, product: 'keepshipping', captchaToken: t })
    }).then(function (res) {
      if (res.ok) {
        status(form, '');
        done(form, email);
        return;
      }
      return res.json().catch(function () { return {}; }).then(function (p) {
        var type = (p && p.type) || '';
        if (/\/captcha-failed$/.test(type)) status(form, 'The human check didn’t go through. It’s been reset — complete it again, then send.', true);
        else if (res.status === 429) status(form, 'Too many tries. Wait a minute, then try again.', true);
        else if (res.status === 400) { status(form, BAD_EMAIL, true); input.focus(); }
        else fallback(form, email);
      });
    }).catch(function () {
      fallback(form, email);
    }).then(function () {
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      btn.textContent = btn.dataset.label || 'Get early access';
      if (window.turnstile && widget !== null) window.turnstile.reset(widget);
    });
  }

  forms.forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = form.querySelector('input[type=email]').value.trim();
      if (!EMAIL.test(email)) {
        status(form, BAD_EMAIL, true);
        form.querySelector('input[type=email]').focus();
        return;
      }
      if (broken) { fallback(form, email); return; }
      if (token && widgetForm === form) { send(form); return; }
      pending = form;
      load();
      render(form);
      status(form, 'One more step: complete the human check, then you’re on the list.');
    });
  });
})();
