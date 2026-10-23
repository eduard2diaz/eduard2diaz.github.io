(function () {
  'use strict';

  var LANGUAGE_COLORS = {
    'Python': '#3572A5', 'Java': '#b07219', 'Shell': '#89e051', 'Jupyter Notebook': '#DA5B0B',
    'HTML': '#e34c26', 'JavaScript': '#f1e05a', 'TypeScript': '#3178c6', 'Dart': '#00B4AB',
    'Dockerfile': '#384d54', 'Go': '#00ADD8', 'Kotlin': '#A97BFF'
  };

  var state = { tags: new Set(), owners: new Set(), q: '', sort: 'updated' };
  var data = null;

  var els = {
    title: document.getElementById('title'),
    subtitle: document.getElementById('subtitle'),
    search: document.getElementById('search'),
    sort: document.getElementById('sort'),
    tags: document.getElementById('tags'),
    owners: document.getElementById('owners'),
    count: document.getElementById('count'),
    clear: document.getElementById('clear'),
    results: document.getElementById('results'),
    empty: document.getElementById('empty'),
    error: document.getElementById('error'),
    generated: document.getElementById('generated')
  };

  function node(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  // ---------- estado <-> URL (#tag=a,b&org=x&q=texto) para poder compartir filtros
  function readHash() {
    var params = new URLSearchParams(location.hash.replace(/^#/, ''));
    state.tags = new Set((params.get('tag') || '').split(',').filter(Boolean));
    state.owners = new Set((params.get('org') || '').split(',').filter(Boolean));
    state.q = params.get('q') || '';
    state.sort = params.get('sort') === 'name' ? 'name' : 'updated';
  }

  function writeHash() {
    var params = new URLSearchParams();
    if (state.tags.size) params.set('tag', Array.from(state.tags).join(','));
    if (state.owners.size) params.set('org', Array.from(state.owners).join(','));
    if (state.q) params.set('q', state.q);
    if (state.sort !== 'updated') params.set('sort', state.sort);
    var hash = params.toString();
    history.replaceState(null, '', hash ? '#' + hash : location.pathname + location.search);
  }

  // ---------- filtrado
  function matches(repo, ignore) {
    // ignore: 'tags' | 'owners' para calcular los contadores de cada grupo sin su propio filtro
    if (ignore !== 'tags') {
      var ok = true;
      state.tags.forEach(function (t) { if (repo.topics.indexOf(t) === -1) ok = false; });
      if (!ok) return false;
    }
    if (ignore !== 'owners' && state.owners.size && !state.owners.has(repo.owner)) return false;
    var q = state.q.trim().toLowerCase();
    if (q) {
      var haystack = [repo.name, repo.owner, repo.description, repo.language || '', repo.topics.join(' ')]
        .join(' ').toLowerCase();
      return q.split(/\s+/).every(function (word) { return haystack.indexOf(word) !== -1; });
    }
    return true;
  }

  function counts(key, ignore) {
    var map = {};
    data.repos.forEach(function (repo) {
      if (!matches(repo, ignore)) return;
      (key === 'tags' ? repo.topics : [repo.owner]).forEach(function (v) { map[v] = (map[v] || 0) + 1; });
    });
    return map;
  }

  // ---------- render
  function renderChips(container, key, allValues, available, selected) {
    container.replaceChildren();
    allValues.forEach(function (value) {
      var n = available[value] || 0;
      var isOn = selected.has(value);
      if (n === 0 && !isOn) return;  // oculta combinaciones sin resultados
      var chip = node('button', 'chip');
      chip.type = 'button';
      chip.setAttribute('aria-pressed', String(isOn));
      chip.appendChild(document.createTextNode(value));
      chip.appendChild(node('span', 'n', String(n)));
      chip.addEventListener('click', function () {
        if (selected.has(value)) selected.delete(value); else selected.add(value);
        update();
      });
      container.appendChild(chip);
    });
  }

  function repoCard(repo) {
    var card = node('article', 'card');
    var heading = node('h2');
    var link = node('a', null, repo.name);
    if (repo.url.indexOf('https://github.com/') === 0) link.href = repo.url;
    heading.appendChild(link);
    card.appendChild(node('div', 'owner', repo.owner));
    card.appendChild(heading);
    card.appendChild(repo.description ? node('p', 'desc', repo.description) : node('p', 'desc none', 'No description'));

    var tags = node('div', 'tags');
    repo.topics.forEach(function (topic) {
      var tag = node('button', 'tag', topic);
      tag.type = 'button';
      tag.title = 'Filter by ' + topic;
      tag.addEventListener('click', function () { state.tags.add(topic); update(); window.scrollTo({ top: 0 }); });
      tags.appendChild(tag);
    });
    if (repo.topics.length) card.appendChild(tags);

    var meta = node('div', 'meta');
    if (repo.language) {
      var lang = node('span');
      var dot = node('span', 'dot');
      dot.style.background = LANGUAGE_COLORS[repo.language] || '#8b949e';
      lang.appendChild(dot);
      lang.appendChild(document.createTextNode(repo.language));
      meta.appendChild(lang);
    }
    meta.appendChild(node('span', null, 'Updated ' + repo.pushed_at.slice(0, 10)));
    if (repo.archived) meta.appendChild(node('span', 'badge', 'Archived'));
    card.appendChild(meta);
    return card;
  }

  function update() {
    writeHash();
    var visible = data.repos.filter(function (repo) { return matches(repo); });
    visible.sort(state.sort === 'name'
      ? function (a, b) { return a.name.toLowerCase().localeCompare(b.name.toLowerCase()); }
      : function (a, b) { return b.pushed_at.localeCompare(a.pushed_at); });

    // Tags: AND entre los seleccionados, asi que cada contador ya tiene en cuenta todos los filtros.
    // Organizaciones: OR entre las seleccionadas, asi que su contador ignora su propio filtro.
    var tagCounts = counts('tags', null);
    var ownerCounts = counts('owners', 'owners');
    var frequency = {};
    data.repos.forEach(function (r) { r.topics.forEach(function (t) { frequency[t] = (frequency[t] || 0) + 1; }); });
    var allTags = Object.keys(frequency).sort(function (a, b) { return frequency[b] - frequency[a] || a.localeCompare(b); });
    var allOwners = Array.from(new Set(data.repos.map(function (r) { return r.owner; }))).sort();

    renderChips(els.tags, 'tags', allTags, tagCounts, state.tags);
    renderChips(els.owners, 'owners', allOwners, ownerCounts, state.owners);

    els.results.replaceChildren.apply(els.results, visible.map(repoCard));
    els.empty.hidden = visible.length > 0;
    els.count.textContent = visible.length + ' of ' + data.repos.length + ' projects';
    els.clear.hidden = !(state.tags.size || state.owners.size || state.q);
    els.search.value = state.q;
    els.sort.value = state.sort;
  }

  function init(config, repos) {
    data = repos;
    els.title.textContent = config.title || 'Projects';
    els.subtitle.textContent = config.subtitle || '';
    document.title = (config.title || 'Projects') + ' · Projects';
    els.generated.textContent = 'Data from GitHub topics, refreshed daily (' + repos.generated.slice(0, 10) + ').';
    readHash();
    update();

    els.search.addEventListener('input', function () { state.q = els.search.value; update(); });
    els.sort.addEventListener('change', function () { state.sort = els.sort.value; update(); });
    els.clear.addEventListener('click', function () {
      state.tags.clear(); state.owners.clear(); state.q = ''; update();
    });
    window.addEventListener('hashchange', function () { readHash(); update(); });
  }

  Promise.all([
    fetch('projects.json').then(function (r) { return r.json(); }),
    fetch('repos.json').then(function (r) { return r.json(); })
  ]).then(function (all) { init(all[0], all[1]); })
    .catch(function () { els.error.hidden = false; });
})();
