"""
Converter functions for assembling cognate data from multiple sources
into the DPD pickle format.

Each converter returns (langs_list, data) where:
  langs_list = ["ProtoLang", "Daughter1", "Daughter2", ...]
  data = {
      "cognate_id": {
          "daughters": {"Daughter1": ["s", "e", "g"], ...},
          "protoform": {"ProtoLang": ["s", "e", "g"]}
      }, ...
  }

Usage:
    python convert.py
    -> writes per-source pickles to model/data/<source>.pickle
"""

from __future__ import annotations

import csv
import os
import pickle
import sys
from pathlib import Path

from lingpy.sequence.sound_classes import ipa2tokens

# ---------------------------------------------------------------------------
# Tokenisation helpers
# ---------------------------------------------------------------------------

def tokenize_ipa(form: str) -> list[str]:
    """Tokenize a raw IPA string into segments using LingPy."""
    form = form.strip()
    if not form:
        return []
    try:
        tokens = list(ipa2tokens(form))
        # ipa2tokens can return empty-string tokens on edge cases; filter them
        return [t for t in tokens if t]
    except Exception:
        # Fallback: character-level segmentation
        return list(form)


def parse_cldf_segments(raw: str) -> list[str]:
    """Parse a CLDF Segments field into IPA tokens.

    Handles:
      - space separation (standard)
      - ``+`` morpheme boundaries (dropped)
      - ``/`` alternations (keep first variant)
    """
    tokens: list[str] = []
    for part in raw.strip().split():
        if part == "+":
            continue
        # Handle alternation like á/a -> á
        if "/" in part:
            part = part.split("/")[0]
        if part:
            tokens.append(part)
    return tokens


# ---------------------------------------------------------------------------
# Source 1: Romance (local TSV)
# ---------------------------------------------------------------------------

ROMANCE_LANGS = ["Latin", "Romanian", "French", "Italian", "Spanish", "Portuguese"]
ROMANCE_COLS = {
    0: "Romanian",
    1: "French",
    2: "Italian",
    3: "Spanish",
    4: "Portuguese",
    5: "Latin",
}


def convert_romance(tsv_path: str | Path) -> tuple[list[str], dict]:
    """Convert romance-ipa.txt to DPD format."""
    data: dict = {}
    skipped = 0
    with open(tsv_path, encoding="utf-8") as f:
        f.readline()  # skip header
        for i, line in enumerate(f):
            parts = line.rstrip("\n").split("\t")
            if len(parts) != 6:
                skipped += 1
                continue
            proto_form = parts[5].strip()
            if proto_form == "-" or not proto_form:
                skipped += 1
                continue
            daughters: dict[str, list[str]] = {}
            for col_idx in range(5):
                form = parts[col_idx].strip()
                if form and form != "-":
                    tokens = tokenize_ipa(form)
                    if tokens:
                        daughters[ROMANCE_COLS[col_idx]] = tokens
            if not daughters:
                skipped += 1
                continue
            proto_tokens = tokenize_ipa(proto_form)
            if not proto_tokens:
                skipped += 1
                continue
            data[f"romance_{i}"] = {
                "daughters": daughters,
                "protoform": {"Latin": proto_tokens},
            }
    print(f"  Romance: {len(data)} cognate sets loaded ({skipped} skipped)")
    return ROMANCE_LANGS, data


# ---------------------------------------------------------------------------
# Source 2: WikiHan (pre-built pickle)
# ---------------------------------------------------------------------------

def load_wikihan(pickle_path: str | Path, prefix: str = "wikihan") -> tuple[list[str], dict]:
    """Load a WikiHan DPD pickle, prefixing cognate IDs."""
    with open(pickle_path, "rb") as f:
        langs_list, data = pickle.load(f)
    prefixed = {f"{prefix}_{k}": v for k, v in data.items()}
    print(f"  WikiHan ({os.path.basename(str(pickle_path))}): {len(prefixed)} cognate sets")
    return langs_list, prefixed


# ---------------------------------------------------------------------------
# Source 3: SIGTYP 2022 cognates.tsv
# ---------------------------------------------------------------------------

def convert_sigtyp_dataset(
    cognates_tsv: str | Path,
    dataset_name: str,
) -> tuple[list[str], dict] | None:
    """Convert a SIGTYP cognates.tsv to DPD format.

    Returns None if no proto-language column is found.
    """
    with open(cognates_tsv, encoding="utf-8") as f:
        header = f.readline().strip().split("\t")
        if len(header) < 2:
            return None
        langs = header[1:]  # first col is COGID

        # Find proto-language column(s) — pick the first one
        proto_col: int | None = None
        for idx, lang in enumerate(langs):
            if lang.lower().startswith("proto"):
                proto_col = idx
                break
        if proto_col is None:
            return None  # No proto-language column

        proto_name = langs[proto_col]
        daughter_names = [l for idx, l in enumerate(langs) if idx != proto_col]
        langs_list = [proto_name] + daughter_names

        data: dict = {}
        skipped = 0
        for line in f:
            parts = line.rstrip("\n").split("\t")
            if len(parts) < 2:
                continue
            cogid = parts[0].strip()
            forms = parts[1:]

            # Proto-form
            proto_raw = forms[proto_col].strip() if proto_col < len(forms) else ""
            if not proto_raw:
                skipped += 1
                continue
            proto_tokens = proto_raw.split()
            if not proto_tokens:
                skipped += 1
                continue

            # Daughters
            daughters: dict[str, list[str]] = {}
            for idx, lang in enumerate(langs):
                if idx == proto_col:
                    continue
                raw = forms[idx].strip() if idx < len(forms) else ""
                if raw and raw != "?":
                    tokens = raw.split()
                    if tokens:
                        daughters[lang] = tokens
            if not daughters:
                skipped += 1
                continue

            data[f"{dataset_name}_{cogid}"] = {
                "daughters": daughters,
                "protoform": {proto_name: proto_tokens},
            }
        print(f"  SIGTYP/{dataset_name}: {len(data)} cognate sets ({skipped} skipped, proto={proto_name})")
    return langs_list, data


def discover_sigtyp_datasets(base_dir: str | Path) -> list[tuple[str, Path]]:
    """Find all cognates.tsv files under SIGTYP data/ and data-surprise/ dirs."""
    base = Path(base_dir)
    results: list[tuple[str, Path]] = []
    for subdir in ["data", "data-surprise"]:
        parent = base / subdir
        if not parent.is_dir():
            continue
        for dataset_dir in sorted(parent.iterdir()):
            tsv = dataset_dir / "cognates.tsv"
            if tsv.is_file():
                results.append((dataset_dir.name, tsv))
    return results


# ---------------------------------------------------------------------------
# Source 4: Lexibank CLDF (forms.csv)
# ---------------------------------------------------------------------------

def convert_lexibank_cldf(
    forms_csv_path: str | Path,
    dataset_name: str,
) -> tuple[list[str], dict] | None:
    """Convert a Lexibank CLDF forms.csv to DPD format.

    Groups by Parameter_ID (concept).  Within each group, separates
    proto-language rows (Language_ID starts with 'Proto') from daughter rows.
    Returns None if no proto-language is present.
    """
    rows_by_concept: dict[str, list[tuple[str, list[str]]]] = {}
    proto_lang: str | None = None

    with open(forms_csv_path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            lang = row.get("Language_ID", "").strip()
            segments_raw = row.get("Segments", "").strip()
            # Group by Parameter_ID (concept slot); fall back to Cognacy
            concept = row.get("Parameter_ID", "").strip()
            if not concept:
                concept = row.get("Cognacy", "").strip()
            if not segments_raw or not concept or not lang:
                continue
            tokens = parse_cldf_segments(segments_raw)
            if not tokens:
                continue
            if lang.lower().startswith("proto"):
                proto_lang = lang
            rows_by_concept.setdefault(concept, []).append((lang, tokens))

    if proto_lang is None:
        print(f"  Lexibank/{dataset_name}: skipped (no proto-language found)")
        return None

    # Build cognate entries
    all_daughters: set[str] = set()
    data: dict = {}
    for concept, entries in rows_by_concept.items():
        proto_entries = [(l, s) for l, s in entries if l == proto_lang]
        daughter_entries = [(l, s) for l, s in entries if l != proto_lang]
        if not proto_entries or not daughter_entries:
            continue
        daughters = {l: s for l, s in daughter_entries}
        all_daughters.update(daughters.keys())
        data[f"{dataset_name}_{concept}"] = {
            "daughters": daughters,
            "protoform": {proto_lang: proto_entries[0][1]},
        }

    langs_list = [proto_lang] + sorted(all_daughters)
    print(f"  Lexibank/{dataset_name}: {len(data)} cognate sets (proto={proto_lang}, {len(all_daughters)} daughters)")
    return langs_list, data


# ---------------------------------------------------------------------------
# Main: run all converters, save per-source pickles
# ---------------------------------------------------------------------------

DATA_DIR = Path(__file__).parent / "data"


def run_all() -> None:
    os.makedirs(DATA_DIR / "per_source", exist_ok=True)

    results: dict[str, tuple[str, list[str], dict]] = {}
    # family_name -> (source_label, langs_list, data)

    # --- Romance ---
    romance_path = DATA_DIR / "romance-ipa.txt"
    if romance_path.exists():
        langs, data = convert_romance(romance_path)
        results["Romance"] = ("romance", langs, data)
    else:
        print(f"WARNING: {romance_path} not found, skipping Romance", file=sys.stderr)

    # --- WikiHan ---
    wikihan_dir = DATA_DIR / "dpd_repo" / "data" / "chinese_wikihan2022"
    for split in ["train", "dev", "test"]:
        pkl = wikihan_dir / f"{split}.pickle"
        if pkl.exists():
            langs, data = load_wikihan(pkl, prefix=f"wikihan_{split}")
            key = f"Sinitic_wikihan_{split}"
            results[key] = (f"wikihan_{split}", langs, data)
        else:
            print(f"WARNING: {pkl} not found", file=sys.stderr)

    # --- SIGTYP ---
    sigtyp_dir = DATA_DIR / "sigtyp"
    if sigtyp_dir.is_dir():
        for dataset_name, tsv_path in discover_sigtyp_datasets(sigtyp_dir):
            result = convert_sigtyp_dataset(tsv_path, dataset_name)
            if result is not None:
                langs, data = result
                family = langs[0].replace("Proto", "")  # e.g. "Burmish", "Bai"
                results[f"{family}_{dataset_name}"] = (dataset_name, langs, data)
            else:
                print(f"  SIGTYP/{dataset_name}: skipped (no proto-language column)")
    else:
        print(f"WARNING: {sigtyp_dir} not found, skipping SIGTYP", file=sys.stderr)

    # --- Lexibank ---
    lexibank_dir = DATA_DIR / "lexibank"
    if lexibank_dir.is_dir():
        for repo_dir in sorted(lexibank_dir.iterdir()):
            forms_csv = repo_dir / "cldf" / "forms.csv"
            if forms_csv.is_file():
                result = convert_lexibank_cldf(forms_csv, repo_dir.name)
                if result is not None:
                    langs, data = result
                    family = langs[0].replace("Proto", "")
                    results[f"{family}_{repo_dir.name}"] = (repo_dir.name, langs, data)
    else:
        print(f"WARNING: {lexibank_dir} not found, skipping Lexibank", file=sys.stderr)

    # Save per-source pickles
    for key, (source_label, langs, data) in results.items():
        out_path = DATA_DIR / "per_source" / f"{source_label}.pickle"
        with open(out_path, "wb") as f:
            pickle.dump((langs, data), f)
        print(f"  -> Saved {out_path} ({len(data)} entries)")

    # Also save a manifest for merge.py
    manifest: dict[str, dict] = {}
    for key, (source_label, langs, data) in results.items():
        manifest[key] = {
            "source_label": source_label,
            "pickle": str(DATA_DIR / "per_source" / f"{source_label}.pickle"),
            "proto": langs[0],
            "n_daughters": len(langs) - 1,
            "n_cognates": len(data),
        }
    manifest_path = DATA_DIR / "per_source" / "manifest.pickle"
    with open(manifest_path, "wb") as f:
        pickle.dump(manifest, f)

    # Summary
    total = sum(info["n_cognates"] for info in manifest.values())
    print(f"\n=== TOTAL: {total} cognate sets across {len(manifest)} source groups ===")
    for key, info in sorted(manifest.items()):
        print(f"  {key}: {info['n_cognates']} cognates, proto={info['proto']}, {info['n_daughters']} daughters")


if __name__ == "__main__":
    run_all()
