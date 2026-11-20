// Runs before every test file.

// The same page elements that index.html has, so views and popups can render.
document.body.innerHTML = `
  <header><div class="top"><div class="hud" id="hud"></div></div><nav id="tabs"></nav></header>
  <main id="view"></main>
  <div id="modal"><div class="mbox" id="mbox"></div></div>
  <div id="toasts"></div>`;

// No animation loop in tests: nothing should move unless a test moves it.
globalThis.requestAnimationFrame = () => 0;
