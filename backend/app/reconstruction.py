import os
import csv
import logging
from collections import defaultdict

from lingpy import Multiple

from app.ipa_utils import feature_edit_distance, normalized_edit_distance
from app.glottochronology import estimate_from_ned

logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)

LANGUAGES = ["Romanian", "French", "Italian", "Spanish", "Portuguese"]
DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "romance_ipa.tsv")

_dataset = None


def load_dataset():
    global _dataset
    if _dataset is not None:
        return _dataset

    entries = []
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        reader = csv.reader(f, delimiter="\t")
        header = next(reader)
        for row in reader:
            if len(row) < 6:
                continue
            entry = {
                "romanian": row[0] if row[0] != "-" else None,
                "french": row[1] if row[1] != "-" else None,
                "italian": row[2] if row[2] != "-" else None,
                "spanish": row[3] if row[3] != "-" else None,
                "portuguese": row[4] if row[4] != "-" else None,
                "latin": row[5] if row[5] != "-" else None,
            }
            present = sum(1 for k in LANGUAGES if entry[k.lower()] is not None)
            if present >= 2 and entry["latin"] is not None:
                entries.append(entry)

    _dataset = entries
    return _dataset


def get_sample(count=20, offset=0):
    data = load_dataset()
    subset = data[offset : offset + count]
    return {
        "total": len(data),
        "offset": offset,
        "count": len(subset),
        "samples": subset,
    }


def search_dataset(query, limit=20):
    data = load_dataset()
    query = query.lower()
    results = []
    for entry in data:
        for lang in ["romanian", "french", "italian", "spanish", "portuguese", "latin"]:
            val = entry.get(lang)
            if val and query in val.lower():
                results.append(entry)
                break
        if len(results) >= limit:
            break
    return {"query": query, "count": len(results), "results": results}


def align_words(words):
    if len(words) < 2:
        return {"error": "Need at least 2 words to align"}

    clean = [w for w in words if w and w.strip()]
    if len(clean) < 2:
        return {"error": "Need at least 2 non-empty words"}

    try:
        msa = Multiple(clean)
        msa.prog_align()
        aligned = msa.alm_matrix
        return {
            "input": clean,
            "alignment": [list(row) for row in aligned],
        }
    except Exception as e:
        return {"error": f"Alignment failed: {str(e)}"}


def _majority_vote_column(column):
    counts = defaultdict(int)
    for seg in column:
        if seg != "-" and seg.strip():
            counts[seg] += 1
    if not counts:
        return "-"
    return max(counts, key=counts.get)


def _weighted_vote_column(column, weights=None):
    if weights is None:
        weights = [1.0] * len(column)

    candidates = defaultdict(float)
    for seg, w in zip(column, weights):
        if seg != "-" and seg.strip():
            candidates[seg] += w

    if not candidates:
        return "-"
    return max(candidates, key=candidates.get)


def reconstruct_from_cognates(cognate_words, language_labels=None):
    if not cognate_words or len(cognate_words) < 2:
        return {"error": "Need at least 2 cognate words"}

    clean_words = []
    clean_labels = []
    for i, w in enumerate(cognate_words):
        if w and w.strip() and w != "-":
            clean_words.append(w.strip())
            if language_labels and i < len(language_labels):
                clean_labels.append(language_labels[i])
            else:
                clean_labels.append(f"Language {i + 1}")

    if len(clean_words) < 2:
        return {"error": "Need at least 2 non-empty cognate words"}

    try:
        msa = Multiple(clean_words)
        msa.prog_align()
        aligned = msa.alm_matrix

        proto_segments = []
        num_cols = len(aligned[0]) if aligned else 0
        for col_idx in range(num_cols):
            column = [row[col_idx] for row in aligned]
            proto_seg = _majority_vote_column(column)
            proto_segments.append(proto_seg)

        proto_form = "".join(seg for seg in proto_segments if seg != "-")

        distances = []
        for i, w1 in enumerate(clean_words):
            for j, w2 in enumerate(clean_words):
                if i < j:
                    try:
                        fed = feature_edit_distance(w1, w2)
                        ned = normalized_edit_distance(w1, w2)
                        divergence = estimate_from_ned(ned)
                        distances.append({
                            "lang1": clean_labels[i],
                            "lang2": clean_labels[j],
                            "word1": w1,
                            "word2": w2,
                            "feature_edit_distance": round(fed, 4),
                            "normalized_edit_distance": round(ned, 4),
                            "divergence": divergence,
                        })
                    except Exception:
                        distances.append({
                            "lang1": clean_labels[i],
                            "lang2": clean_labels[j],
                            "word1": w1,
                            "word2": w2,
                            "feature_edit_distance": None,
                            "normalized_edit_distance": None,
                            "divergence": None,
                        })

        tree_data = _build_convergence_tree(clean_words, clean_labels, proto_form, aligned)

        return {
            "proto_form": "*" + proto_form,
            "alignment": [list(row) for row in aligned],
            "input_words": clean_words,
            "languages": clean_labels,
            "distances": distances,
            "tree": tree_data,
        }
    except Exception as e:
        logger.error(f"Reconstruction failed: {e}")
        return {"error": f"Reconstruction failed: {str(e)}"}


def _build_convergence_tree(words, labels, proto_form, aligned):
    children = []
    for word, label in zip(words, labels):
        children.append({
            "name": f"{label}: {word}",
            "word": word,
            "language": label,
            "type": "leaf",
        })

    if len(children) <= 2:
        return {
            "name": f"*{proto_form}",
            "type": "root",
            "children": children,
        }

    mid = len(children) // 2
    left_group = children[:mid]
    right_group = children[mid:]

    left_words = [c["word"] for c in left_group]
    right_words = [c["word"] for c in right_group]
    left_proto_segs = []
    right_proto_segs = []

    num_cols = len(aligned[0]) if aligned else 0
    for col_idx in range(num_cols):
        left_col = [aligned[i][col_idx] for i in range(mid)]
        right_col = [aligned[i][col_idx] for i in range(mid, len(words))]
        left_proto_segs.append(_majority_vote_column(left_col))
        right_proto_segs.append(_majority_vote_column(right_col))

    left_inter = "".join(s for s in left_proto_segs if s != "-")
    right_inter = "".join(s for s in right_proto_segs if s != "-")

    tree = {
        "name": f"*{proto_form}",
        "type": "root",
        "children": [
            {
                "name": f"*{left_inter}" if left_inter != proto_form else f"Branch A",
                "type": "intermediate",
                "children": left_group,
            },
            {
                "name": f"*{right_inter}" if right_inter != proto_form else f"Branch B",
                "type": "intermediate",
                "children": right_group,
            },
        ],
    }

    return tree


def reconstruct_tree(tree):
    """Reconstruct a tree bottom-up.

    Tree format:
    {
        "label": "Proto-Language",
        "children": [
            {
                "label": "Branch A",
                "ipa": "",          # empty => reconstruct from descendants
                "children": [
                    {"label": "French", "ipa": "pɛːr"},
                    {"label": "Italian", "ipa": "padre"}
                ]
            },
            ...
        ]
    }

    Returns the tree with all missing ipa fields filled in via reconstruction,
    plus alignment/distance metadata.
    """
    if not tree or "children" not in tree or len(tree.get("children", [])) < 1:
        return {"error": "Tree must have at least one intermediate child"}

    result_tree = _reconstruct_node(tree)
    if "error" in result_tree:
        return result_tree

    # Build similarity matrix from leaves
    leaves = _collect_leaves(result_tree)
    labels = [l["label"] for l in leaves]
    ipas = [l["ipa"] for l in leaves]
    matrix = _build_similarity_matrix(labels, ipas)

    # Compute RCI-based age estimates in years for all internal nodes
    _compute_ages_in_years(result_tree)

    return {
        "tree": result_tree,
        "similarity_matrix": matrix,
    }


def _build_similarity_matrix(labels, ipas):
    """Build an NxN IPA similarity matrix between all leaf forms."""
    n = len(labels)
    rows = []
    for i in range(n):
        row = []
        for j in range(n):
            if i == j:
                row.append(1.0)
            else:
                try:
                    ned = normalized_edit_distance(ipas[i], ipas[j])
                    row.append(round(1.0 - ned, 4))
                except Exception:
                    row.append(None)
        rows.append(row)
    return {"labels": labels, "values": rows}


def _compute_ages_in_years(node):
    """Compute estimated age in years for all nodes using Rate of Change Index.

    For each internal node, compute the average NED between its IPA and all
    descendant leaves. Map that NED to an estimated year value via
    glottochronological estimation. Leaves get age 0 (present day).
    """
    _assign_age_years(node)


def _ned_to_years(ned):
    """Convert a normalized edit distance to an estimated age in years.

    Uses a continuous logarithmic model calibrated to known language family
    divergence points. The formula is derived from the Swadesh retention rate
    model: years = -ln(1 - ned) / (2 * ln(r)) * 1000, with r = 0.86.
    Clamped to avoid domain errors at extremes.
    """
    import math
    if ned <= 0:
        return 0
    if ned >= 1.0:
        ned = 0.99
    similarity = 1.0 - ned
    if similarity <= 0:
        similarity = 0.01
    return (math.log(similarity) / (2 * math.log(0.86))) * 1000


def _assign_age_years(node):
    """Recursively assign estimated age in years to each node."""
    if not node.get("children"):
        node["estimated_age_years"] = 0
        return

    for child in node["children"]:
        _assign_age_years(child)

    leaves = _collect_leaves(node)
    node_ipa = node.get("ipa", "")
    if not node_ipa or not leaves:
        node["estimated_age_years"] = 0
        return

    total_ned = 0.0
    count = 0
    for leaf in leaves:
        try:
            ned = normalized_edit_distance(node_ipa, leaf["ipa"])
            total_ned += ned
            count += 1
        except Exception:
            pass

    avg_ned = (total_ned / count) if count > 0 else 0.0
    node["estimated_age_years"] = round(_ned_to_years(avg_ned))


def _reconstruct_node(node):
    """Recursively reconstruct a node bottom-up."""
    children = node.get("children")

    # Leaf node (descendant) — must have ipa
    if not children:
        ipa = (node.get("ipa") or "").strip()
        if not ipa:
            return {"error": f"Descendant '{node.get('label', '?')}' is missing IPA input"}
        return {
            "label": node.get("label", ""),
            "ipa": ipa,
            "type": "descendant",
            "reconstructed": False,
        }

    # Has children — process children first
    resolved_children = []
    for child in children:
        resolved = _reconstruct_node(child)
        if "error" in resolved:
            return resolved
        resolved_children.append(resolved)

    label = node.get("label", "")
    ipa = (node.get("ipa") or "").strip()

    # If this node has no ipa, reconstruct from children
    if not ipa:
        child_words = _collect_ipa_from_children(resolved_children)
        if len(child_words) < 2:
            # Only one child — just propagate its form
            if len(child_words) == 1:
                ipa = child_words[0]
            else:
                return {"error": f"Node '{label}' has no IPA input and no descendants to reconstruct from"}
        else:
            try:
                msa = Multiple(child_words)
                msa.prog_align()
                aligned = msa.alm_matrix
                proto_segments = []
                num_cols = len(aligned[0]) if aligned else 0
                for col_idx in range(num_cols):
                    column = [row[col_idx] for row in aligned]
                    proto_seg = _majority_vote_column(column)
                    proto_segments.append(proto_seg)
                ipa = "".join(seg for seg in proto_segments if seg != "-")
            except Exception as e:
                return {"error": f"Reconstruction failed for '{label}': {str(e)}"}
        reconstructed = True
    else:
        reconstructed = False

    # Determine type: root (no parent context) or intermediate
    is_root = node.get("_is_root", False)
    node_type = "root" if is_root else "intermediate"

    return {
        "label": label,
        "ipa": ipa,
        "type": node_type,
        "reconstructed": reconstructed,
        "children": resolved_children,
    }


def _collect_ipa_from_children(children):
    """Collect all ipa values from resolved child nodes (recursively flattens)."""
    result = []
    for child in children:
        ipa = child.get("ipa", "").strip()
        if ipa:
            result.append(ipa)
    return result


def _collect_leaves(node):
    """Collect all leaf nodes from a resolved tree."""
    if not node.get("children"):
        return [node]
    leaves = []
    for child in node["children"]:
        leaves.extend(_collect_leaves(child))
    return leaves


def reconstruct_from_dataset_entry(index):
    data = load_dataset()
    if index < 0 or index >= len(data):
        return {"error": f"Index {index} out of range (0-{len(data) - 1})"}

    entry = data[index]
    words = []
    labels = []
    for lang in LANGUAGES:
        val = entry[lang.lower()]
        if val:
            words.append(val)
            labels.append(lang)

    result = reconstruct_from_cognates(words, labels)
    result["actual_latin"] = entry["latin"]
    result["dataset_index"] = index
    return result
