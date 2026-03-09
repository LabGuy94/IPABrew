const API = '';

async function apiPost(endpoint, body) {
    const resp = await fetch(`${API}/api${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return resp.json();
}

function showError(container, message) {
    container.innerHTML = '';
    const div = document.createElement('div');
    div.className = 'error-message';
    div.textContent = message;
    container.appendChild(div);
}

function showToast(message, type = 'error') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => {
        requestAnimationFrame(() => toast.classList.add('show'));
    });
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 350);
    }, 3500);
}

function showConfirmToast(message, onConfirm) {
    const container = document.getElementById('toast-container');
    const existing = container.querySelector('.toast-confirm');
    if (existing) { existing.classList.remove('show'); existing.remove(); }
    const toast = document.createElement('div');
    toast.className = 'toast toast-confirm show';
    const msg = document.createElement('span');
    msg.className = 'toast-confirm-msg';
    msg.textContent = message;
    const btnRow = document.createElement('span');
    btnRow.className = 'toast-confirm-actions';
    const btnYes = document.createElement('button');
    btnYes.className = 'toast-confirm-btn toast-confirm-yes';
    btnYes.textContent = 'Yes';
    const btnNo = document.createElement('button');
    btnNo.className = 'toast-confirm-btn toast-confirm-no';
    btnNo.textContent = 'Cancel';
    btnRow.appendChild(btnYes);
    btnRow.appendChild(btnNo);
    toast.appendChild(msg);
    toast.appendChild(btnRow);
    container.appendChild(toast);
    function dismiss() {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 350);
    }
    btnYes.addEventListener('click', () => { dismiss(); onConfirm(); });
    btnNo.addEventListener('click', dismiss);
}

let lastReconstructResult = null;

// ─── Tree Editor State ───

let branchCounter = 0;
let lastTreePayload = null;

function createDescendantHTML(lang = '', ipa = '') {
    const id = `desc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    return `
        <div class="te-descendant" data-id="${id}">
            <span class="te-badge desc-badge">Leaf</span>
            <input type="text" class="te-label-input te-desc-label" value="${lang}" placeholder="Language name">
            <input type="text" class="te-ipa-input te-desc-ipa" value="${ipa}" placeholder="IPA (required)">
            <button type="button" class="ipa-field-toggle" title="IPA Keyboard">⌨</button>
            <button class="btn-remove" title="Remove descendant">&times;</button>
        </div>
    `;
}

function createIntermediateHTML(label = '', ipa = '', descendants = []) {
    branchCounter++;
    const branchId = `branch-${branchCounter}`;
    const descLabel = label || `Branch ${branchCounter}`;

    let descHTML = '';
    if (descendants.length > 0) {
        descendants.forEach(d => {
            descHTML += createDescendantHTML(d.label || '', d.ipa || '');
        });
    } else {
        descHTML += createDescendantHTML();
        descHTML += createDescendantHTML();
    }

    return `
        <div class="te-intermediate" data-branch="${branchId}">
            <div class="te-node-header intermediate-header">
                <span class="te-badge inter-badge">Branch</span>
                <input type="text" class="te-label-input te-inter-label" value="${descLabel}" placeholder="Branch label">
                <input type="text" class="te-ipa-input te-inter-ipa" value="${ipa}" placeholder="IPA (optional, leave empty to reconstruct)">
                <button type="button" class="ipa-field-toggle" title="IPA Keyboard">⌨</button>
                <button class="btn-remove btn-remove-branch" title="Remove branch">&times;</button>
            </div>
            <div class="te-descendants">
                ${descHTML}
            </div>
            <button class="btn btn-add-desc">+ Add Descendant</button>
        </div>
    `;
}

function addIntermediate(label = '', ipa = '', descendants = []) {
    const container = document.getElementById('intermediates-container');
    container.insertAdjacentHTML('beforeend', createIntermediateHTML(label, ipa, descendants));
    bindEditorEvents();
}

function bindEditorEvents() {
    document.querySelectorAll('.te-descendant .btn-remove').forEach(btn => {
        btn.onclick = () => {
            const branch = btn.closest('.te-intermediate');
            const descs = branch.querySelectorAll('.te-descendant');
            if (descs.length > 1) {
                btn.closest('.te-descendant').remove();
            }
        };
    });

    document.querySelectorAll('.btn-remove-branch').forEach(btn => {
        btn.onclick = () => {
            const branches = document.querySelectorAll('.te-intermediate');
            if (branches.length > 1) {
                btn.closest('.te-intermediate').remove();
            }
        };
    });

    document.querySelectorAll('.btn-add-desc').forEach(btn => {
        btn.onclick = () => {
            const descContainer = btn.previousElementSibling;
            descContainer.insertAdjacentHTML('beforeend', createDescendantHTML());
            bindEditorEvents();
        };
    });
}

function initTree() {
    const container = document.getElementById('intermediates-container');
    container.innerHTML = '';
    branchCounter = 0;
    addIntermediate('Western Romance', '', [
        { label: 'French', ipa: '' },
        { label: 'Spanish', ipa: '' },
    ]);
    addIntermediate('Eastern Romance', '', [
        { label: 'Italian', ipa: '' },
        { label: 'Romanian', ipa: '' },
    ]);
}

document.getElementById('btn-add-intermediate').addEventListener('click', () => {
    addIntermediate();
});

(function() {
    const btn = document.getElementById('btn-clear');
    let armed = false;
    let timer = null;
    btn.addEventListener('click', () => {
        if (!armed) {
            armed = true;
            btn.textContent = 'Sure?';
            btn.classList.add('btn-confirm-armed');
            timer = setTimeout(() => {
                armed = false;
                btn.textContent = 'Clear';
                btn.classList.remove('btn-confirm-armed');
            }, 2000);
        } else {
            clearTimeout(timer);
            armed = false;
            btn.textContent = 'Clear';
            btn.classList.remove('btn-confirm-armed');
            initTree();
            lastTreePayload = null;
            lastReconstructResult = null;
            document.getElementById('root-label').value = 'Proto-Language';
            document.getElementById('results-panel').style.display = 'none';
            document.querySelector('.app-layout').classList.remove('has-results');
        }
    });
})();

// ─── Demo Data ───

const DEMOS = {
    'Romance': [
        {
            name: '"rod" (virga)',
            root: 'Proto-Romance',
            branches: [
                { label: 'Western', ipa: '', descendants: [
                    { label: 'French', ipa: 'v\u025b\u0281\u0292' },
                    { label: 'Spanish', ipa: 'be\u027e\u0263a' },
                    { label: 'Portuguese', ipa: 'v\u025b\u027e\u0259\u0261\u0250' },
                ]},
                { label: 'Eastern', ipa: '', descendants: [
                    { label: 'Italian', ipa: 'ver\u0261a' },
                    { label: 'Romanian', ipa: 'var\u0261\u0259' },
                ]},
            ]
        },
        {
            name: '"whole" (integrum)',
            root: 'Proto-Romance',
            branches: [
                { label: 'Western', ipa: '', descendants: [
                    { label: 'French', ipa: '\u0251\u0303tje' },
                    { label: 'Spanish', ipa: 'inte\u0263\u027eo' },
                    { label: 'Portuguese', ipa: 'i\u014bt\u0268\u0261\u027e\u028a' },
                ]},
                { label: 'Eastern', ipa: '', descendants: [
                    { label: 'Italian', ipa: 'int\u025bro' },
                    { label: 'Romanian', ipa: 'inte\u0261ru' },
                ]},
            ]
        },
        {
            name: '"crumb" (mica)',
            root: 'Proto-Romance',
            branches: [
                { label: 'Western', ipa: '', descendants: [
                    { label: 'French', ipa: 'mi\u0283' },
                    { label: 'Spanish', ipa: 'mika' },
                    { label: 'Portuguese', ipa: 'mik\u0250' },
                ]},
                { label: 'Eastern', ipa: '', descendants: [
                    { label: 'Italian', ipa: 'mika' },
                    { label: 'Romanian', ipa: 'mik\u0259' },
                ]},
            ]
        },
        {
            name: '"father" (padre/p\u00e8re)',
            root: 'Proto-Romance',
            branches: [
                { label: 'Western', ipa: '', descendants: [
                    { label: 'French', ipa: 'p\u025b\u02d0r' },
                    { label: 'Spanish', ipa: 'padre' },
                    { label: 'Portuguese', ipa: 'paj' },
                ]},
                { label: 'Eastern', ipa: '', descendants: [
                    { label: 'Italian', ipa: 'padre' },
                    { label: 'Romanian', ipa: 'tat\u0259' },
                ]},
            ]
        },
    ],
    'Sinitic': [
        {
            name: '"plan" (\u8BA1 kej)',
            root: 'Proto-Sinitic',
            branches: [
                { label: 'Mandarin group', ipa: '', descendants: [
                    { label: 'Mandarin', ipa: 't\u0255i\u02e5\u02e9' },
                    { label: 'Jin', ipa: 't\u0255i\u02e6\u02e5' },
                ]},
                { label: 'Southern group', ipa: '', descendants: [
                    { label: 'Cantonese', ipa: 'k\u0250i\u032f\u02e7' },
                    { label: 'Hakka', ipa: 'ki\u02e5' },
                    { label: 'Hokkien', ipa: 'ke\u02e7\u02e9' },
                ]},
            ]
        },
        {
            name: '"joy" (\u559C xi)',
            root: 'Proto-Sinitic',
            branches: [
                { label: 'Mandarin group', ipa: '', descendants: [
                    { label: 'Mandarin', ipa: '\u0255i\u02e8\u02e9' },
                ]},
                { label: 'Southern group', ipa: '', descendants: [
                    { label: 'Cantonese', ipa: 'hei\u032f\u02e5' },
                    { label: 'Hakka', ipa: 'hi\u02e8\u02e6' },
                    { label: 'Hokkien', ipa: 'hi\u02e5\u02e9' },
                    { label: 'Wu', ipa: '\u0255i\u02e7\u02e6' },
                    { label: 'Xiang', ipa: '\u0255i\u02e6\u02e9' },
                ]},
            ]
        },
        {
            name: '"leak" (\u6F0F luw)',
            root: 'Proto-Sinitic',
            branches: [
                { label: 'Mandarin group', ipa: '', descendants: [
                    { label: 'Mandarin', ipa: 'lo\u028a\u032f\u02e5\u02e9' },
                    { label: 'Jin', ipa: 'l\u0259u\u032f\u02e6\u02e5' },
                ]},
                { label: 'Southern group', ipa: '', descendants: [
                    { label: 'Cantonese', ipa: 'l\u0250u\u032f\u02e8' },
                    { label: 'Hakka', ipa: 'le\u032fo\u02e5' },
                    { label: 'Hokkien', ipa: 'lau\u032f\u02e7' },
                    { label: 'Gan', ipa: 'l\u025b\u032fu\u02e9\u02e9' },
                ]},
            ]
        },
    ],
    'Burmish': [
        {
            name: '"road" (gja\u00b2)',
            root: 'Proto-Burmish',
            branches: [
                { label: 'Hill Burmish', ipa: '', descendants: [
                    { label: 'Atsi', ipa: 'kjo\u00b2\u00b9' },
                    { label: 'Lashi', ipa: 'kj\u0254\u02d0\u00b3\u00b3' },
                    { label: 'Maru', ipa: 'kj\u0254\u00b3\u2075' },
                    { label: 'Bola', ipa: 'kja\u00b3\u00b9' },
                ]},
                { label: 'Plains Burmish', ipa: '', descendants: [
                    { label: 'Achang', ipa: 't\u0255\u0254\u00b3\u00b9' },
                    { label: 'Rangoon', ipa: 't\u0255\u0251\u2075\u2075' },
                ]},
            ]
        },
        {
            name: '"road" (lam\u00b9)',
            root: 'Proto-Burmish',
            branches: [
                { label: 'Hill Burmish', ipa: '', descendants: [
                    { label: 'Atsi', ipa: 'lam\u2075\u00b9' },
                    { label: 'Lashi', ipa: 'lam\u00b3\u00b9' },
                    { label: 'Maru', ipa: 'l\u025b\u0303\u00b3\u00b9' },
                    { label: 'Bola', ipa: 'l\u025b\u0303\u2075\u2075' },
                ]},
                { label: 'Plains Burmish', ipa: '', descendants: [
                    { label: 'Achang', ipa: 'lam\u2075\u2075' },
                    { label: 'Rangoon', ipa: 'l\u0251\u0303\u00b2\u00b2' },
                ]},
            ]
        },
    ],
    'Karen': [
        {
            name: '"water" (kh\u02b0u)',
            root: 'Proto-Karen',
            branches: [
                { label: 'Northern', ipa: '', descendants: [
                    { label: 'Kayah', ipa: 'k\u02b0u\u2075\u2075' },
                    { label: 'Kayaw', ipa: 'k\u02b0u\u00b9\u00b9' },
                ]},
                { label: 'Southern', ipa: '', descendants: [
                    { label: 'Northern Pwo', ipa: 'k\u02b0u\u00b3\u00b3' },
                    { label: 'Western Bwe', ipa: 'k\u02b0u\u2075\u2075' },
                ]},
            ]
        },
        {
            name: '"drink" (j\u0268m)',
            root: 'Proto-Karen',
            branches: [
                { label: 'Northern', ipa: '', descendants: [
                    { label: 'Kayah', ipa: 'ji\u00b9\u00b9' },
                    { label: 'Kayan', ipa: '\u025f\u0268\u00b9\u00b9' },
                    { label: 'Kayaw', ipa: 'j\u0268\u00b9\u00b9' },
                ]},
                { label: 'Southern', ipa: '', descendants: [
                    { label: 'Northern Pao', ipa: 'jum\u2075\u00b3' },
                    { label: 'Southern Pao', ipa: 'j\u0259m\u2075\u2075' },
                ]},
            ]
        },
    ],
    'Aztecan': [
        {
            name: '"lip" (n\u0268n\u0268+p\u0268l)',
            root: 'Proto-Aztecan',
            branches: [
                { label: 'Central Nahuatl', ipa: '', descendants: [
                    { label: 'Classical Nahuatl', ipa: 'nene+pil+li' },
                    { label: 'North Puebla', ipa: 'nenepil' },
                    { label: 'Tetelcingo', ipa: 'nenepi\u02d0l' },
                ]},
                { label: 'Peripheral', ipa: '', descendants: [
                    { label: 'Pipil', ipa: 'nenepil' },
                    { label: 'Pochutec', ipa: 'nenepil' },
                ]},
            ]
        },
        {
            name: '"we" (t\u0259ha+m\u0268+t)',
            root: 'Proto-Aztecan',
            branches: [
                { label: 'Central Nahuatl', ipa: '', descendants: [
                    { label: 'Classical Nahuatl', ipa: 'te\u0294wa\u02d0n' },
                    { label: 'North Puebla', ipa: 'tehwan' },
                    { label: 'Tetelcingo', ipa: 'tehwa' },
                ]},
                { label: 'Peripheral', ipa: '', descendants: [
                    { label: 'Pipil', ipa: 'tehemet' },
                    { label: 'Mecayapan', ipa: 'tehameh' },
                    { label: 'Pochutec', ipa: 'twen' },
                ]},
            ]
        },
    ],
    'Purus': [
        {
            name: '"name" (nama)',
            root: 'Proto-Purus',
            branches: [
                { label: 'Northern', ipa: '', descendants: [
                    { label: 'Apurin\u00e3', ipa: 'nama' },
                ]},
                { label: 'Southern', ipa: '', descendants: [
                    { label: 'Inapari', ipa: 'nam\u00e1ti' },
                    { label: 'Yine', ipa: 'nama' },
                ]},
            ]
        },
        {
            name: '"bone" (kuna)',
            root: 'Proto-Purus',
            branches: [
                { label: 'Northern', ipa: '', descendants: [
                    { label: 'Apurin\u00e3', ipa: 'konak\u0268' },
                ]},
                { label: 'Southern', ipa: '', descendants: [
                    { label: 'Inapari', ipa: '\u00fana' },
                    { label: 'Yine', ipa: 'kona' },
                ]},
            ]
        },
    ],
};

function loadDemo(demo) {
    document.getElementById('root-label').value = demo.root;
    const container = document.getElementById('intermediates-container');
    container.innerHTML = '';
    branchCounter = 0;
    demo.branches.forEach(b => {
        addIntermediate(b.label, b.ipa, b.descendants);
    });
    // Close menu
    document.getElementById('demo-menu').style.display = 'none';
}

function buildDemoMenu() {
    const menu = document.getElementById('demo-menu');
    let html = '';
    for (const [family, demos] of Object.entries(DEMOS)) {
        html += `<div class="demo-group">`;
        html += `<div class="demo-group-label">${family}</div>`;
        demos.forEach((d, i) => {
            html += `<button class="demo-item" data-family="${family}" data-index="${i}">${d.name}</button>`;
        });
        html += `</div>`;
    }
    menu.innerHTML = html;
    menu.querySelectorAll('.demo-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const fam = btn.dataset.family;
            const idx = parseInt(btn.dataset.index);
            loadDemo(DEMOS[fam][idx]);
        });
    });
}

document.getElementById('btn-load-demo').addEventListener('click', (e) => {
    e.stopPropagation();
    const menu = document.getElementById('demo-menu');
    const visible = menu.style.display !== 'none';
    menu.style.display = visible ? 'none' : 'block';
});

// Close menu when clicking outside
document.addEventListener('click', (e) => {
    const wrap = document.querySelector('.demo-picker-wrap');
    if (wrap && !wrap.contains(e.target)) {
        document.getElementById('demo-menu').style.display = 'none';
    }
});

buildDemoMenu();

// ─── Build tree from editor ───

function buildTreeFromEditor() {
    const rootLabel = document.getElementById('root-label').value.trim() || 'Proto-Language';

    const branches = document.querySelectorAll('.te-intermediate');
    const children = [];

    for (const branch of branches) {
        const branchLabel = branch.querySelector('.te-inter-label').value.trim();
        const branchIpa = branch.querySelector('.te-inter-ipa').value.trim();

        const descs = branch.querySelectorAll('.te-descendant');
        const branchChildren = [];

        for (const desc of descs) {
            const descLabel = desc.querySelector('.te-desc-label').value.trim();
            const descIpa = desc.querySelector('.te-desc-ipa').value.trim();
            branchChildren.push({ label: descLabel || 'Unknown', ipa: descIpa });
        }

        children.push({
            label: branchLabel || 'Branch',
            ipa: branchIpa,
            children: branchChildren,
        });
    }

    return { label: rootLabel, children };
}

// ─── Reconstruct ───

document.getElementById('btn-reconstruct').addEventListener('click', async () => {
    const tree = buildTreeFromEditor();

    for (const branch of tree.children) {
        for (const desc of branch.children) {
            if (!desc.ipa) {
                showToast(`Descendant "${desc.label}" is missing IPA input.`);
                return;
            }
        }
    }

    const btn = document.getElementById('btn-reconstruct');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading"></span>Reconstructing...';

    try {
        const method = document.getElementById('method-select').value;
        lastTreePayload = tree;
        const result = await apiPost('/reconstruct_tree', { tree, method });
        displayResults(result, method);
    } catch (e) {
        const panel = document.getElementById('results-panel');
        const layout = document.querySelector('.app-layout');
        panel.style.display = 'block';
        panel.offsetHeight;
        layout.classList.add('has-results');
        showError(panel, 'Error: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Reconstruct';
    }
});

document.getElementById('method-select').addEventListener('change', async () => {
    if (!lastTreePayload || !document.querySelector('.app-layout').classList.contains('has-results')) return;
    const method = document.getElementById('method-select').value;
    const btn = document.getElementById('btn-reconstruct');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading"></span>Reconstructing...';
    try {
        const result = await apiPost('/reconstruct_tree', { tree: lastTreePayload, method });
        displayResults(result, method);
    } catch (e) {
        const panel = document.getElementById('results-panel');
        showError(panel, 'Error: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Reconstruct';
    }
});

// ─── Display Results ───

function displayResults(result, requestedMethod) {
    const panel = document.getElementById('results-panel');
    const layout = document.querySelector('.app-layout');
    if (!layout.classList.contains('has-results')) {
        panel.style.display = 'block';
        panel.offsetHeight;
        layout.classList.add('has-results');
    }

    const existingBanner = panel.querySelector('.method-fallback-banner');
    if (existingBanner) existingBanner.remove();

    if (result.error) {
        document.getElementById('proto-form-display').textContent = '';
        showError(document.getElementById('tree-container'), result.error);
        document.getElementById('similarity-matrix').innerHTML = '';
        document.getElementById('ages-display').innerHTML = '';
        lastReconstructResult = null;
        return;
    }

    lastReconstructResult = result;

    if (requestedMethod === 'ml' && result.method_used && result.method_used !== 'ml') {
        const banner = document.createElement('div');
        banner.className = 'method-fallback-banner';
        banner.textContent = 'ML model unavailable — used algorithmic reconstruction instead.';
        const methodSelector = panel.querySelector('.method-selector');
        methodSelector.insertAdjacentElement('afterend', banner);
    }

    const tree = result.tree;

    const protoDisplay = document.getElementById('proto-form-display');
    protoDisplay.textContent = `*${tree.ipa}`;
    if (tree.reconstructed) {
        const tag = document.createElement('span');
        tag.className = 'reconstructed-indicator';
        tag.textContent = 'reconstructed';
        protoDisplay.appendChild(tag);
    }
    const actualMethod = result.method_used || requestedMethod;
    const badge = document.createElement('span');
    badge.className = 'method-badge';
    badge.textContent = actualMethod === 'ml' ? 'ML' : 'Algorithm';
    protoDisplay.appendChild(badge);

    drawTree(tree);

    if (result.similarity_matrix) displaySimilarityMatrix(result.similarity_matrix);

    displayAges(tree);
}

// ─── Similarity Matrix ───

function displaySimilarityMatrix(matrix) {
    const container = document.getElementById('similarity-matrix');
    const { labels, values } = matrix;
    const n = labels.length;

    if (n < 2) {
        container.innerHTML = '<p class="help-text">Need at least 2 leaves for a matrix.</p>';
        return;
    }

    let html = '<table class="sim-matrix"><thead><tr><th></th>';
    labels.forEach(l => { html += `<th>${l}</th>`; });
    html += '</tr></thead><tbody>';

    for (let i = 0; i < n; i++) {
        html += `<tr><td class="sim-row-label">${labels[i]}</td>`;
        for (let j = 0; j < n; j++) {
            const val = values[i][j];
            const display = val !== null ? val.toFixed(3) : '\u2014';
            const intensity = val !== null ? val : 0;
            const bg = simColor(intensity, i === j);
            html += `<td class="sim-cell" style="background:${bg}">${display}</td>`;
        }
        html += '</tr>';
    }

    html += '</tbody></table>';
    container.innerHTML = '<div class="sim-matrix-wrap">' + html + '</div>';
}

function simColor(value, isDiagonal) {
    if (isDiagonal) return 'rgba(107, 76, 42, 0.08)';
    // Warm brown for low similarity, muted green for high
    const r = Math.round(160 - 86 * value);
    const g = Math.round(80 + 43 * value);
    const b = Math.round(48 + 17 * value);
    return `rgba(${r}, ${g}, ${b}, ${0.1 + value * 0.15})`;
}

// ─── Relative Ages Table ───

function displayAges(tree) {
    const container = document.getElementById('ages-display');
    const nodes = [];
    collectInternalNodes(tree, nodes);

    if (nodes.length === 0) {
        container.innerHTML = '<p class="help-text">No internal nodes to display.</p>';
        return;
    }

    // Find max age for bar scaling
    const maxAge = Math.max(...nodes.map(n => n.estimated_age_years || 0), 1);

    let html = '<table class="ages-table"><thead><tr><th>Node</th><th>IPA</th><th>Est. Age</th><th>Depth</th></tr></thead><tbody>';

    nodes.forEach(n => {
        const years = n.estimated_age_years || 0;
        const barWidth = Math.round((years / maxAge) * 100);
        const star = n.reconstructed ? '*' : '';
        html += `<tr>
            <td>${n.label}</td>
            <td class="mono-cell">${star}${n.ipa}</td>
            <td class="mono-cell">~${years.toLocaleString()} yrs</td>
            <td><div class="age-bar-bg"><div class="age-bar" style="width:${barWidth}%"></div></div></td>
        </tr>`;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

function collectInternalNodes(node, result) {
    if (node.children && node.children.length > 0) {
        result.push(node);
        node.children.forEach(c => collectInternalNodes(c, result));
    }
}

// ─── D3 Tree Visualization ───

function drawTree(treeData) {
    const container = document.getElementById('tree-container');
    container.innerHTML = '';

    const root = d3.hierarchy(treeData, d => d.children);
    const nodeCount = root.descendants().length;

    const width = Math.max(600, container.clientWidth || 600);
    const height = Math.max(350, nodeCount * 55);
    const margin = { top: 30, right: 220, bottom: 30, left: 50 };

    const svg = d3.select('#tree-container')
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const treeLayout = d3.tree().size([innerH, innerW]);
    treeLayout(root);

    // Links
    g.selectAll('.tree-link')
        .data(root.links())
        .enter()
        .append('path')
        .attr('class', 'tree-link')
        .attr('d', d3.linkHorizontal().x(d => d.y).y(d => d.x))
        .style('opacity', 0)
        .transition().duration(600).delay((d, i) => i * 100)
        .style('opacity', 1);

    // Nodes
    const nodes = g.selectAll('.tree-node')
        .data(root.descendants())
        .enter()
        .append('g')
        .attr('class', d => `tree-node ${d.data.type || ''}`)
        .attr('transform', d => `translate(${d.y},${d.x})`)
        .style('opacity', 0);

    nodes.transition().duration(600).delay((d, i) => i * 100)
        .style('opacity', 1);

    nodes.append('circle')
        .attr('r', d => {
            if (d.data.type === 'root') return 8;
            if (d.data.type === 'intermediate') return 6;
            return 5;
        });

    // Label: name + ipa
    nodes.append('text')
        .attr('dy', '0.35em')
        .attr('x', d => d.children ? -14 : 14)
        .attr('text-anchor', d => d.children ? 'end' : 'start')
        .attr('class', 'node-label')
        .text(d => {
            const label = d.data.label || '';
            const ipa = d.data.ipa || '';
            const star = d.data.reconstructed ? '*' : '';
            return `${label}: ${star}${ipa}`;
        });

    // Age label for internal nodes
    nodes.filter(d => d.data.estimated_age_years !== undefined && d.data.estimated_age_years > 0)
        .append('text')
        .attr('dy', '1.6em')
        .attr('x', d => d.children ? -14 : 14)
        .attr('text-anchor', d => d.children ? 'end' : 'start')
        .attr('class', 'node-age-tag')
        .text(d => `~${d.data.estimated_age_years.toLocaleString()} yrs`);
}

// ─── Init ───
initTree();

// ─── IPA Keyboard ───

const IPA_SYMBOLS = {
    consonants: {
        common: [
            { label: 'Plosives', symbols: [
                ['p', 'voiceless bilabial plosive'], ['b', 'voiced bilabial plosive'],
                ['t', 'voiceless alveolar plosive'], ['d', 'voiced alveolar plosive'],
                ['\u0288', 'voiceless retroflex plosive'], ['\u0256', 'voiced retroflex plosive'],
                ['c', 'voiceless palatal plosive'], ['\u025F', 'voiced palatal plosive'],
                ['k', 'voiceless velar plosive'], ['\u0261', 'voiced velar plosive'],
                ['q', 'voiceless uvular plosive'], ['\u0262', 'voiced uvular plosive'],
                ['\u0294', 'glottal stop'],
            ]},
            { label: 'Nasals', symbols: [
                ['m', 'bilabial nasal'], ['\u0271', 'labiodental nasal'],
                ['n', 'alveolar nasal'], ['\u0273', 'retroflex nasal'],
                ['\u0272', 'palatal nasal'], ['\u014B', 'velar nasal'],
                ['\u0274', 'uvular nasal'],
            ]},
            { label: 'Fricatives', symbols: [
                ['\u0278', 'voiceless bilabial fricative'], ['\u03B2', 'voiced bilabial fricative'],
                ['f', 'voiceless labiodental fricative'], ['v', 'voiced labiodental fricative'],
                ['\u03B8', 'voiceless dental fricative'], ['\u00F0', 'voiced dental fricative'],
                ['s', 'voiceless alveolar fricative'], ['z', 'voiced alveolar fricative'],
                ['\u0283', 'voiceless postalveolar fricative'], ['\u0292', 'voiced postalveolar fricative'],
                ['\u0282', 'voiceless retroflex fricative'], ['\u0290', 'voiced retroflex fricative'],
                ['\u00E7', 'voiceless palatal fricative'], ['\u029D', 'voiced palatal fricative'],
                ['x', 'voiceless velar fricative'], ['\u0263', 'voiced velar fricative'],
                ['\u03C7', 'voiceless uvular fricative'], ['\u0281', 'voiced uvular fricative'],
                ['h', 'voiceless glottal fricative'], ['\u0266', 'voiced glottal fricative'],
            ]},
            { label: 'Approximants', symbols: [
                ['\u028B', 'labiodental approximant'],
                ['\u0279', 'alveolar approximant'],
                ['j', 'palatal approximant'], ['w', 'labial-velar approximant'],
                ['\u0270', 'velar approximant'],
            ]},
            { label: 'Laterals & Rhotics', symbols: [
                ['l', 'alveolar lateral'], ['\u026D', 'retroflex lateral'],
                ['\u028E', 'palatal lateral'], ['\u029F', 'velar lateral'],
                ['r', 'alveolar trill'], ['\u0280', 'uvular trill'],
                ['\u027E', 'alveolar tap'], ['\u027D', 'retroflex flap'],
            ]},
        ],
        extended: [
            { label: 'Implosives', symbols: [
                ['\u0253', 'bilabial implosive'], ['\u0257', 'alveolar implosive'],
                ['\u0284', 'palatal implosive'], ['\u0260', 'velar implosive'],
                ['\u029B', 'uvular implosive'],
            ]},
            { label: 'Clicks', symbols: [
                ['\u0298', 'bilabial click'], ['\u01C0', 'dental click'],
                ['\u01C3', 'postalveolar click'], ['\u01C1', 'lateral click'],
                ['\u01C2', 'palatoalveolar click'],
            ]},
            { label: 'Co-articulated', symbols: [
                ['\u0265', 'labial-palatal approximant'],
                ['\u029C', 'voiceless epiglottal fricative'],
                ['\u02A1', 'epiglottal plosive'], ['\u02A2', 'voiced epiglottal fricative'],
            ]},
        ],
    },
    vowels: {
        common: [
            { label: 'Close', symbols: [
                ['i', 'close front unrounded'], ['y', 'close front rounded'],
                ['\u0268', 'close central unrounded'], ['\u0289', 'close central rounded'],
                ['\u026F', 'close back unrounded'], ['u', 'close back rounded'],
            ]},
            { label: 'Near-close', symbols: [
                ['\u026A', 'near-close front unrounded'], ['\u028F', 'near-close front rounded'],
                ['\u028A', 'near-close back rounded'],
            ]},
            { label: 'Close-mid', symbols: [
                ['e', 'close-mid front unrounded'], ['\u00F8', 'close-mid front rounded'],
                ['\u0258', 'close-mid central unrounded'], ['\u0275', 'close-mid central rounded'],
                ['\u0264', 'close-mid back unrounded'], ['o', 'close-mid back rounded'],
            ]},
            { label: 'Mid', symbols: [
                ['\u0259', 'mid central (schwa)'],
            ]},
            { label: 'Open-mid', symbols: [
                ['\u025B', 'open-mid front unrounded'], ['\u0153', 'open-mid front rounded'],
                ['\u025C', 'open-mid central unrounded'], ['\u025E', 'open-mid central rounded'],
                ['\u028C', 'open-mid back unrounded'], ['\u0254', 'open-mid back rounded'],
            ]},
            { label: 'Near-open', symbols: [
                ['\u00E6', 'near-open front unrounded'],
                ['\u0250', 'near-open central'],
            ]},
            { label: 'Open', symbols: [
                ['a', 'open front unrounded'], ['\u0276', 'open front rounded'],
                ['\u0251', 'open back unrounded'], ['\u0252', 'open back rounded'],
            ]},
        ],
        extended: [
            { label: 'Nasalized vowels', symbols: [
                ['\u00E3', 'nasalized a'], ['\u1EBD', 'nasalized e'],
                ['\u0129', 'nasalized i'], ['\u00F5', 'nasalized o'],
                ['\u0169', 'nasalized u'],
            ]},
        ],
    },
    diacritics: {
        common: [
            { label: 'Length', symbols: [
                ['\u02D0', 'long'], ['\u02D1', 'half-long'],
            ]},
            { label: 'Nasalization & Voicing', symbols: [
                ['\u0303', 'nasalized (combining)'], ['\u0325', 'voiceless (combining)'],
                ['\u032C', 'voiced (combining)'],
            ]},
            { label: 'Aspiration & Release', symbols: [
                ['\u02B0', 'aspirated'], ['\u02BC', 'ejective'],
                ['\u031A', 'no audible release'],
            ]},
            { label: 'Syllabicity', symbols: [
                ['\u0329', 'syllabic (combining)'], ['\u032F', 'non-syllabic (combining)'],
            ]},
            { label: 'Place modifiers', symbols: [
                ['\u02B7', 'labialized'], ['\u02B2', 'palatalized'],
                ['\u02E0', 'velarized'], ['\u02E4', 'pharyngealized'],
                ['\u0334', 'velarized/pharyngealized (combining)'],
            ]},
        ],
        extended: [
            { label: 'Tongue root', symbols: [
                ['\u0318', 'ATR (combining)'], ['\u0319', 'RTR (combining)'],
            ]},
            { label: 'Other modifiers', symbols: [
                ['\u031F', 'advanced (combining)'], ['\u0320', 'retracted (combining)'],
                ['\u0308', 'centralized (combining)'], ['\u033D', 'mid-centralized (combining)'],
                ['\u031D', 'raised (combining)'], ['\u031E', 'lowered (combining)'],
                ['\u032A', 'dental (combining)'], ['\u033A', 'apical (combining)'],
                ['\u033B', 'laminal (combining)'], ['\u0339', 'more rounded (combining)'],
                ['\u031C', 'less rounded (combining)'],
                ['\u0324', 'breathy voiced (combining)'], ['\u0330', 'creaky voiced (combining)'],
            ]},
        ],
    },
    tones: {
        common: [
            { label: 'Tone letters', symbols: [
                ['\u02E5', 'extra high'], ['\u02E6', 'high'], ['\u02E7', 'mid'],
                ['\u02E8', 'low'], ['\u02E9', 'extra low'],
            ]},
            { label: 'Contour examples', symbols: [
                ['\u02E7\u02E5', 'rising'], ['\u02E5\u02E9', 'falling'],
                ['\u02E9\u02E7', 'low rising'], ['\u02E7\u02E9', 'mid falling'],
            ]},
            { label: 'Diacritic tones', symbols: [
                ['\u0301', 'high tone (combining)'], ['\u0300', 'low tone (combining)'],
                ['\u0302', 'falling tone (combining)'], ['\u030C', 'rising tone (combining)'],
                ['\u0304', 'mid tone (combining)'],
            ]},
        ],
        extended: [
            { label: 'Numbered tones', symbols: [
                ['\u00B9', 'superscript 1'], ['\u00B2', 'superscript 2'],
                ['\u00B3', 'superscript 3'], ['\u2074', 'superscript 4'],
                ['\u2075', 'superscript 5'],
            ]},
        ],
    },
    suprasegmentals: {
        common: [
            { label: 'Stress & Breaks', symbols: [
                ['\u02C8', 'primary stress'], ['\u02CC', 'secondary stress'],
                ['.', 'syllable break'], ['|', 'minor break'],
                ['\u2016', 'major break'],
            ]},
            { label: 'Linking', symbols: [
                ['\u203F', 'linking (tie bar)'],
                ['\u0361', 'tie bar above (combining)'],
            ]},
        ],
        extended: [
            { label: 'Intonation', symbols: [
                ['\u2197', 'global rise'], ['\u2198', 'global fall'],
                ['\u2193', 'downstep'], ['\u2191', 'upstep'],
            ]},
        ],
    },
};

let ipaActiveInput = null;

function openIPAKeyboard(targetInput) {
    ipaActiveInput = targetInput;
    const kb = document.getElementById('ipa-keyboard');
    kb.style.display = 'block';
    // Force reflow before adding class so transition fires
    kb.offsetHeight;
    kb.classList.add('open');
    document.body.classList.add('ipa-kb-open');
    renderIPATab();
    updateFieldToggleStates();
    targetInput.focus();
}

function closeIPAKeyboard() {
    const kb = document.getElementById('ipa-keyboard');
    kb.classList.remove('open');
    document.body.classList.remove('ipa-kb-open');
    kb.addEventListener('transitionend', () => {
        if (!kb.classList.contains('open')) kb.style.display = 'none';
    }, { once: true });
    ipaActiveInput = null;
    updateFieldToggleStates();
}

function toggleIPAKeyboard(targetInput) {
    const kb = document.getElementById('ipa-keyboard');
    if (kb.classList.contains('open')) {
        if (targetInput && targetInput !== ipaActiveInput) {
            // Switch target, keep open
            ipaActiveInput = targetInput;
            updateFieldToggleStates();
            targetInput.focus();
        } else {
            closeIPAKeyboard();
        }
    } else {
        openIPAKeyboard(targetInput || document.querySelector('.te-ipa-input'));
    }
}

function updateFieldToggleStates() {
    document.querySelectorAll('.ipa-field-toggle').forEach(btn => {
        const ipaInput = btn.previousElementSibling;
        btn.classList.toggle('active', ipaInput === ipaActiveInput);
    });
    const globalBtn = document.getElementById('btn-ipa-keyboard');
    globalBtn.classList.toggle('active',
        document.getElementById('ipa-keyboard').classList.contains('open'));
}

function getActiveTab() {
    const active = document.querySelector('.ipa-kb-tab.active');
    return active ? active.dataset.tab : 'consonants';
}

function renderIPATab() {
    const tab = getActiveTab();
    const showAll = document.getElementById('ipa-kb-show-all').checked;
    const data = IPA_SYMBOLS[tab];
    if (!data) return;

    const body = document.getElementById('ipa-kb-body');
    let html = '<div class="ipa-kb-grid">';

    const sections = showAll ? [...data.common, ...(data.extended || [])] : data.common;

    for (const section of sections) {
        html += `<div class="ipa-kb-section-label">${section.label}</div>`;
        for (const [sym, desc] of section.symbols) {
            html += `<button type="button" class="ipa-kb-key" data-char="${sym}" title="${desc}">${sym}</button>`;
        }
    }

    html += '</div>';
    body.innerHTML = html;
}

function insertAtCursor(input, text) {
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const before = input.value.substring(0, start);
    const after = input.value.substring(end);
    input.value = before + text + after;
    const pos = start + text.length;
    input.setSelectionRange(pos, pos);
    input.focus();
}

// Tab switching
document.querySelector('.ipa-kb-tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.ipa-kb-tab');
    if (!tab) return;
    document.querySelectorAll('.ipa-kb-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    renderIPATab();
});

document.getElementById('ipa-kb-body').addEventListener('click', (e) => {
    const key = e.target.closest('.ipa-kb-key');
    if (!key || !ipaActiveInput) return;

    insertAtCursor(ipaActiveInput, key.dataset.char);
});

// Show all toggle
document.getElementById('ipa-kb-show-all').addEventListener('change', renderIPATab);

// Close button
document.getElementById('ipa-kb-close').addEventListener('click', closeIPAKeyboard);

// Global toggle button
document.getElementById('btn-ipa-keyboard').addEventListener('click', () => {
    toggleIPAKeyboard();
});

// Per-field toggle buttons (delegated from tree editor)
document.querySelector('.tree-editor').addEventListener('click', (e) => {
    const toggle = e.target.closest('.ipa-field-toggle');
    if (!toggle) return;
    const ipaInput = toggle.previousElementSibling;
    if (ipaInput && ipaInput.classList.contains('te-ipa-input')) {
        toggleIPAKeyboard(ipaInput);
    }
});

// Track focus on IPA inputs to update active target
document.querySelector('.tree-editor').addEventListener('focusin', (e) => {
    if (e.target.classList.contains('te-ipa-input') &&
        document.getElementById('ipa-keyboard').classList.contains('open')) {
        ipaActiveInput = e.target;
        updateFieldToggleStates();
    }
});

// ─── Export ───

function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

document.getElementById('btn-export-svg').addEventListener('click', () => {
    const svg = document.querySelector('#tree-container svg');
    if (!svg) {
        showToast('No tree to export. Run a reconstruction first.', 'info');
        return;
    }
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const styles = document.createElement('style');
    styles.textContent = `
        .tree-link { fill: none; stroke: #8a7e6f; stroke-width: 1.5; }
        .node-label { font-family: Georgia, serif; font-size: 12px; fill: #3b3228; }
        .node-age-tag { font-family: Georgia, serif; font-size: 10px; fill: #8a7e6f; }
        .root circle { fill: #8b5e3c; }
        .intermediate circle { fill: #5b6e8a; }
        circle { fill: #4a6741; }
    `;
    clone.insertBefore(styles, clone.firstChild);
    const serializer = new XMLSerializer();
    const svgStr = '<?xml version="1.0" encoding="UTF-8"?>\n' + serializer.serializeToString(clone);
    downloadFile('ipabrew-tree.svg', svgStr, 'image/svg+xml');
});

document.getElementById('btn-export-json').addEventListener('click', () => {
    if (!lastReconstructResult) {
        showToast('No results to export. Run a reconstruction first.', 'info');
        return;
    }
    const json = JSON.stringify(lastReconstructResult, null, 2);
    downloadFile('ipabrew-results.json', json, 'application/json');
});
