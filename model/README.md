# Model Directory

This directory contains the trained DPD neural reconstruction model and its training data.

## Directory Structure

```
model/
  checkpoints/
    epoch34.ckpt          # (77MB) Trained DPD BiReconstructor model checkpoint
  data/
    combined/             # Runtime data (tracked in git)
      train.pickle        # Pre-processed training split
      dev.pickle          # Pre-processed dev split
      test.pickle         # Pre-processed test/evaluation split
    dpd_repo/             # (gitignored) Upstream DPD research repository from cmu-llab/dpd
    sigtyp/               # (gitignored) SIGTYP 2022 shared task datasets
    lexibank/             # (gitignored) Lexibank Carvalho Purus dataset
```

## Model Details

- **Architecture**: DPD BiReconstructor -- a bidirectional Transformer from Lu, Xie & Mortensen (2024)
- **Training objective**: Two directions trained jointly for invertibility: daughter-to-proto and proto-to-daughter
- **Selected checkpoint**: Epoch 34
- **Training data**: Combined SIGTYP 2022 + WikiHan datasets, aggregated into the pickle files under `data/combined/`
- **Vocabulary**: 637 IPA tokens, 65 languages

## What Is Tracked in Git

- `checkpoints/` and `data/combined/` are tracked in git for development convenience (the app needs them at runtime).
- `data/dpd_repo/`, `data/sigtyp/`, and `data/lexibank/` are gitignored (large reference/training repositories not needed at runtime).

## Reproducing Training

1. Clone the upstream DPD repo into `data/dpd_repo/`.
2. The data aggregation pipeline combines SIGTYP and WikiHan sources into the pickle files in `data/combined/`.
3. Training configuration is hardcoded in `backend/app/services/dpd_service.py` (the `CONFIG` dict).
4. See the upstream dpd repo README for full training instructions.

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
