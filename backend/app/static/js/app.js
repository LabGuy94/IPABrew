const API = '';

async function apiPost(endpoint, body) {
    const resp = await fetch(`${API}/api${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return resp.json();
}

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

document.getElementById('btn-clear').addEventListener('click', () => {
    initTree();
    lastTreePayload = null;
    document.getElementById('root-label').value = 'Proto-Language';
    document.getElementById('results-panel').style.display = 'none';
});

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
                alert(`Descendant "${desc.label}" is missing IPA input.`);
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
        displayResults(result);
    } catch (e) {
        const panel = document.getElementById('results-panel');
        panel.style.display = 'block';
        panel.innerHTML = `<div class="error-message">Error: ${e.message}</div>`;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Reconstruct';
    }
});

document.getElementById('method-select').addEventListener('change', async () => {
    if (!lastTreePayload || document.getElementById('results-panel').style.display === 'none') return;
    const method = document.getElementById('method-select').value;
    const btn = document.getElementById('btn-reconstruct');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading"></span>Reconstructing...';
    try {
        const result = await apiPost('/reconstruct_tree', { tree: lastTreePayload, method });
        displayResults(result);
    } catch (e) {
        const panel = document.getElementById('results-panel');
        panel.innerHTML = `<div class="error-message">Error: ${e.message}</div>`;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Reconstruct';
    }
});

// ─── Display Results ───

function displayResults(result) {
    const panel = document.getElementById('results-panel');
    panel.style.display = 'block';

    if (result.error) {
        document.getElementById('proto-form-display').textContent = '';
        document.getElementById('tree-container').innerHTML = `<div class="error-message">${result.error}</div>`;
        document.getElementById('similarity-matrix').innerHTML = '';
        document.getElementById('ages-display').innerHTML = '';
        return;
    }

    const tree = result.tree;

    // Show root proto-form
    const protoDisplay = document.getElementById('proto-form-display');
    protoDisplay.textContent = `*${tree.ipa}`;
    if (tree.reconstructed) {
        const tag = document.createElement('span');
        tag.className = 'reconstructed-indicator';
        tag.textContent = 'reconstructed';
        protoDisplay.appendChild(tag);
    }
    const methodSelect = document.getElementById('method-select');
    if (methodSelect) {
        const badge = document.createElement('span');
        badge.className = 'method-badge';
        badge.textContent = methodSelect.value === 'ml' ? 'ML' : 'Algorithm';
        protoDisplay.appendChild(badge);
    }

    // Draw tree with ages
    drawTree(tree);

    // Show similarity matrix
    if (result.similarity_matrix) displaySimilarityMatrix(result.similarity_matrix);

    // Show relative ages
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
    container.innerHTML = html;
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
