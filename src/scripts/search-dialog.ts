import MiniSearch from 'minisearch';

type Doc = {
  id: string;
  title: string;
  url: string;
  content: string;
};

const btn = document.getElementById('searchButton') as HTMLButtonElement | null;
const dialog = document.getElementById(
  'searchDialog',
) as HTMLDialogElement | null;
const input = document.getElementById('searchInput') as HTMLInputElement | null;
const resultsEl = document.getElementById(
  'searchResults',
) as HTMLElement | null;
const form = document.getElementById('searchForm') as HTMLFormElement | null;
const closeBtn = document.getElementById(
  'searchClose',
) as HTMLButtonElement | null;

let miniSearch: MiniSearch<Doc> | null = null;
let documents: Doc[] = [];
let selectedIndex = -1;
let currentResults: Array<{ id: string }> = [];

async function ensureIndex() {
  if (miniSearch) return;
  const res = await fetch('/search.json');
  documents = await res.json();
  miniSearch = new MiniSearch<Doc>({
    fields: ['title', 'content'],
    storeFields: ['id', 'title', 'url', 'content'],
    searchOptions: {
      boost: { title: 2 },
      prefix: true,
      fuzzy: 0.2,
    },
  });
  miniSearch.addAll(documents);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function highlight(text: string, terms: string[]): string {
  if (!terms.length) return escapeHtml(text);
  const pattern = terms
    .filter((t) => t.length > 0)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  if (!pattern) return escapeHtml(text);
  const re = new RegExp(`(${pattern})`, 'gi');
  return escapeHtml(text).replace(re, '<mark>$1</mark>');
}

function makeExcerpt(text: string, terms: string[], maxLen = 160): string {
  const lower = text.toLowerCase();
  const idx = (() => {
    for (const t of terms) {
      const i = lower.indexOf(t.toLowerCase());
      if (i >= 0) return i;
    }
    return -1;
  })();
  let start = 0;
  if (idx >= 0) {
    start = Math.max(0, idx - Math.floor(maxLen * 0.25));
  }
  const raw = text.slice(start, start + maxLen);
  const prefix = start > 0 ? '...' : '';
  const suffix = start + maxLen < text.length ? '...' : '';
  return `${prefix}${raw}${suffix}`;
}

function updateSelectedResult() {
  if (!resultsEl) return;
  const items = resultsEl.querySelectorAll('.result-item');
  items.forEach((item, idx) => {
    if (idx === selectedIndex) {
      item.classList.add('selected');
      // Scroll the selected item into view
      item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else {
      item.classList.remove('selected');
    }
  });
}

function navigateToSelectedResult() {
  if (selectedIndex < 0 || selectedIndex >= currentResults.length) return;
  const doc = documents.find((d) => d.id === currentResults[selectedIndex].id);
  if (doc) {
    window.location.href = doc.url;
  }
}

function renderResults(items: Array<{ id: string }>, query: string) {
  if (!resultsEl) return;
  currentResults = items;
  selectedIndex = -1; // Reset selection when results change
  if (!items?.length) {
    resultsEl.innerHTML = '';
    resultsEl.style.display = 'none';
    return;
  }
  const terms = query
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  const html = items
    .map((it, idx) => {
      const doc = documents.find((d) => d.id === it.id) ?? null;
      const used = doc ?? (it as unknown as Doc);
      const excerptRaw = makeExcerpt(used.content, terms, 160);
      const titleHtml = highlight(used.title, terms);
      const excerptHtml = highlight(excerptRaw, terms);
      return `
        <li>
          <a class="result-item" href="${used.url}" rel="noopener noreferrer" data-index="${idx}">
            <div class="result-title">${titleHtml}</div>
            <div class="result-desc">${excerptHtml}</div>
          </a>
        </li>
      `;
    })
    .join('');
  resultsEl.innerHTML = html;
  resultsEl.style.display = 'block';
}

async function openDialog() {
  await ensureIndex();
  if (dialog && !dialog.open) dialog.showModal();
  input?.focus();
  selectedIndex = -1;
  if (resultsEl) {
    resultsEl.innerHTML = '';
    resultsEl.style.display = 'none';
  }
}

function closeDialog() {
  dialog?.close();
  if (input) input.value = '';
  selectedIndex = -1;
  if (resultsEl) {
    resultsEl.innerHTML = '';
    resultsEl.style.display = 'none';
  }
}

btn?.addEventListener('click', openDialog);

form?.addEventListener('submit', (e) => {
  // Enter でフォームを閉じないようにする (検索継続のため)
  e.preventDefault();
});

closeBtn?.addEventListener('click', () => {
  closeDialog();
});

input?.addEventListener('input', () => {
  const q = (input?.value || '').trim();
  if (!q) {
    selectedIndex = -1;
    if (resultsEl) {
      resultsEl.innerHTML = '';
      resultsEl.style.display = 'none';
    }
    return;
  }
  const items = miniSearch ? miniSearch.search(q) : [];
  renderResults(items as Array<{ id: string }>, q);
});

input?.addEventListener('keydown', (e) => {
  if (!currentResults.length) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedIndex = Math.min(selectedIndex + 1, currentResults.length - 1);
    updateSelectedResult();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedIndex = Math.max(selectedIndex - 1, -1);
    updateSelectedResult();
  } else if (e.key === 'Enter' && selectedIndex >= 0) {
    e.preventDefault();
    navigateToSelectedResult();
  }
});

dialog?.addEventListener('cancel', () => closeDialog());
dialog?.addEventListener('click', (event) => {
  if (event.target === dialog) closeDialog();
});
