# AGENT.md

## Project

IPABrew -- proto-language reconstruction web app. Reconstructs ancestral word forms from cognate words across related languages using neural ML models and traditional linguistic algorithms.

## Stack

Python 3.11+, Flask, vanilla JS, D3.js v7. No build step for frontend.

## How to Run

```
cd backend && python run.py
```

Serves at http://localhost:8080. DPD model loads eagerly at startup.

## Key Files

- `backend/app/__init__.py` -- Flask app factory, registers blueprint, loads DPD model
- `backend/app/routes.py` -- all API endpoints (12 routes under /api)
- `backend/app/reconstruction.py` -- core reconstruction logic (ML + algorithmic paths)
- `backend/app/services/dpd_service.py` -- DPD model loading and inference singleton
- `backend/app/glottochronology.py` -- divergence dating (Swadesh formula + NED table)
- `backend/app/ipa_utils.py` -- IPA feature distance (panphon wrapper)
- `backend/app/dpd/` -- vendored DPD model code (from cmu-llab/dpd)
- `backend/app/templates/index.html` -- single-page app HTML
- `backend/app/static/js/app.js` -- all frontend logic
- `backend/app/static/css/style.css` -- all styles
- `backend/data/romance_ipa.tsv` -- bundled Meloni Romance dataset
- `model/checkpoints/epoch34.ckpt` -- trained model checkpoint (77MB)
- `model/data/combined/` -- pre-processed training/eval data (pickle files)
- `model/checkpoints/model_config.yaml` -- training configuration (hyperparams, architecture)
- `model/notebooks/train_dpd.ipynb` -- Google Colab training notebook
- `backend/tests/` -- pytest test suite

## Architecture Notes

- DPD model loads eagerly at startup via `dpd_service.init()` in the app factory
- Vendored DPD code (`backend/app/dpd/`) uses relative imports patched for our directory layout
- `reconstruction.py` handles both ML and algorithmic reconstruction paths
- ML path: calls `dpd_service.predict_proto()` for neural inference
- Algorithmic path: LingPy `Multiple.prog_align()` + majority vote
- Frontend is a single-page app -- no framework, no client-side routing, no build step
- All frontend state lives in the DOM
- The app serves `templates/index.html` at `/` and mounts the API blueprint at `/api`

## Testing

```
cd backend && python -m pytest tests/ -v
```

## Known Issues

- wandb is mocked out since the vendored DPD code imports it but we don't use it
- The venv in `backend/venv/` is Python 3.11 but works with 3.12+
