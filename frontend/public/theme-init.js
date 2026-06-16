(function () {
  var t = localStorage.getItem('tempo-theme');
  if (t) document.documentElement.setAttribute('data-theme', t);
})();
