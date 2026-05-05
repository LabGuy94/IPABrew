# IPABrew

![ipabrew](https://github.com/user-attachments/assets/f35799fe-8e9f-47c1-b73f-b5521af8c65d)

IPABrew is a local Flask application for proto-language reconstruction from IPA cognates, powered by a repurposed and retrained DPD bidirectional Transformer covering 65 languages and 637 IPA tokens across a combined SIGTYP 2022 + WikiHan training corpus. Around that neural core it bundles a browser tree editor, JSON APIs, a command-line interface, an algorithmic LingPy reconstruction baseline, IPA utilities, and divergence-date estimates.

## Background

IPABrew started as a hackathon prototype and is organized as a local research/demo app rather than a hosted service. The project is designed for experimenting with cognate sets, language-family trees, reconstruction methods, and supporting phonological analysis tools.

## What is included

- **Web app:** build language trees, enter IPA cognates, run reconstruction, and visualize reconstructed trees.
- **Reconstruction methods:** optional DPD neural reconstruction plus an always-available LingPy algorithmic baseline.
- **IPA tooling:** panphon-backed feature extraction and normalized phonological edit distance.
- **Dating helpers:** Swadesh-style retention estimates, normalized-edit-distance mappings, calibration data, and retention curve data.
- **Dataset tools:** bundled Meloni Romance IPA data for sampling, search, and reconstruction examples.
- **CLI and API:** the same core functions are available through `ipabrew` commands and Flask JSON endpoints.
- **Frontend tools:** vanilla JavaScript tree editor, D3 visualization, IPA keyboard, export controls, and built-in demo families.
- **Model assets:** DPD integration code under `backend/app/dpd` and training/data assets under `model/`.

## Requirements

- Python 3.10+
- pip
- A Python environment capable of installing the scientific/ML dependencies in `pyproject.toml`

Dependency installation can vary by platform, especially for PyTorch.

## Install

From a fresh clone:

```bash
git clone https://github.com/LabGuy94/IPABrew.git
cd IPABrew
pip install -e .
```

For tests, install the test extra as well:

```bash
pip install -e .[test]
```

## Run the web app

```bash
ipabrew web
```

`ipabrew web` opens the app at `http://localhost:8080`. These aliases are also available:

```bash
ipabrew app      # same as ipabrew web
ipabrew server   # run the server without opening a browser
ipabrew serve    # same as ipabrew server
```

Open the in-app documentation directly with:

```bash
ipabrew docs
```

or visit `http://localhost:8080/docs` after starting the server.

## Architecture

Flask serves a single-page vanilla JavaScript frontend. There is no frontend build step.

| Path | Role |
|---|---|
| `backend/app/__init__.py` | Flask app factory and route registration |
| `backend/app/routes.py` | API endpoints mounted under `/api` |
| `backend/app/reconstruction.py` | Dataset loading and reconstruction workflows |
| `backend/app/services/dpd_service.py` | DPD model loading and inference wrapper |
| `backend/app/glottochronology.py` | Divergence dating helpers |
| `backend/app/ipa_utils.py` | IPA feature and distance helpers |
| `backend/app/dpd/` | Vendored DPD model code based on `cmu-llab/dpd` |
| `backend/app/templates/` | Web UI and in-app documentation templates |
| `backend/app/static/js/app.js` | Frontend tree editor, API calls, D3 rendering, IPA keyboard, and export logic |
| `backend/app/static/css/style.css` | App styles |
| `backend/app/data/romance_ipa.tsv` | Meloni Romance dataset: Romanian, French, Italian, Spanish, Portuguese, and Latin IPA forms |
| `model/` | Checkpoints, model configuration, cached data, combined data, and training notebook |

## Reconstruction methods

### ML (DPD neural model)

The ML path uses a bidirectional Transformer model family from Lu, Xie & Mortensen (2024), based on [`cmu-llab/dpd`](https://github.com/cmu-llab/dpd). It tokenizes IPA input, encodes daughter forms with language embeddings, and decodes proto-form candidates. The selected checkpoint is `model/checkpoints/epoch34.ckpt`; model configuration is in `model/checkpoints/model_config.yaml`. The checkpoint was trained on combined SIGTYP 2022 and WikiHan data aggregated under `model/data/combined/`. The app uses this path when the checkpoint and model data are present and loaded.

### Algorithmic (LingPy)

The algorithmic path uses LingPy multiple-sequence alignment and majority voting over alignment columns. It is always available, can be selected explicitly with `method: "algorithm"`, and is used as a fallback when ML reconstruction is unavailable.

## Glottochronology and dating

For cognate-retention estimates, IPABrew uses the Swadesh retention-rate formula:

```text
t = ln(c) / (2 * ln(r)) * 1000
```

where `c` is the cognate retention proportion and `r` defaults to `0.86`.

For pairwise phonological distance, normalized edit distance (NED) is mapped to rough date bands:

| NED range | Estimated age | Category |
|---|---:|---|
| `0.0-0.1` | `0-500` years | Dialects |
| `0.1-0.3` | `500-1,500` years | Romance languages |
| `0.3-0.5` | `1,500-3,000` years | Germanic family |
| `0.5-0.7` | `3,000-5,000` years | Indo-European subfamilies |
| `0.7-1.0` | `5,000-10,000` years | Deep or uncertain relationships |

Calibration data is exposed through the API for known language-family splits, including Romance, Proto-Germanic, Balto-Slavic, and Proto-Indo-European reference points.

## Dataset

The bundled Romance table contains cognate sets across Romanian, French, Italian, Spanish, and Portuguese, with Latin proto-forms in IPA transcription. The dataset powers `ipabrew sample`, `ipabrew search`, `/api/dataset/sample`, `/api/dataset/search`, and dataset-index reconstruction.

## CLI examples

```bash
ipabrew help
ipabrew help reconstruct
ipabrew sample --count 3
ipabrew search pater --limit 5
ipabrew reconstruct --words pɛːr padre --languages French Spanish
ipabrew reconstruct-tree --tree-json tree.json --method algorithm
ipabrew distance pɛːr padre
ipabrew features padre
ipabrew date --ned 0.3
ipabrew model-status
```

Analysis commands print JSON to stdout and return non-zero exit codes for validation/runtime errors.

## API overview

All endpoints are under `/api`.

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/dataset/sample` | Return bundled Romance entries with `count` and `offset` query parameters |
| GET | `/api/dataset/search` | Search dataset IPA strings with required `q` and optional `limit` query parameters |
| POST | `/api/reconstruct` | Reconstruct from `{"words": [...], "languages": [...]}` or `{"index": N}` |
| POST | `/api/reconstruct_tree` | Reconstruct a tree bottom-up from `{"tree": {...}, "method": "ml"}` or `"algorithm"` |
| GET | `/api/model/status` | Report whether the DPD model is loaded and available |
| POST | `/api/align` | Align IPA words from `{"words": [...]}` |
| POST | `/api/ipa/distance` | Compute phonological distance from `{"word1": "...", "word2": "..."}` |
| POST | `/api/ipa/features` | Return articulatory feature vectors from `{"word": "..."}` |
| POST | `/api/date` | Estimate divergence from `{"cognate_pct": 0.6}` or `{"ned": 0.3}` |
| GET | `/api/date/curve` | Return retention-rate curve data |
| GET | `/api/date/calibration` | Return calibration dates for known language splits |

See `/docs` in the running app for more request shapes and workflow notes.

## Project layout

```text
IPABrew/
├── backend/
│   ├── app/
│   │   ├── data/                  Bundled Romance IPA data
│   │   ├── dpd/                   Vendored DPD model code
│   │   ├── services/              Model/service wrappers
│   │   ├── static/                CSS, JavaScript, and static assets
│   │   ├── templates/             App and docs templates
│   │   ├── __init__.py            Flask app factory
│   │   ├── cli.py                 CLI entrypoint
│   │   ├── glottochronology.py    Dating helpers
│   │   ├── ipa_utils.py           IPA utilities
│   │   ├── reconstruction.py      Reconstruction workflows
│   │   └── routes.py              API routes
│   └── tests/                     pytest suite
├── model/
│   ├── checkpoints/               Model checkpoint and configuration
│   ├── data/                      Training/evaluation data
│   └── notebooks/                 Training notebook
├── pyproject.toml                 Package metadata and CLI entrypoint
├── requirements.txt               Python dependencies
└── README.md
```

## Development

Run the focused test suite with:

```bash
pytest backend/tests
```

The DPD model loads when the Flask app starts. First startup can take a few seconds when model assets are present. The CLI entrypoint is the preferred launch path, but `cd backend && python run.py` also starts the Flask debug server on port 8080 for development. To add demo language families, update the frontend demo data in `backend/app/static/js/app.js`. Model checkpoint and training details are documented in `model/README.md`.

The app is designed to run locally. Treat divergence dates as comparative estimates rather than absolute historical dates; results depend on input quality, IPA coverage, and model availability.

## Credits

- **DPD BiReconstructor:** Lu, Xie & Mortensen (2024), "DPD: A Diverse, Paired and Dense Dataset for Proto-language Reconstruction," ACL 2024. [`cmu-llab/dpd`](https://github.com/cmu-llab/dpd)
- **LingPy:** List & Forkel, sequence comparison in computational historical linguistics. [lingpy.org](https://lingpy.org)
- **panphon:** Mortensen, Dalmia & Littell, IPA segment-to-feature mapping. [`dmort27/panphon`](https://github.com/dmort27/panphon)
- **Meloni Romance dataset:** Meloni et al. (2021), "Ab Antiquo: Neural Proto-language Reconstruction," NAACL 2021.
