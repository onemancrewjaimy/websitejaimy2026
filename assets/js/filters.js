/**
 * Portfoliofilters: werving, info en advertenties.
 * De keuze staat in de URL (?filter=werving), zodat links vanaf de homepage
 * direct op de juiste categorie uitkomen. Een anker zoals #project-05 zet
 * dat project in het midden van de waaier en opent het.
 */
const CATEGORIES = ['alles', 'werving', 'info', 'advertenties'];

export function initFilters(fan) {
  const buttons = [...document.querySelectorAll('[data-filter]')];
  const reset = document.querySelector('[data-filter-reset]');
  if (!buttons.length || !fan) return;

  function apply(category, { updateUrl = true } = {}) {
    const value = CATEGORIES.includes(category) ? category : 'alles';
    buttons.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.filter === value));
    });
    fan.setFilter(value);

    if (updateUrl) {
      const url = new URL(window.location.href);
      if (value === 'alles') url.searchParams.delete('filter');
      else url.searchParams.set('filter', value);
      url.hash = '';
      history.replaceState(null, '', url);
    }
  }

  buttons.forEach((button) => {
    button.addEventListener('click', () => apply(button.dataset.filter));
  });

  reset?.addEventListener('click', () => {
    apply('alles');
    buttons[0].focus();
  });

  function fromHash({ openIt }) {
    const id = window.location.hash.slice(1);
    if (!id) return false;
    return fan.show(id, { openIt });
  }

  const initial = new URLSearchParams(window.location.search).get('filter');
  apply(initial || 'alles', { updateUrl: false });
  fromHash({ openIt: true });

  window.addEventListener('hashchange', () => fromHash({ openIt: true }));
}
