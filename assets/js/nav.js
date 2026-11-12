/**
 * Navigatie: het volledig-scherm menu op kleine schermen.
 * De knop meldt zijn stand via aria-expanded; Escape en een klik op een
 * link sluiten het menu, en de focus blijft binnen het menu zolang het open is.
 */
export function initNav() {
  const toggle = document.querySelector('[data-menu-toggle]');
  const menu = document.querySelector('[data-menu]');
  if (!toggle || !menu) return;

  const wide = window.matchMedia('(min-width: 1140px)');

  function setOpen(open) {
    menu.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Menu sluiten' : 'Menu openen');
    document.body.style.overflow = open ? 'hidden' : '';
  }

  const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';

  toggle.addEventListener('click', () => setOpen(!isOpen()));

  menu.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (!isOpen()) return;
    if (event.key === 'Escape') {
      setOpen(false);
      toggle.focus();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [toggle, ...menu.querySelectorAll('a, button')];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  wide.addEventListener('change', () => {
    if (wide.matches && isOpen()) setOpen(false);
  });
}
