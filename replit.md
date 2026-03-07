# Proto-Language Reconstruction App

## Overview

A web application for computational historical linguistics that reconstructs proto-language forms from Romance language cognates. Uses phonological alignment, sound correspondence patterns, distance-based tree building, glottochronological dating, and PanPhon articulatory features.

## Project Structure

All code for the Replit Agent's reconstruction app lives in `replit-agent-code/`. Other agents use other parts of the workspace.

- **Backend**: Python 3.12 + Flask, located in `replit-agent-code/backend/`
- **Frontend**: Vanilla JS + D3.js, served from `replit-agent-code/backend/app/templates/` and `replit-agent-code/backend/app/static/`
- **Entry point**: `replit-agent-code/backend/run.py`
- **App factory**: `replit-agent-code/backend/app/__init__.py`
- **Routes**: `replit-agent-code/backend/app/routes.py`
- **Core modules**:
  - `replit-agent-code/backend/app/reconstruction.py` — LingPy alignment, majority-vote reconstruction, correspondence pattern extraction, UPGMA distance-based tree building
  - `replit-agent-code/backend/app/ipa_utils.py` — PanPhon feature edit distance, normalized edit distance
  - `replit-agent-code/backend/app/glottochronology.py` — Swadesh retention rate dating, calibration points, NED-based divergence estimation
- **Dataset**: `replit-agent-code/backend/data/romance_ipa.tsv` — Meloni Romance dataset (4,147 cognate sets, 5 languages + Latin)

## Running the App

The workflow runs: `cd replit-agent-code/backend && python run.py`
Flask dev server starts on `0.0.0.0:5000`.

## Frontend Features

- **Reconstruct tab**: Enter cognate words, reconstruct proto-form, view convergence tree with animation, phonological alignment, sound correspondence patterns, pairwise distances
- **Dataset Explorer tab**: Browse/search 4,147 cognate sets, click any row to reconstruct
- **Divergence Dating tab**: Glottochronology calculator with calibration points and retention curve chart
- **IPA Distance tab**: Compute phonological distance between any two IPA words
- **Pronunciation**: Browser-based speech synthesis for IPA forms (via Web Speech API)

## API Endpoints

- `GET /api/health` — Health check
- `POST /api/reconstruct` — Reconstruct proto-form from cognates or dataset index
- `POST /api/align` — Align multiple IPA words
- `GET /api/dataset/sample?count=N&offset=N` — Paginated dataset browse
- `GET /api/dataset/search?q=QUERY` — Search dataset by IPA form
- `POST /api/ipa/distance` — Compute PanPhon feature distance between two words
- `POST /api/ipa/features` — Get articulatory features for a word
- `POST /api/date` — Estimate divergence years from cognate percentage or NED
- `GET /api/date/curve` — Get retention curve data points
- `GET /api/date/calibration` — Get calibration reference points

## Dependencies

- `flask>=3.0,<4.0`
- `flask-cors>=5.0,<6.0`
- `gunicorn>=23.0,<24.0`
- `lingpy` — Phonological alignment (Multiple Sequence Alignment)
- `lingrex` — Sound correspondence reconstruction (available but used as fallback)
- `panphon` — Articulatory feature-based IPA distance

## Deployment

Configured for autoscale deployment using gunicorn:
`gunicorn --bind=0.0.0.0:5000 --reuse-port --chdir replit-agent-code/backend run:app`

## Git Workflow

Collaborative project with multiple agents — each agent works in its own folder. Always pull before starting and push after finishing work.
