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
    document.getElementById('root-label').value = 'Proto-Language';
    document.getElementById('results-panel').style.display = 'none';
});

document.getElementById('btn-load-demo').addEventListener('click', () => {
    const demos = [
        {
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
        {
            root: 'Proto-Romance',
            branches: [
                { label: 'Western', ipa: '', descendants: [
                    { label: 'French', ipa: 'm\u025b\u02d0r' },
                    { label: 'Spanish', ipa: 'madre' },
                    { label: 'Portuguese', ipa: 'm\u0250\u0303j' },
                ]},
                { label: 'Eastern', ipa: '', descendants: [
                    { label: 'Italian', ipa: 'madre' },
                    { label: 'Romanian', ipa: 'mam\u0259' },
                ]},
            ]
        },
        {
            root: 'Proto-Romance',
            branches: [
                { label: 'Western', ipa: '', descendants: [
                    { label: 'French', ipa: 'o' },
                    { label: 'Spanish', ipa: 'a\u0263wa' },
                    { label: 'Portuguese', ipa: 'a\u0261w\u0250' },
                ]},
                { label: 'Eastern', ipa: '', descendants: [
                    { label: 'Italian', ipa: 'akwa' },
                    { label: 'Romanian', ipa: 'ap\u0268' },
                ]},
            ]
        },
        {
            root: 'Proto-Romance',
            branches: [
                { label: 'Italo-Western', ipa: '', descendants: [
                    { label: 'French', ipa: 'n\u0265i' },
                    { label: 'Spanish', ipa: 'not\u0283e' },
                    { label: 'Italian', ipa: 'n\u0254tte' },
                ]},
                { label: 'Ibero-Romance', ipa: '', descendants: [
                    { label: 'Portuguese', ipa: 'nojt\u0283i' },
                ]},
            ]
        },
    ];
    const demo = demos[Math.floor(Math.random() * demos.length)];

    document.getElementById('root-label').value = demo.root;
    const container = document.getElementById('intermediates-container');
    container.innerHTML = '';
    branchCounter = 0;
    demo.branches.forEach(b => {
        addIntermediate(b.label, b.ipa, b.descendants);
    });
});

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
        const result = await apiPost('/reconstruct_tree', { tree });
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
    if (isDiagonal) return 'rgba(108, 99, 255, 0.15)';
    // Green for high similarity, red for low
    const r = Math.round(255 * (1 - value));
    const g = Math.round(200 * value);
    const b = Math.round(100 * value);
    return `rgba(${r}, ${g}, ${b}, 0.25)`;
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

    let html = '<table class="ages-table"><thead><tr><th>Node</th><th>IPA</th><th>Relative Age</th><th>Depth</th></tr></thead><tbody>';

    nodes.forEach(n => {
        const age = n.relative_age;
        const barWidth = Math.round(age * 100);
        const star = n.reconstructed ? '*' : '';
        html += `<tr>
            <td>${n.label}</td>
            <td class="mono-cell">${star}${n.ipa}</td>
            <td class="mono-cell">${age.toFixed(4)}</td>
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
    nodes.filter(d => d.data.relative_age !== undefined && d.data.relative_age > 0)
        .append('text')
        .attr('dy', '1.6em')
        .attr('x', d => d.children ? -14 : 14)
        .attr('text-anchor', d => d.children ? 'end' : 'start')
        .attr('class', 'node-age-tag')
        .text(d => `age: ${d.data.relative_age.toFixed(2)}`);
}

// ─── Init ───
initTree();
