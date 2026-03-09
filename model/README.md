# Model Directory

This directory contains the trained DPD neural reconstruction model, its training data, training notebook, and data processing scripts.

## Model Details

- **Architecture**: DPD BiReconstructor -- a bidirectional Transformer from Lu, Xie & Mortensen (2024) ([cmu-llab/dpd](https://github.com/cmu-llab/dpd))
- **Training objective**: Two directions trained jointly for invertibility: daughter-to-proto and proto-to-daughter
- **Selected checkpoint**: `epoch34.ckpt` (77MB)
- **Training data**: Combined SIGTYP 2022 + WikiHan datasets, aggregated into pickle files under `data/combined/`
- **Vocabulary**: 637 IPA tokens, 65 languages
- **Configuration**: `checkpoints/model_config.yaml` (extracted from the training run, not hardcoded)

## Training History

The current `epoch34.ckpt` was trained during the hackathon on Google Colab with an A100 GPU. The training notebook (`notebooks/train_dpd.ipynb`) contains the exact Colab cells used:

1. **Compatibility patches** for Python 3.12 + NumPy 2.x (np.float_ -> np.float64 etc.)
2. **Dependency installation** (pip install of all required packages)
3. **Upstream DPD repo cloning** from cmu-llab/dpd
4. **Data setup** from Google Drive (pre-processed pickle files)
5. **Smoke test** -- 5 epochs (~3 min) to validate the pipeline end-to-end
6. **Full training** -- ~75-100 min on A100, 50 max epochs with early stopping (converged at epoch 34)
7. **Checkpoint saving** back to Google Drive

## Directory Structure

```
model/
  checkpoints/
    epoch34.ckpt              # (77MB) Trained DPD BiReconstructor checkpoint
    model_config.yaml         # Training configuration (hyperparams, architecture)
  data/
    combined/                 # Runtime data (tracked in git)
      train.pickle            # Pre-processed training split
      dev.pickle              # Pre-processed dev split
      test.pickle             # Pre-processed test/evaluation split
    dpd_repo/                 # (gitignored) Upstream DPD research repository
    sigtyp/                   # (gitignored) SIGTYP 2022 shared task datasets
    lexibank/                 # (gitignored) Lexibank Carvalho Purus dataset
  notebooks/
    train_dpd.ipynb           # Google Colab training notebook (exact cells used)
  convert.py                  # Per-source data converters -> DPD pickle format
  merge.py                    # Merges per-source pickles -> data/combined/{train,dev,test}.pickle
```

## Data Pipeline

Raw sources are converted into the DPD pickle format in two stages:

1. **`convert.py`** -- reads each raw source (SIGTYP, WikiHan, Lexibank) and produces per-source pickle files with standardized cognate data structures
2. **`merge.py`** -- merges all per-source pickles into a single unified dataset with family-prefixed language names, then splits into `data/combined/{train,dev,test}.pickle`

The pipeline is: **raw sources -> `convert.py` -> per-source pickles -> `merge.py` -> `data/combined/{train,dev,test}.pickle`**

## What Is Tracked in Git

- `checkpoints/` and `data/combined/` are tracked in git for development convenience (the app needs them at runtime).
- `data/dpd_repo/`, `data/sigtyp/`, and `data/lexibank/` are gitignored (large reference/training repositories not needed at runtime).

## Obtaining Gitignored Data

If you need the gitignored datasets for retraining:

```bash
# Upstream DPD research repo
git clone https://github.com/cmu-llab/dpd data/dpd_repo

# SIGTYP 2022 shared task datasets
git clone https://github.com/sigtyp/ST2022 data/sigtyp

# Lexibank Carvalho Purus dataset -- obtain from Lexibank
# (data/lexibank/)
```

## Reproducing Training

1. Obtain the gitignored data (see above).
2. Run `convert.py` to produce per-source pickles, then `merge.py` to produce the combined splits.
3. Open `notebooks/train_dpd.ipynb` in Google Colab and follow the cells.
4. Training configuration is in `checkpoints/model_config.yaml`.
