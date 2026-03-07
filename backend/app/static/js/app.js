// IPABier — Frontend
(function () {
    "use strict";

    // ── State ──
    const state = {
        cognates: [],     // [{ id, language, word }]
        treeData: null,   // D3 hierarchy data
        selectedNode: null,
        nextId: 1,
    };

    // ── DOM refs ──
    const $ = (s) => document.querySelector(s);
    const statusDot = $(".status-dot");
    const statusText = $("#status-text");
    const cognateList = $("#cognate-list");
    const inputLang = $("#input-language");
    const inputWord = $("#input-word");
    const btnAdd = $("#btn-add-word");
    const btnReconstruct = $("#btn-reconstruct");
    const btnDemo = $("#btn-demo");
    const treeContainer = $("#tree-container");
    const treeEmpty = $("#tree-empty");
    const detailPanel = $("#detail-panel");

    // ── Health check ──
    async function checkHealth() {
        try {
            const res = await fetch("/api/health");
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            statusText.textContent = `Backend: ${data.status}`;
            statusDot.classList.add("connected");
        } catch (err) {
            statusText.textContent = `Disconnected`;
            statusDot.classList.add("error");
        }
    }

    // ── Cognate management ──
    function addCognate(language, word) {
        if (!language.trim() || !word.trim()) return;
        state.cognates.push({ id: state.nextId++, language: language.trim(), word: word.trim() });
        renderCognates();
    }

    function removeCognate(id) {
        state.cognates = state.cognates.filter((c) => c.id !== id);
        renderCognates();
    }

    function renderCognates() {
        cognateList.innerHTML = "";
        if (state.cognates.length === 0) {
            cognateList.innerHTML = `<div class="text-center text-gray-600 text-xs py-6">No words added yet.</div>`;
            return;
        }
        state.cognates.forEach((c) => {
            const el = document.createElement("div");
            el.className = "cognate-entry";
            el.innerHTML = `
                <span class="lang-badge">${esc(c.language)}</span>
                <span class="word-text">${esc(c.word)}</span>
                <button class="btn-remove" data-id="${c.id}" title="Remove">&times;</button>
            `;
            el.querySelector(".btn-remove").addEventListener("click", () => removeCognate(c.id));
            cognateList.appendChild(el);
        });
        cognateList.scrollTop = cognateList.scrollHeight;
    }

    function esc(s) {
        const d = document.createElement("div");
        d.textContent = s;
        return d.innerHTML;
    }

    // ── Demo data ──
    const DEMO_COGNATES = [
        { language: "Latin", word: "pater" },
        { language: "Greek", word: "patḗr" },
        { language: "Sanskrit", word: "pitā" },
        { language: "Gothic", word: "fadar" },
        { language: "Old English", word: "fæder" },
        { language: "Old Irish", word: "athir" },
        { language: "Tocharian B", word: "pācer" },
    ];

    const DEMO_TREE = {
        name: "*ph₂tḗr",
        type: "proto",
        meaning: "father",
        children: [
            {
                name: "Italic",
                type: "branch",
                children: [
                    { name: "Latin", type: "leaf", word: "pater", ipa: "/ˈpa.ter/" },
                ],
            },
            {
                name: "Hellenic",
                type: "branch",
                children: [
                    { name: "Greek", type: "leaf", word: "patḗr", ipa: "/pa.tɛ̌ːr/" },
                ],
            },
            {
                name: "Indo-Iranian",
                type: "branch",
                children: [
                    { name: "Sanskrit", type: "leaf", word: "pitā", ipa: "/pi.taː/" },
                ],
            },
            {
                name: "Germanic",
                type: "branch",
                children: [
                    { name: "Gothic", type: "leaf", word: "fadar", ipa: "/ˈfa.ðar/" },
                    { name: "Old English", type: "leaf", word: "fæder", ipa: "/ˈfæ.der/" },
                ],
            },
            {
                name: "Celtic",
                type: "branch",
                children: [
                    { name: "Old Irish", type: "leaf", word: "athir", ipa: "/ˈa.θʲɪrʲ/" },
                ],
            },
            {
                name: "Tocharian",
                type: "branch",
                children: [
                    { name: "Tocharian B", type: "leaf", word: "pācer", ipa: "/ˈpɑː.tser/" },
                ],
            },
        ],
    };

    function loadDemo() {
        state.cognates = DEMO_COGNATES.map((c, i) => ({ id: state.nextId++, ...c }));
        renderCognates();
        renderTree(DEMO_TREE);
    }

    // ── D3 Tree rendering ──
    let svg, gRoot, zoom;

    function initSvg() {
        const existing = treeContainer.querySelector("svg");
        if (existing) existing.remove();

        svg = d3.select(treeContainer)
            .append("svg")
            .attr("width", "100%")
            .attr("height", "100%");

        gRoot = svg.append("g");

        zoom = d3.zoom()
            .scaleExtent([0.3, 3])
            .on("zoom", (e) => gRoot.attr("transform", e.transform));

        svg.call(zoom);

        // Zoom controls
        $("#btn-zoom-in").addEventListener("click", () => svg.transition().call(zoom.scaleBy, 1.3));
        $("#btn-zoom-out").addEventListener("click", () => svg.transition().call(zoom.scaleBy, 0.7));
        $("#btn-zoom-reset").addEventListener("click", () => svg.transition().call(zoom.transform, d3.zoomIdentity));
    }

    function renderTree(data) {
        state.treeData = data;
        treeEmpty.style.display = "none";

        if (!svg) initSvg();
        gRoot.selectAll("*").remove();

        const rect = treeContainer.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        const margin = { top: 40, right: 60, bottom: 40, left: 60 };

        const root = d3.hierarchy(data);
        const treeLayout = d3.tree().size([
            height - margin.top - margin.bottom,
            width - margin.left - margin.right,
        ]);
        treeLayout(root);

        // Center the tree
        const initialTransform = d3.zoomIdentity.translate(margin.left, margin.top);
        svg.call(zoom.transform, initialTransform);

        // Links
        gRoot.selectAll(".tree-link")
            .data(root.links())
            .join("path")
            .attr("class", "tree-link")
            .attr("d", d3.linkHorizontal().x((d) => d.y).y((d) => d.x));

        // Nodes
        const nodes = gRoot.selectAll(".tree-node")
            .data(root.descendants())
            .join("g")
            .attr("class", (d) => {
                const t = d.data.type || (d.children ? "branch" : "leaf");
                return `tree-node node-${t === "proto" ? "root" : t}`;
            })
            .attr("transform", (d) => `translate(${d.y},${d.x})`);

        nodes.append("circle").attr("r", 6);

        // Label
        nodes.append("text")
            .attr("dy", -12)
            .attr("text-anchor", "middle")
            .text((d) => d.data.name);

        // Sublabel (IPA or word)
        nodes.filter((d) => d.data.word)
            .append("text")
            .attr("class", "node-sublabel")
            .attr("dy", 20)
            .attr("text-anchor", "middle")
            .text((d) => d.data.word);

        // Click handler
        nodes.on("click", (event, d) => {
            event.stopPropagation();
            gRoot.selectAll(".tree-node").classed("selected", false);
            d3.select(event.currentTarget).classed("selected", true);
            state.selectedNode = d.data;
            renderDetail(d.data);
        });

        // Click background to deselect
        svg.on("click", () => {
            gRoot.selectAll(".tree-node").classed("selected", false);
            state.selectedNode = null;
            renderDetailEmpty();
        });
    }

    // ── Detail panel ──
    function renderDetail(data) {
        const type = data.type || "branch";
        const tagClass = type === "proto" ? "proto" : type === "leaf" ? "leaf" : "branch";
        const tagLabel = type === "proto" ? "Proto-form" : type === "leaf" ? "Attested" : "Branch";

        let html = `<span class="detail-tag ${tagClass}">${tagLabel}</span>`;
        html += `<div class="detail-section mt-3"><h3>Name</h3><div class="detail-value">${esc(data.name)}</div></div>`;

        if (data.word) {
            html += `<div class="detail-section"><h3>Word</h3><div class="detail-value mono">${esc(data.word)}</div></div>`;
        }
        if (data.ipa) {
            html += `<div class="detail-section"><h3>IPA</h3><div class="detail-value mono">${esc(data.ipa)}</div></div>`;
        }
        if (data.meaning) {
            html += `<div class="detail-section"><h3>Meaning</h3><div class="detail-value">${esc(data.meaning)}</div></div>`;
        }
        if (data.children) {
            html += `<div class="detail-section"><h3>Descendants</h3><div class="detail-value">${data.children.length} child${data.children.length === 1 ? "" : "ren"}</div></div>`;
        }

        detailPanel.innerHTML = html;
    }

    function renderDetailEmpty() {
        detailPanel.innerHTML = `<div class="text-center text-gray-600 mt-8"><p class="text-sm">Click a node in the tree<br>to inspect it.</p></div>`;
    }

    // ── Reconstruct (placeholder — builds tree from cognates) ──
    function reconstruct() {
        if (state.cognates.length === 0) return;

        // Client-side placeholder: group cognates into a flat tree.
        // The real implementation will call a backend API.
        const tree = {
            name: "*proto",
            type: "proto",
            meaning: "reconstructed",
            children: state.cognates.map((c) => ({
                name: c.language,
                type: "leaf",
                word: c.word,
            })),
        };

        renderTree(tree);
    }

    // ── Event wiring ──
    function init() {
        checkHealth();
        renderCognates();

        btnAdd.addEventListener("click", () => {
            addCognate(inputLang.value, inputWord.value);
            inputLang.value = "";
            inputWord.value = "";
            inputLang.focus();
        });

        // Enter key in word input adds the entry
        inputWord.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                addCognate(inputLang.value, inputWord.value);
                inputLang.value = "";
                inputWord.value = "";
                inputLang.focus();
            }
        });

        // Tab from language to word
        inputLang.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                inputWord.focus();
            }
        });

        btnReconstruct.addEventListener("click", reconstruct);
        btnDemo.addEventListener("click", loadDemo);
    }

    document.addEventListener("DOMContentLoaded", init);
})();
