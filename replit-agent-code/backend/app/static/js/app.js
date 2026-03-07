const API = '';

async function api(endpoint, options = {}) {
    const url = `${API}/api${endpoint}`;
    const resp = await fetch(url, options);
    return resp.json();
}

async function apiPost(endpoint, body) {
    return api(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');

        if (tab.dataset.tab === 'dataset' && !datasetLoaded) loadDataset();
        if (tab.dataset.tab === 'dating' && !datingLoaded) loadDatingData();
    });
});

document.getElementById('add-cognate').addEventListener('click', () => {
    const container = document.getElementById('cognate-inputs');
    const row = document.createElement('div');
    row.className = 'cognate-row';
    row.innerHTML = `
        <select class="lang-select">
            <option value="Romanian">Romanian</option>
            <option value="French">French</option>
            <option value="Italian">Italian</option>
            <option value="Spanish">Spanish</option>
            <option value="Portuguese" selected>Portuguese</option>
            <option value="Other">Other</option>
        </select>
        <input type="text" class="word-input" placeholder="IPA form">
        <button class="btn-remove" title="Remove">&times;</button>
    `;
    container.appendChild(row);
    setupRemoveButtons();
});

function setupRemoveButtons() {
    document.querySelectorAll('.btn-remove').forEach(btn => {
        btn.onclick = () => {
            const rows = document.querySelectorAll('.cognate-row');
            if (rows.length > 2) btn.parentElement.remove();
        };
    });
}
setupRemoveButtons();

document.getElementById('btn-example').addEventListener('click', () => {
    const examples = [
        { words: [['French', 'pɛːr'], ['Italian', 'padre'], ['Spanish', 'padre'], ['Portuguese', 'paj']], },
        { words: [['French', 'mɛːr'], ['Italian', 'madre'], ['Spanish', 'madre'], ['Portuguese', 'mɐ̃j']], },
        { words: [['Romanian', 'apɨ'], ['French', 'o'], ['Italian', 'akwa'], ['Spanish', 'aɣwa'], ['Portuguese', 'aɡwɐ']], },
        { words: [['French', 'nɥi'], ['Italian', 'nɔtte'], ['Spanish', 'notʃe'], ['Portuguese', 'nojtʃi']], },
    ];
    const ex = examples[Math.floor(Math.random() * examples.length)];

    const container = document.getElementById('cognate-inputs');
    container.innerHTML = '';
    ex.words.forEach(([lang, word]) => {
        const row = document.createElement('div');
        row.className = 'cognate-row';
        row.innerHTML = `
            <select class="lang-select">
                <option value="Romanian"${lang === 'Romanian' ? ' selected' : ''}>Romanian</option>
                <option value="French"${lang === 'French' ? ' selected' : ''}>French</option>
                <option value="Italian"${lang === 'Italian' ? ' selected' : ''}>Italian</option>
                <option value="Spanish"${lang === 'Spanish' ? ' selected' : ''}>Spanish</option>
                <option value="Portuguese"${lang === 'Portuguese' ? ' selected' : ''}>Portuguese</option>
                <option value="Other">Other</option>
            </select>
            <input type="text" class="word-input" value="${word}" placeholder="IPA form">
            <button class="btn-remove" title="Remove">&times;</button>
        `;
        container.appendChild(row);
    });
    setupRemoveButtons();
});

document.getElementById('btn-reconstruct').addEventListener('click', async () => {
    const rows = document.querySelectorAll('.cognate-row');
    const words = [];
    const languages = [];

    rows.forEach(row => {
        const lang = row.querySelector('.lang-select').value;
        const word = row.querySelector('.word-input').value.trim();
        if (word) {
            words.push(word);
            languages.push(lang);
        }
    });

    if (words.length < 2) {
        alert('Enter at least 2 cognate words');
        return;
    }

    const btn = document.getElementById('btn-reconstruct');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading"></span>Reconstructing...';

    try {
        const result = await apiPost('/reconstruct', { words, languages });
        displayResults(result);
    } catch (e) {
        document.getElementById('results').style.display = 'block';
        document.getElementById('results').innerHTML = `<div class="error-message">Error: ${e.message}</div>`;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Reconstruct Proto-Form';
    }
});

function displayResults(result) {
    const container = document.getElementById('results');
    container.style.display = 'block';

    if (result.error) {
        container.innerHTML = `<div class="error-message">${result.error}</div>`;
        return;
    }

    const protoDisplay = document.getElementById('proto-form-display');
    protoDisplay.textContent = result.proto_form;
    const protoBtn = document.createElement('button');
    protoBtn.className = 'pronounce-btn';
    protoBtn.innerHTML = '&#x1f50a; Listen';
    protoBtn.dataset.ipa = result.proto_form.replace(/^\*/, '');
    protoBtn.addEventListener('click', () => pronounceIPA(protoBtn.dataset.ipa));
    protoDisplay.appendChild(protoBtn);

    const actualEl = document.getElementById('actual-latin');
    if (result.actual_latin) {
        actualEl.style.display = 'block';
        actualEl.innerHTML = '';
        actualEl.appendChild(document.createTextNode('Actual Latin: '));
        const latinSpan = document.createElement('span');
        latinSpan.textContent = result.actual_latin;
        actualEl.appendChild(latinSpan);
        const latinBtn = document.createElement('button');
        latinBtn.className = 'pronounce-btn';
        latinBtn.innerHTML = '&#x1f50a;';
        latinBtn.dataset.ipa = result.actual_latin;
        latinBtn.addEventListener('click', () => pronounceIPA(latinBtn.dataset.ipa));
        actualEl.appendChild(latinBtn);
    } else {
        actualEl.style.display = 'none';
    }

    if (result.tree) drawConvergenceTree(result.tree);
    if (result.alignment) displayAlignment(result.alignment, result.languages);
    if (result.correspondences) displayCorrespondences(result.correspondences, result.languages);
    if (result.distances) displayDistances(result.distances);
}

function displayCorrespondences(correspondences, languages) {
    const container = document.getElementById('correspondence-display');
    if (!container || !correspondences || correspondences.length === 0) return;

    let html = '<table class="correspondence-table"><thead><tr><th>Position</th>';
    if (languages) languages.forEach(l => { html += `<th>${l}</th>`; });
    html += '<th>Proto</th><th>Freq</th></tr></thead><tbody>';

    correspondences.forEach((corr, i) => {
        html += `<tr><td>${i + 1}</td>`;
        corr.segments.forEach(seg => {
            html += `<td>${seg}</td>`;
        });
        html += `<td class="proto-col">${corr.proto}</td>`;
        html += `<td class="freq-col">${corr.frequency || ''}</td>`;
        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

function displayAlignment(alignment, languages) {
    const container = document.getElementById('alignment-display');
    if (!alignment || alignment.length === 0) {
        container.innerHTML = '<p>No alignment data</p>';
        return;
    }

    let html = '<table class="alignment-table"><tbody>';
    alignment.forEach((row, i) => {
        const label = languages && languages[i] ? languages[i] : `Word ${i + 1}`;
        html += `<tr><td class="lang-label">${label}</td>`;
        row.forEach(seg => {
            const cls = seg === '-' ? 'gap' : '';
            html += `<td class="${cls}">${seg}</td>`;
        });
        html += '</tr>';
    });
    html += '</tbody></table>';
    container.innerHTML = html;

    highlightMatchingColumns();
}

function highlightMatchingColumns() {
    const table = document.querySelector('.alignment-table');
    if (!table) return;
    const rows = table.querySelectorAll('tr');
    if (rows.length === 0) return;

    const numCols = rows[0].querySelectorAll('td').length;
    for (let col = 1; col < numCols; col++) {
        const vals = new Set();
        rows.forEach(row => {
            const cell = row.querySelectorAll('td')[col];
            if (cell) {
                const v = cell.textContent.trim();
                if (v !== '-') vals.add(v);
            }
        });
        if (vals.size === 1) {
            rows.forEach(row => {
                const cell = row.querySelectorAll('td')[col];
                if (cell && cell.textContent.trim() !== '-') {
                    cell.classList.add('match');
                }
            });
        }
    }
}

function displayDistances(distances) {
    const container = document.getElementById('distances-display');
    if (!distances || distances.length === 0) {
        container.innerHTML = '<p>No distance data</p>';
        return;
    }

    let html = `<table class="distances-table">
        <thead><tr>
            <th>Languages</th>
            <th>Words</th>
            <th>Distance</th>
            <th>Est. Years</th>
            <th>Category</th>
        </tr></thead><tbody>`;

    distances.forEach(d => {
        const cat = d.divergence ? d.divergence.category : '—';
        const years = d.divergence ? `~${d.divergence.estimated_years.toLocaleString()}` : '—';
        const ned = d.normalized_edit_distance !== null ? d.normalized_edit_distance.toFixed(3) : '—';
        const badgeClass = getCategoryClass(cat);
        html += `<tr>
            <td>${d.lang1} — ${d.lang2}</td>
            <td style="font-family: var(--font-mono); font-size: 0.8rem;">${d.word1} / ${d.word2}</td>
            <td style="font-family: var(--font-mono);">${ned}</td>
            <td style="font-family: var(--font-mono);">${years}</td>
            <td><span class="category-badge ${badgeClass}">${cat}</span></td>
        </tr>`;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

function getCategoryClass(category) {
    if (category.includes('Dialect')) return 'dialects';
    if (category.includes('Romance')) return 'romance';
    if (category.includes('Germanic')) return 'germanic';
    if (category.includes('IE')) return 'ie';
    return 'deep';
}

function drawConvergenceTree(treeData) {
    const container = document.getElementById('tree-container');
    container.innerHTML = '';

    const width = 500;
    const height = 350;
    const margin = { top: 30, right: 140, bottom: 30, left: 40 };

    const svg = d3.select('#tree-container')
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const root = d3.hierarchy(treeData);
    const treeLayout = d3.tree().size([innerH, innerW]);
    treeLayout(root);

    const links = g.selectAll('.tree-link')
        .data(root.links())
        .enter()
        .append('path')
        .attr('class', 'tree-link')
        .attr('d', d3.linkHorizontal()
            .x(d => d.y)
            .y(d => d.x))
        .style('opacity', 0);

    const nodes = g.selectAll('.tree-node')
        .data(root.descendants())
        .enter()
        .append('g')
        .attr('class', d => `tree-node ${d.data.type || ''}`)
        .attr('transform', d => `translate(${d.y},${d.x})`)
        .style('opacity', 0);

    nodes.append('circle')
        .attr('r', d => d.data.type === 'root' ? 7 : 5);

    nodes.append('text')
        .attr('dy', '0.35em')
        .attr('x', d => d.children ? -12 : 12)
        .attr('text-anchor', d => d.children ? 'end' : 'start')
        .text(d => d.data.name);

    animateTree(links, nodes, root);
}

function animateTree(links, nodes, root) {
    const leaves = nodes.filter(d => !d.children);
    const internals = nodes.filter(d => d.children && d.parent);
    const rootNode = nodes.filter(d => !d.parent);

    leaves.transition().duration(600).style('opacity', 1);

    links.filter(d => !d.target.children)
        .transition().delay(400).duration(600).style('opacity', 1);

    internals.transition().delay(800).duration(600).style('opacity', 1);
    links.filter(d => d.target.children && d.target.parent)
        .transition().delay(800).duration(600).style('opacity', 1);

    rootNode.transition().delay(1200).duration(600).style('opacity', 1);
    links.filter(d => !d.source.parent)
        .transition().delay(1200).duration(600).style('opacity', 1);
}

document.getElementById('btn-animate-tree').addEventListener('click', () => {
    const svg = d3.select('#tree-container svg');
    if (svg.empty()) return;
    const links = svg.selectAll('.tree-link');
    const nodes = svg.selectAll('.tree-node');
    links.style('opacity', 0);
    nodes.style('opacity', 0);
    const root = d3.hierarchy({});
    animateTree(links, nodes, root);
});

let datasetLoaded = false;
let datasetOffset = 0;
const PAGE_SIZE = 25;

async function loadDataset(offset = 0, searchQuery = null) {
    const container = document.getElementById('dataset-table-container');
    container.innerHTML = '<span class="loading"></span> Loading...';

    let result;
    if (searchQuery) {
        result = await api(`/dataset/search?q=${encodeURIComponent(searchQuery)}&limit=50`);
        result.total = result.count;
        result.offset = 0;
        result.samples = result.results;
    } else {
        result = await api(`/dataset/sample?count=${PAGE_SIZE}&offset=${offset}`);
    }

    datasetOffset = result.offset || 0;
    datasetLoaded = true;

    renderDatasetTable(result.samples || [], result.total);
    document.getElementById('page-info').textContent =
        searchQuery ? `${result.total} results` :
        `${offset + 1}–${Math.min(offset + PAGE_SIZE, result.total)} of ${result.total}`;

    document.getElementById('btn-prev').disabled = offset <= 0 || searchQuery;
    document.getElementById('btn-next').disabled = offset + PAGE_SIZE >= result.total || searchQuery;
}

function renderDatasetTable(samples, total) {
    const container = document.getElementById('dataset-table-container');
    if (!samples.length) {
        container.innerHTML = '<p style="color: var(--text-muted);">No results found.</p>';
        return;
    }

    let html = `<table class="dataset-table">
        <thead><tr>
            <th>#</th><th>Romanian</th><th>French</th><th>Italian</th>
            <th>Spanish</th><th>Portuguese</th><th>Latin</th>
        </tr></thead><tbody>`;

    samples.forEach((entry, i) => {
        const idx = datasetOffset + i;
        html += `<tr data-index="${idx}" onclick="reconstructFromDataset(${idx})">
            <td>${idx + 1}</td>
            <td class="${entry.romanian ? '' : 'missing'}">${entry.romanian || '—'}</td>
            <td class="${entry.french ? '' : 'missing'}">${entry.french || '—'}</td>
            <td class="${entry.italian ? '' : 'missing'}">${entry.italian || '—'}</td>
            <td class="${entry.spanish ? '' : 'missing'}">${entry.spanish || '—'}</td>
            <td class="${entry.portuguese ? '' : 'missing'}">${entry.portuguese || '—'}</td>
            <td class="latin-col">${entry.latin || '—'}</td>
        </tr>`;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

window.reconstructFromDataset = async function(index) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('[data-tab="reconstruct"]').classList.add('active');
    document.getElementById('tab-reconstruct').classList.add('active');

    const btn = document.getElementById('btn-reconstruct');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading"></span>Reconstructing...';

    try {
        const result = await apiPost('/reconstruct', { index });
        displayResults(result);
    } catch (e) {
        document.getElementById('results').style.display = 'block';
        document.getElementById('results').innerHTML = `<div class="error-message">Error: ${e.message}</div>`;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Reconstruct Proto-Form';
    }
};

document.getElementById('btn-prev').addEventListener('click', () => {
    datasetOffset = Math.max(0, datasetOffset - PAGE_SIZE);
    loadDataset(datasetOffset);
});

document.getElementById('btn-next').addEventListener('click', () => {
    datasetOffset += PAGE_SIZE;
    loadDataset(datasetOffset);
});

document.getElementById('btn-search').addEventListener('click', () => {
    const q = document.getElementById('dataset-search').value.trim();
    if (q) loadDataset(0, q);
    else loadDataset(0);
});

document.getElementById('dataset-search').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-search').click();
});

let datingLoaded = false;

async function loadDatingData() {
    datingLoaded = true;

    const calResult = await api('/date/calibration');
    const calContainer = document.getElementById('calibration-points');
    let calHtml = '';
    for (const [name, data] of Object.entries(calResult.calibration)) {
        calHtml += `<div class="calibration-item">
            <span class="name">${name}</span>
            <span class="years">~${data.years.toLocaleString()} yrs (${data.range[0].toLocaleString()}–${data.range[1].toLocaleString()})</span>
        </div>`;
    }
    calContainer.innerHTML = calHtml;

    const curveResult = await api('/date/curve');
    drawRetentionCurve(curveResult.curve);
}

document.getElementById('btn-date-pct').addEventListener('click', async () => {
    const pct = parseFloat(document.getElementById('cognate-pct').value) / 100;
    const rate = parseFloat(document.getElementById('retention-rate').value);

    const result = await apiPost('/date', { cognate_pct: pct, retention_rate: rate });
    const container = document.getElementById('date-pct-result');

    if (result.estimated_years) {
        container.innerHTML = `
            <div class="years">~${result.estimated_years.toLocaleString()} years</div>
            <div class="label">Estimated time since divergence</div>
            <div class="label" style="margin-top: 8px; font-size: 0.8rem;">
                At ${(pct * 100).toFixed(0)}% shared cognates with retention rate ${rate}/millennium
            </div>
        `;
    } else {
        container.innerHTML = '<div class="error-message">Could not calculate. Percentage must be between 0 and 100 (exclusive).</div>';
    }
});

function drawRetentionCurve(curve) {
    const container = document.getElementById('retention-curve-chart');
    container.innerHTML = '';

    const width = 500;
    const height = 300;
    const margin = { top: 20, right: 30, bottom: 50, left: 60 };

    const svg = d3.select('#retention-curve-chart')
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet');

    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().domain([0, 10000]).range([0, innerW]);
    const y = d3.scaleLinear().domain([0, 1]).range([innerH, 0]);

    g.append('g')
        .attr('transform', `translate(0,${innerH})`)
        .call(d3.axisBottom(x).ticks(5).tickFormat(d => `${d / 1000}k`))
        .selectAll('text').style('fill', '#8b8fa3');
    g.selectAll('.domain, .tick line').style('stroke', '#2a2e3f');

    g.append('g')
        .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('.0%')))
        .selectAll('text').style('fill', '#8b8fa3');

    g.append('text')
        .attr('x', innerW / 2).attr('y', innerH + 40)
        .attr('text-anchor', 'middle').attr('fill', '#8b8fa3')
        .style('font-size', '12px').text('Years');

    g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -innerH / 2).attr('y', -45)
        .attr('text-anchor', 'middle').attr('fill', '#8b8fa3')
        .style('font-size', '12px').text('Cognate Retention %');

    const line = d3.line()
        .x(d => x(d.years))
        .y(d => y(d.cognate_pct))
        .curve(d3.curveMonotoneX);

    g.append('path')
        .datum(curve)
        .attr('fill', 'none')
        .attr('stroke', '#6c63ff')
        .attr('stroke-width', 2.5)
        .attr('d', line);

    const markers = [
        { years: 1750, label: 'Romance' },
        { years: 2500, label: 'Germanic' },
        { years: 6000, label: 'PIE' },
    ];

    markers.forEach(m => {
        const pct = 0.86 ** (2 * m.years / 1000);
        g.append('circle')
            .attr('cx', x(m.years)).attr('cy', y(pct))
            .attr('r', 4).attr('fill', '#00d4aa');
        g.append('text')
            .attr('x', x(m.years)).attr('y', y(pct) - 10)
            .attr('text-anchor', 'middle').attr('fill', '#00d4aa')
            .style('font-size', '10px').text(m.label);
    });
}

document.getElementById('btn-distance').addEventListener('click', async () => {
    const word1 = document.getElementById('dist-word1').value.trim();
    const word2 = document.getElementById('dist-word2').value.trim();

    if (!word1 || !word2) {
        alert('Enter both words');
        return;
    }

    const result = await apiPost('/ipa/distance', { word1, word2 });
    const container = document.getElementById('distance-result');
    container.style.display = 'block';

    if (result.error) {
        container.innerHTML = `<div class="error-message">${result.error}</div>`;
        return;
    }

    const div = result.divergence || {};
    container.innerHTML = `
        <h3 style="margin-bottom: 12px;">Results</h3>
        <div class="distance-metric">
            <span class="metric-name">Feature Edit Distance</span>
            <span class="metric-value">${result.feature_edit_distance.toFixed(4)}</span>
        </div>
        <div class="distance-metric">
            <span class="metric-name">Normalized Edit Distance</span>
            <span class="metric-value">${result.normalized_edit_distance.toFixed(4)}</span>
        </div>
        <div class="distance-metric">
            <span class="metric-name">Estimated Divergence</span>
            <span class="metric-value">~${(div.estimated_years || 0).toLocaleString()} years</span>
        </div>
        <div class="distance-metric">
            <span class="metric-name">Category</span>
            <span class="metric-value"><span class="category-badge ${getCategoryClass(div.category || '')}">${div.category || '—'}</span></span>
        </div>
    `;
});

window.pronounceIPA = function(text) {
    const clean = text.replace(/[*\[\]\/]/g, '');
    if (!clean) return;

    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(clean);
        utter.rate = 0.7;
        utter.pitch = 1.0;
        utter.lang = 'la';
        const voices = window.speechSynthesis.getVoices();
        const preferred = voices.find(v => v.lang.startsWith('it')) ||
                          voices.find(v => v.lang.startsWith('es')) ||
                          voices.find(v => v.lang.startsWith('la')) ||
                          voices.find(v => v.lang.startsWith('pt'));
        if (preferred) utter.voice = preferred;
        window.speechSynthesis.speak(utter);
    }
};

if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}
