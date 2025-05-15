export function initUI() {
  const overlay = document.getElementById('ui-overlay');

  function show(htmlContent) {
    overlay.innerHTML = htmlContent;
    overlay.style.display = 'block';
  }

  function hide() {
    overlay.style.display = 'none';
  }

  return { show, hide };
}