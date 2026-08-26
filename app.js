const archiveElement = document.querySelector('#archive');
const template = document.querySelector('#lore-template');
const searchInput = document.querySelector('#search');
const regionFilter = document.querySelector('#region-filter');
const randomButton = document.querySelector('#random-button');
const totalCount = document.querySelector('#total-count');
const visibleCount = document.querySelector('#visible-count');
const emptyState = document.querySelector('#empty-state');

let records = [];
let visibleRecords = [];

function normalize(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase();
}

function searchableText(record) {
  return normalize([
    record.id,
    record.title,
    record.region,
    record.era,
    record.medium,
    ...(record.tags ?? []),
    ...(record.lines ?? []),
  ].join(' '));
}

function renderRecord(record) {
  const fragment = template.content.cloneNode(true);
  const card = fragment.querySelector('.lore-card');
  card.dataset.recordId = record.id;

  fragment.querySelector('.record-id').textContent = record.id;
  fragment.querySelector('.record-title').textContent = record.title;

  const date = fragment.querySelector('.record-date');
  date.dateTime = record.published;
  date.textContent = record.published.replaceAll('-', '.');

  fragment.querySelector('.record-region').textContent = record.region;
  fragment.querySelector('.record-era').textContent = record.era;
  fragment.querySelector('.record-medium').textContent = record.medium;

  const lines = fragment.querySelector('.record-lines');
  for (const text of record.lines) {
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    lines.append(paragraph);
  }

  return fragment;
}

function render() {
  archiveElement.replaceChildren();

  const query = normalize(searchInput.value.trim());
  const region = regionFilter.value;

  visibleRecords = records.filter((record) => {
    const matchesQuery = !query || searchableText(record).includes(query);
    const matchesRegion = !region || record.region === region;
    return matchesQuery && matchesRegion;
  });

  for (const record of visibleRecords) {
    archiveElement.append(renderRecord(record));
  }

  visibleCount.textContent = String(visibleRecords.length);
  emptyState.hidden = visibleRecords.length !== 0;
}

function populateRegions() {
  const regions = [...new Set(records.map((record) => record.region))]
    .sort((a, b) => a.localeCompare(b, 'ja'));

  for (const region of regions) {
    const option = document.createElement('option');
    option.value = region;
    option.textContent = region;
    regionFilter.append(option);
  }
}

function showRandomRecord() {
  if (visibleRecords.length === 0) {
    return;
  }

  document.querySelectorAll('.highlighted').forEach((element) => {
    element.classList.remove('highlighted');
  });

  const index = Math.floor(Math.random() * visibleRecords.length);
  const selected = visibleRecords[index];
  const card = document.querySelector(`[data-record-id="${CSS.escape(selected.id)}"]`);

  if (!card) {
    return;
  }

  card.classList.add('highlighted');
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  window.setTimeout(() => card.classList.remove('highlighted'), 2600);
}

async function fetchJson(path) {
  const response = await fetch(`./${path}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`${path}: HTTP ${response.status}`);
  }
  return response.json();
}

async function initialize() {
  try {
    const index = await fetchJson('data/index.json');
    if (!index || !Number.isInteger(index.total)) {
      throw new TypeError('Lore index is invalid.');
    }

    // Web表示では月別キャッシュを優先する。古いindexとの互換用に日別正本へフォールバックする。
    const sources = Array.isArray(index.bundles) && index.bundles.length > 0
      ? index.bundles
      : index.files;

    if (!Array.isArray(sources) || sources.length === 0) {
      throw new TypeError('Lore index has no data sources.');
    }

    const chunks = await Promise.all(sources.map(async (source) => {
      const data = await fetchJson(source.path);
      if (!Array.isArray(data)) {
        throw new TypeError(`${source.path}: lore data must be an array.`);
      }
      return data;
    }));

    const data = chunks.flat();
    if (data.length !== index.total) {
      throw new Error(`Lore count mismatch: index=${index.total}, loaded=${data.length}`);
    }

    records = data.toSorted((a, b) => {
      const dateOrder = b.published.localeCompare(a.published);
      return dateOrder || b.id.localeCompare(a.id);
    });

    totalCount.textContent = String(index.total);
    populateRegions();
    render();
  } catch (error) {
    console.error(error);
    archiveElement.innerHTML = '<p class="empty-state">記録ファイルを読み込めなかった。</p>';
  }
}

searchInput.addEventListener('input', render);
regionFilter.addEventListener('change', render);
randomButton.addEventListener('click', showRandomRecord);

initialize();
