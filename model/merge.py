"""
Merge per-source DPD pickles into a single unified dataset with
family-prefixed language names, then split into train/dev/test.

Strategy B from the plan: all sources merged into one pickle with a
synthetic "Proto" target language.  Each source's daughter (and proto)
names are prefixed with a family tag so the model can learn family-aware
embeddings.

Usage:
    python merge.py          # reads model/data/per_source/*.pickle + manifest
    -> writes model/data/combined/{train,dev,test}.pickle
"""

from __future__ import annotations

import os
import pickle
import random
import sys
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"
COMBINED_DIR = DATA_DIR / "combined"


def load_manifest() -> dict:
    manifest_path = DATA_DIR / "per_source" / "manifest.pickle"
    if not manifest_path.exists():
        print(f"ERROR: {manifest_path} not found. Run convert.py first.", file=sys.stderr)
        sys.exit(1)
    with open(manifest_path, "rb") as f:
        return pickle.load(f)


def merge_datasets(
    manifest: dict,
) -> tuple[list[str], dict]:
    """Merge all per-source pickles into one unified DPD dataset.

    Language names are prefixed with the family key to disambiguate
    across language families (e.g., ``Romance_French``, ``Sinitic_Cantonese``).
    All proto-forms are mapped to a single synthetic ``Proto`` language.
    """
    unified_proto = "Proto"
    all_daughters: set[str] = set()
    merged_data: dict = {}

    for family_key, info in sorted(manifest.items()):
        pkl_path = info["pickle"]
        with open(pkl_path, "rb") as f:
            langs_list, data = pickle.load(f)

        src_proto = langs_list[0]
        for cogid, entry in data.items():
            # Prefix daughter names
            new_daughters: dict[str, list[str]] = {}
            for lang, tokens in entry["daughters"].items():
                prefixed = f"{family_key}_{lang}"
                new_daughters[prefixed] = tokens
                all_daughters.add(prefixed)

            # Unified proto
            proto_tokens = list(entry["protoform"].values())[0]
            new_proto = {unified_proto: proto_tokens}

            merged_data[cogid] = {
                "daughters": new_daughters,
                "protoform": new_proto,
            }

    langs_list = [unified_proto] + sorted(all_daughters)
    return langs_list, merged_data


def split_data(
    langs_list: list[str],
    data: dict,
    train_frac: float = 0.8,
    dev_frac: float = 0.1,
    seed: int = 42,
) -> dict[str, tuple[list[str], dict]]:
    """Split merged data into train/dev/test."""
    cogids = list(data.keys())
    rng = random.Random(seed)
    rng.shuffle(cogids)

    n = len(cogids)
    train_end = int(train_frac * n)
    dev_end = int((train_frac + dev_frac) * n)

    splits = {
        "train": {k: data[k] for k in cogids[:train_end]},
        "dev": {k: data[k] for k in cogids[train_end:dev_end]},
        "test": {k: data[k] for k in cogids[dev_end:]},
    }
    return {name: (langs_list, sdata) for name, sdata in splits.items()}


def save_splits(splits: dict[str, tuple[list[str], dict]]) -> None:
    os.makedirs(COMBINED_DIR, exist_ok=True)
    for name, (langs_list, data) in splits.items():
        out = COMBINED_DIR / f"{name}.pickle"
        with open(out, "wb") as f:
            pickle.dump((langs_list, data), f)
        print(f"  {name}: {len(data)} cognate sets -> {out}")


def verify_pickle(path: Path) -> None:
    """Smoke-test a saved pickle: load it and check structure."""
    with open(path, "rb") as f:
        langs_list, data = pickle.load(f)
    assert isinstance(langs_list, list) and len(langs_list) >= 2, \
        f"langs_list too short: {langs_list}"
    assert isinstance(data, dict) and len(data) > 0, \
        f"data dict is empty"
    # Spot-check first 5 entries
    for i, (cogid, entry) in enumerate(data.items()):
        if i >= 5:
            break
        assert "daughters" in entry, f"{cogid} missing 'daughters'"
        assert "protoform" in entry, f"{cogid} missing 'protoform'"
        assert len(entry["daughters"]) >= 1, f"{cogid} has no daughters"
        proto_vals = list(entry["protoform"].values())
        assert len(proto_vals) == 1 and len(proto_vals[0]) >= 1, \
            f"{cogid} proto-form is empty"
        for lang, tokens in entry["daughters"].items():
            assert isinstance(tokens, list) and len(tokens) >= 1, \
                f"{cogid} daughter {lang} has empty tokens"
    print(f"  ✓ {path.name}: {len(langs_list)} languages, {len(data)} cognate sets")


def main() -> None:
    manifest = load_manifest()
    print(f"Loaded manifest: {len(manifest)} source groups\n")

    # Merge
    print("Merging datasets (Strategy B: unified pickle, family-prefixed names)...")
    langs_list, merged = merge_datasets(manifest)
    print(f"  Merged: {len(merged)} total cognate sets, {len(langs_list)} languages")

    # Validate no empty entries slipped through
    empties = [k for k, v in merged.items()
               if not v["daughters"] or not list(v["protoform"].values())[0]]
    if empties:
        print(f"  WARNING: {len(empties)} entries with empty daughters/proto — removing")
        for k in empties:
            del merged[k]

    # Split
    print("\nSplitting (80/10/10, seed=42)...")
    splits = split_data(langs_list, merged)
    save_splits(splits)

    # Verify
    print("\nVerification:")
    for name in ["train", "dev", "test"]:
        verify_pickle(COMBINED_DIR / f"{name}.pickle")

    # Print 3 random sample entries from train
    print("\nSample entries from train.pickle:")
    with open(COMBINED_DIR / "train.pickle", "rb") as f:
        _, train_data = pickle.load(f)
    rng = random.Random(123)
    sample_keys = rng.sample(list(train_data.keys()), min(5, len(train_data)))
    for key in sample_keys:
        entry = train_data[key]
        proto_lang = list(entry["protoform"].keys())[0]
        proto_tokens = entry["protoform"][proto_lang]
        print(f"  {key}:")
        print(f"    proto ({proto_lang}): {' '.join(proto_tokens)}")
        for lang, tokens in list(entry["daughters"].items())[:3]:
            print(f"    {lang}: {' '.join(tokens)}")
        if len(entry["daughters"]) > 3:
            print(f"    ... +{len(entry['daughters']) - 3} more daughters")


if __name__ == "__main__":
    main()
