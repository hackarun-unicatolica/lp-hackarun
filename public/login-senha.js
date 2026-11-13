// botão de olho da senha no login da organização (/sorteio, /gemas): mostra ou esconde o que foi digitado
document.querySelectorAll('[data-eye]').forEach(function (button) {
  button.hidden = false;
  button.addEventListener('click', function () {
    var input = document.getElementById(button.getAttribute('aria-controls'));
    if (!input) return;
    var show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    button.setAttribute('aria-pressed', String(show));
    button.setAttribute('aria-label', show ? 'Esconder senha' : 'Mostrar senha');
    input.focus();
  });
});
