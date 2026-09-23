// Keep Shipping early-access forms. There is no signup backend yet, so a valid
// address opens a prefilled mail to contact@keepshipping.run and the status line
// says so. With JS off the form's own mailto action does the same.
(function () {
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var TO = 'contact@keepshipping.run';
  var forms = document.querySelectorAll('.ks-form');
  var inputs = document.querySelectorAll('.ks-form input[type=email]');

  // The two forms share one address, as in the design.
  inputs.forEach(function (input) {
    input.addEventListener('input', function () {
      inputs.forEach(function (other) { if (other !== input) other.value = input.value; });
      forms.forEach(function (f) { status(f, ''); });
    });
  });

  function status(form, text, bad) {
    var p = form.querySelector('[role=status]');
    p.textContent = text;
    if (form.closest('#early-access')) return; // CTA status is white on blue
    p.style.color = bad ? 'oklch(0.5 0.19 25)' : 'oklch(0.48 0.2 263)';
  }

  forms.forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = form.querySelector('input[type=email]').value.trim();
      if (!EMAIL.test(email)) {
        status(form, 'That doesn’t look like an email address.', true);
        return;
      }
      var subject = 'Keep Shipping early access';
      var body = 'Please add me to the Keep Shipping early access list.\n\nEmail: ' + email + '\n';
      window.location.href = 'mailto:' + TO + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      status(form, '✓ Your mail app should open with the request. Send it and we’ll email you when your invite is ready.');
    });
  });
})();
