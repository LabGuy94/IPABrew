# IPABrew

![ipabrew](https://github.com/user-attachments/assets/f35799fe-8e9f-47c1-b73f-b5521af8c65d)

IPABrew is a web application for reconstructing proto-language forms from cognate words across related languages. It combines neural ML models with traditional linguistic algorithms to infer ancestral word forms, visualize language family trees, and estimate divergence dates.

## Backstory

This project was created in ~6 hours for a hackathon, and was substantially AI assisted.

## Quick Start

**Prerequisites:** Python 3.11+ (3.12 recommended), pip

```bash
git clone https://github.com/LabGuy94/IPABrew.git && cd IPABrew
pip install -r requirements.txt
cd backend && python run.py
```

Open [http://localhost:8080](http://localhost:8080).

## Architecture

Flask backend serves a single-page vanilla JS frontend. No build step.

| Path | Role |
|---|---|
| `backend/app/__init__.py` | Flask app factory, loads DPD model at startup |
| `backend/app/routes.py` | All API endpoints (Blueprint mounted at `/api`) |
| `backend/app/reconstruction.py` | Core reconstruction logic (both ML and algorithmic paths) |
| `backend/app/services/dpd_service.py` | DPD model loading and inference singleton |
| `backend/app/glottochronology.py` | Divergence dating (Swadesh formula + NED mapping) |
| `backend/app/ipa_utils.py` | IPA feature distance calculations (panphon wrapper) |
| `backend/app/dpd/` | Vendored DPD model code (from cmu-llab/dpd) |
| `backend/app/templates/index.html` | Single-page app HTML |
| `backend/app/static/js/app.js` | All frontend logic |
| `backend/app/static/css/style.css` | All styles |
| `backend/data/romance_ipa.tsv` | Meloni Romance dataset (5 languages + Latin, IPA) |
| `model/` | Trained model checkpoint and data (see `model/README.md`) |

## Reconstruction Methods

### ML (DPD Neural Model)

Bidirectional Transformer (daughter-to-proto + proto-to-daughter) from Lu, Xie & Mortensen (2024), based on [cmu-llab/dpd](https://github.com/cmu-llab/dpd).

- Trained on combined SIGTYP 2022 + WikiHan datasets
- Tokenizes IPA input, encodes daughter forms with language embeddings, decodes proto-form
- Default method when `model/checkpoints/epoch34.ckpt` is present

### Algorithmic (LingPy)

Multiple sequence alignment (SCA algorithm) + majority-vote reconstruction.

- Uses LingPy's `Multiple.prog_align()` for phonologically-informed alignment
- Votes on each alignment column to determine proto-segment
- Fallback when ML model is unavailable, or selectable by the user

## Glottochronology / Dating

**Swadesh retention rate formula:**

```
t = ln(c) / (2 * ln(r)) * 1000
```

where `c` = cognate retention proportion, `r` = 0.86.

**NED-to-years mapping** for estimating divergence from phonological distance of individual pairs:

| NED Range | Estimated Age | Category |
|---|---|---|
| 0.0 -- 0.1 | 0 -- 500 years | Dialects |
| 0.1 -- 0.3 | 500 -- 1,500 years | Romance languages |
| 0.3 -- 0.5 | 1,500 -- 3,000 years | Germanic family |
| 0.5 -- 0.7 | 3,000 -- 5,000 years | IE subfamilies |
| 0.7+ | 5,000+ years | Deep/uncertain |

**Calibration dates:** Romance ~1,750 yrs, Proto-Germanic ~2,500 yrs, Balto-Slavic ~3,500 yrs, PIE ~6,000 yrs.

## Frontend

- Tree editor: build custom language family trees with drag-and-drop
- D3.js v7 visualization of reconstructed proto-form trees
- IPA keyboard for phonetic input
- Demo datasets for 6+ language families
- Single-page app, no framework, no build step

## Dataset

Bundled Meloni Romance dataset (`backend/data/romance_ipa.tsv`): cognate sets across Romanian, French, Italian, Spanish, Portuguese with Latin proto-forms in IPA transcription.

## API Reference

All endpoints are under `/api`.

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/dataset/sample` | Get sample entries from Romance dataset. Query params: `count` (default 20), `offset` (default 0) |
| GET | `/api/dataset/search` | Search dataset by IPA substring. Query param: `q` (required), `limit` (default 20) |
| POST | `/api/reconstruct` | Reconstruct proto-form. Body: `{"words": [...], "languages": [...]}` or `{"index": N}` for dataset entry |
| POST | `/api/reconstruct_tree` | Reconstruct full tree bottom-up. Body: `{"tree": {...}, "method": "ml"\|"algorithm"}` |
| GET | `/api/model/status` | Check if DPD ML model is loaded. Returns `{"available": true/false}` |
| POST | `/api/align` | Align IPA words. Body: `{"words": [...]}` |
| POST | `/api/ipa/distance` | Compute phonological distance between two words. Body: `{"word1": "...", "word2": "..."}` |
| POST | `/api/ipa/features` | Get articulatory feature vectors for a word. Body: `{"word": "..."}` |
| POST | `/api/date` | Estimate divergence date. Body: `{"cognate_pct": 0.6}` or `{"ned": 0.3}` |
| GET | `/api/date/curve` | Get retention rate curve data |
| GET | `/api/date/calibration` | Get calibration dates for known language splits |

## Project Structure

```
IPABrew/
├── backend/
│   ├── app/
│   │   ├── dpd/              # Vendored DPD model code
│   │   │   ├── lib/           # Data loading, utilities
│   │   │   └── models/        # Neural model definitions
│   │   ├── services/
│   │   │   └── dpd_service.py # Model singleton
│   │   ├── static/
│   │   │   ├── css/style.css
│   │   │   └── js/app.js
│   │   ├── templates/
│   │   │   └── index.html
│   │   ├── __init__.py        # App factory
│   │   ├── glottochronology.py
│   │   ├── ipa_utils.py
│   │   ├── reconstruction.py
│   │   └── routes.py
│   ├── data/
│   │   └── romance_ipa.tsv
│   ├── tests/                  # pytest test suite
│   └── run.py                 # Dev server entrypoint
├── model/
│   ├── checkpoints/
│   │   ├── epoch34.ckpt       # 77MB trained model
│   │   └── model_config.yaml  # Training configuration
│   ├── data/
│   │   └── combined/          # Training/eval data (pickle)
│   └── notebooks/
│       └── train_dpd.ipynb    # Google Colab training notebook
├── requirements.txt           # All Python dependencies
├── AGENT.md                   # AI agent development context
└── README.md
```

## Development

- **Dev server:** `cd backend && python run.py` (Flask debug mode on port 8080)
- The DPD model loads eagerly at startup. First boot takes a few seconds.
- To add demo language families, add data files and update the frontend's family selector in `app.js`.
- Model checkpoint and training details: see `model/README.md`.

## Credits

- **DPD BiReconstructor**: Lu, Xie & Mortensen (2024). "DPD: A Diverse, Paired and Dense Dataset for Proto-language Reconstruction." ACL 2024. [cmu-llab/dpd](https://github.com/cmu-llab/dpd)
- **LingPy**: List & Forkel. Sequence comparison in computational historical linguistics. [lingpy.org](https://lingpy.org)
- **panphon**: Mortensen, Dalmia & Littell. Panphon: a resource for mapping IPA segments to articulatory feature vectors. [github.com/dmort27/panphon](https://github.com/dmort27/panphon)
- **Meloni Romance dataset**: Meloni et al. (2021). "Ab Antiquo: Neural Proto-language Reconstruction." NAACL 2021.
