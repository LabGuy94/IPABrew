# Proto-Language Reconstruction App

## Overview

A Flask-based backend API for proto-language reconstruction. The project is designed as a hackathon blueprint for computational historical linguistics, combining phonological alignment, cognate detection, and proto-form reconstruction.

## Architecture

- **Backend**: Python 3.12 + Flask, located in `backend/`
- **Entry point**: `backend/run.py`
- **App factory**: `backend/app/__init__.py`
- **Routes**: `backend/app/routes.py`

## Running the App

The workflow runs: `cd backend && python run.py`

The Flask development server starts on `0.0.0.0:5000`.

## API Endpoints

- `GET /api/health` — Health check, returns `{"status": "ok"}`

## Dependencies

- `flask>=3.0,<4.0`
- `flask-cors>=5.0,<6.0`
- `gunicorn>=23.0,<24.0`

## Deployment

Configured for autoscale deployment using gunicorn:
`gunicorn --bind=0.0.0.0:5000 --reuse-port --chdir backend run:app`
