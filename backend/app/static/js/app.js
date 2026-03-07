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
    // Remove descendant buttons
    document.querySelectorAll('.te-descendant .btn-remove').forEach(btn => {
        btn.onclick = () => {
            const branch = btn.closest('.te-intermediate');
            const descs = branch.querySelectorAll('.te-descendant');
            if (descs.length > 1) {
                btn.closest('.te-descendant').remove();
            }
        };
    });

    // Remove branch buttons
    document.querySelectorAll('.btn-remove-branch').forEach(btn => {
        btn.onclick = () => {
            const branches = document.querySelectorAll('.te-intermediate');
            if (branches.length > 1) {
                btn.closest('.te-intermediate').remove();
            }
        };
    });

    // Add descendant buttons
    document.querySelectorAll('.btn-add-desc').forEach(btn => {
        btn.onclick = () => {
            const descContainer = btn.previousElementSibling;
            descContainer.insertAdjacentHTML('beforeend', createDescendantHTML());
            bindEditorEvents();
        };
    });
}

// Initialize with 2 branches, 2 descendants each
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
                    { label: 'French', ipa: 'pɛːr' },
                    { label: 'Spanish', ipa: 'padre' },
                    { label: 'Portuguese', ipa: 'paj' },
                ]},
                { label: 'Eastern', ipa: '', descendants: [
                    { label: 'Italian', ipa: 'padre' },
                    { label: 'Romanian', ipa: 'tatə' },
                ]},
            ]
        },
        {
            root: 'Proto-Romance',
            branches: [
                { label: 'Western', ipa: '', descendants: [
                    { label: 'French', ipa: 'mɛːr' },
                    { label: 'Spanish', ipa: 'madre' },
                    { label: 'Portuguese', ipa: 'mɐ̃j' },
                ]},
                { label: 'Eastern', ipa: '', descendants: [
                    { label: 'Italian', ipa: 'madre' },
                    { label: 'Romanian', ipa: 'mamə' },
                ]},
            ]
        },
        {
            root: 'Proto-Romance',
            branches: [
                { label: 'Western', ipa: '', descendants: [
                    { label: 'French', ipa: 'o' },
                    { label: 'Spanish', ipa: 'aɣwa' },
                    { label: 'Portuguese', ipa: 'aɡwɐ' },
                ]},
                { label: 'Eastern', ipa: '', descendants: [
                    { label: 'Italian', ipa: 'akwa' },
                    { label: 'Romanian', ipa: 'apɨ' },
                ]},
            ]
        },
        {
            root: 'Proto-Romance',
            branches: [
                { label: 'Italo-Western', ipa: '', descendants: [
                    { label: 'French', ipa: 'nɥi' },
                    { label: 'Spanish', ipa: 'notʃe' },
                    { label: 'Italian', ipa: 'nɔtte' },
                ]},
                { label: 'Ibero-Romance', ipa: '', descendants: [
                    { label: 'Portuguese', ipa: 'nojtʃi' },
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

    // Validate: every descendant must have ipa
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
        document.getElementById('distances-display').innerHTML = '';
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

    // Draw tree
    drawTree(tree);

    // Show distances
    if (result.distances) displayDistances(result.distances);
}

function displayDistances(distances) {
    const container = document.getElementById('distances-display');
    if (!distances || distances.length === 0) {
        container.innerHTML = '<p class="help-text">No pairwise distances available.</p>';
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
        const cat = d.divergence ? d.divergence.category : '\u2014';
        const years = d.divergence ? `~${d.divergence.estimated_years.toLocaleString()}` : '\u2014';
        const ned = d.normalized_edit_distance !== null ? d.normalized_edit_distance.toFixed(3) : '\u2014';
        const badgeClass = getCategoryClass(cat);
        html += `<tr>
            <td>${d.lang1} \u2014 ${d.lang2}</td>
            <td class="mono-cell">${d.word1} / ${d.word2}</td>
            <td class="mono-cell">${ned}</td>
            <td class="mono-cell">${years}</td>
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

// ─── D3 Tree Visualization ───

function drawTree(treeData) {
    const container = document.getElementById('tree-container');
    container.innerHTML = '';

    // Convert to d3 hierarchy format
    const root = d3.hierarchy(treeData, d => d.children);
    const nodeCount = root.descendants().length;

    const width = Math.max(600, container.clientWidth || 600);
    const height = Math.max(350, nodeCount * 50);
    const margin = { top: 30, right: 200, bottom: 30, left: 50 };

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

    // Reconstructed indicator
    nodes.filter(d => d.data.reconstructed)
        .append('text')
        .attr('dy', '1.8em')
        .attr('x', d => d.children ? -14 : 14)
        .attr('text-anchor', d => d.children ? 'end' : 'start')
        .attr('class', 'node-reconstructed-tag')
        .text('(reconstructed)');
}

// ─── Init ───
initTree();
