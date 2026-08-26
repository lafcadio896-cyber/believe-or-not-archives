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
const availableAssetsByLore = new Map();

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

function resolveAssetUrl(asset) {
  if (asset.url) {
    return asset.url;
  }
  if (!asset.path) {
    return null;
  }
  if (/^(?:https?:)?\/\//.test(asset.path)) {
    return asset.path;
  }
  return `./${asset.path.replace(/^\.\//, '').replace(/^\//, '')}`;
}

function renderAssets(record, fragment) {
  const assets = availableAssetsByLore.get(record.id) ?? [];
  if (assets.length === 0) {
    return;
  }

  const section = document.createElement('section');
  section.className = 'record-assets';
  section.setAttribute('aria-label', '付属資料');

  const heading = document.createElement('p');
  heading.className = 'asset-heading';
  heading.textContent = `ATTACHED MATERIALS / ${assets.length}`;
  section.append(heading);

  for (const asset of assets) {
    const item = document.createElement('div');
    item.className = `asset-item asset-${asset.type}`;
    const url = resolveAssetUrl(asset);

    if (asset.type === 'image' && url) {
      const figure = document.createElement('figure');
      const image = document.createElement('img');
      image.src = url;
      image.loading = 'lazy';
      image.alt = asset.alt || asset.caption || '付属画像資料';
      figure.append(image);
      if (asset.caption) {
        const caption = document.createElement('figcaption');
        caption.textContent = asset.caption;
        figure.append(caption);
      }
      item.append(figure);
    } else if (asset.type === 'audio' && url) {
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.preload = 'none';
      audio.src = url;
      item.append(audio);
      if (asset.caption) {
        const caption = document.createElement('p');
        caption.className = 'asset-caption';
        caption.textContent = asset.caption;
        item.append(caption);
      }
    } else if (url) {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = asset.caption || (asset.type === 'map' ? '地図資料を開く' : '付属資料を開く');
      item.append(link);
    }

    section.append(item);
  }

  const loreBody = fragment.querySelector('.lore-body');
  const closing = fragment.querySelector('.closing');
  loreBody.insertBefore(section, closing);
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

  renderAssets(record, fragment);
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

async function loadAvailableAssets(index) {
  if (!index.assets_index) {
    return;
  }

  try {
    const assetIndex = await fetchJson(index.assets_index);
    if (!Array.isArray(assetIndex.files)) {
      return;
    }

    const chunks = await Promise.all(assetIndex.files.map(async (source) => {
      const payload = await fetchJson(source.path);
      return Array.isArray(payload.items) ? payload.items : [];
    }));

    for (const asset of chunks.flat()) {
      if (asset.status !== 'available') {
        continue;
      }
      const current = availableAssetsByLore.get(asset.lore_id) ?? [];
      current.push(asset);
      availableAssetsByLore.set(asset.lore_id, current);
    }
  } catch (error) {
    // 資料は補助情報なので、読み込み失敗で本文アーカイブ全体を止めない。
    console.warn('Attached materials could not be loaded.', error);
  }
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

    const [chunks] = await Promise.all([
      Promise.all(sources.map(async (source) => {
        const data = await fetchJson(source.path);
        if (!Array.isArray(data)) {
          throw new TypeError(`${source.path}: lore data must be an array.`);
        }
        return data;
      })),
      loadAvailableAssets(index),
    ]);

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
