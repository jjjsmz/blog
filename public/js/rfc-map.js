// Column tree for the RFC map: レイヤと分野 -> 技術 -> サブトピック -> RFC.
// The two upper levels ship with the page; subtopics and RFCs are fetched
// per technology from /tool/rfc/data/<technology>.json.
const KINDS = ['レイヤと分野', '技術', 'サブトピック', 'RFC'];

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const rfcUrl = (number) => `https://www.rfc-editor.org/info/rfc${number}/`;

async function init() {
  const host = document.getElementById('rfc-tree');
  const source = document.getElementById('rfc-tree-data');
  if (!host || !source) return;

  const { bands, bandOf } = JSON.parse(source.textContent);
  const cache = new Map();

  /** [bandId, technologyId, subtopicKey] */
  let path = [];

  const findBand = (id) => bands.find((band) => band.id === id);

  function technology() {
    const band = findBand(path[0]);
    return band?.children.find((tech) => tech.id === path[1]);
  }

  async function load(technologyId) {
    if (cache.has(technologyId)) return cache.get(technologyId);
    const res = await fetch(`/tool/rfc/data/${technologyId}.json`);
    if (!res.ok)
      throw new Error(`failed to load ${technologyId}: ${res.status}`);
    const payload = await res.json();
    cache.set(technologyId, payload);
    return payload;
  }

  function open(depth, id) {
    path =
      path[depth] === id ? path.slice(0, depth) : [...path.slice(0, depth), id];
    render();
  }

  function jumpTo(technologyId) {
    const band = bandOf[technologyId];
    if (!band) return;
    path = [band, technologyId];
    render();
  }

  function nodeButton(node, depth) {
    const button = el('button', 'node');
    button.type = 'button';
    button.setAttribute('aria-expanded', String(path[depth] === node.id));
    button.append(
      el('span', 'label', node.label),
      el('span', 'n', node.count.toLocaleString()),
      el('span', 'arrow', '›'),
    );
    button.addEventListener('click', () => open(depth, node.id));
    return button;
  }

  function rfcRow(rfc) {
    const [number, title, isStandard] = rfc;
    const row = el('div', isStandard ? 'rfc std' : 'rfc');
    const link = el('a', null, `RFC ${number}`);
    link.href = rfcUrl(number);
    link.rel = 'noopener';
    link.target = '_blank';
    row.append(link, el('span', 'title', title));
    return row;
  }

  function column(kind, count, build, footer) {
    const section = el('section', 'column');
    const head = el('div', 'column-head');
    head.append(
      el('span', null, kind),
      el('span', 'n', count.toLocaleString()),
    );
    const items = el('div', 'items');
    build(items);
    section.append(head, items);
    if (footer) section.append(footer);
    return section;
  }

  function relatedBlock(related) {
    if (!related || related.length === 0) return null;
    const box = el('div', 'related');
    box.append(el('h3', null, '関連する技術'));
    const list = el('ul');
    for (const tech of related) {
      const item = el('li');
      const button = el('button', null, tech.name);
      button.type = 'button';
      button.addEventListener('click', () => jumpTo(tech.id));
      item.append(button);
      list.append(item);
    }
    box.append(list);
    return box;
  }

  function render() {
    host.replaceChildren();

    host.append(
      column(KINDS[0], bands.length, (items) => {
        for (const band of bands) items.append(nodeButton(band, 0));
      }),
    );

    const band = findBand(path[0]);
    if (band) {
      host.append(
        column(KINDS[1], band.children.length, (items) => {
          for (const tech of band.children) items.append(nodeButton(tech, 1));
        }),
      );
    }

    const tech = technology();
    if (tech) {
      const payload = cache.get(tech.id);
      if (!payload) {
        host.append(
          column(KINDS[2], 0, (items) => {
            items.append(el('p', 'loading', '読み込み中…'));
          }),
        );
      } else {
        host.append(
          column(
            KINDS[2],
            payload.subtopics.length,
            (items) => {
              for (const subtopic of payload.subtopics) {
                items.append(
                  nodeButton(
                    {
                      id: subtopic.key,
                      label: subtopic.heading,
                      count: subtopic.count,
                    },
                    2,
                  ),
                );
              }
            },
            relatedBlock(payload.related),
          ),
        );

        const subtopic = payload.subtopics.find((s) => s.key === path[2]);
        if (subtopic) {
          host.append(
            column(KINDS[3], subtopic.rfcs.length, (items) => {
              for (const rfc of subtopic.rfcs) items.append(rfcRow(rfc));
            }),
          );
        }
      }
    }

    if (path.length > 0) {
      host.scrollTo({ left: host.scrollWidth, behavior: 'smooth' });
    }
    ensureLoaded();
  }

  // the subtopic column paints as "読み込み中…" first, then re-renders
  async function ensureLoaded() {
    const tech = technology();
    if (!tech || cache.has(tech.id)) return;
    try {
      await load(tech.id);
    } catch (error) {
      console.error(error);
      cache.set(tech.id, { subtopics: [], related: [] });
    }
    render();
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && path.length > 0) {
      path = path.slice(0, -1);
      render();
    }
  });

  render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
