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
