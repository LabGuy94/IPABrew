"""
Singleton wrapper for the DPD neural proto-language reconstruction model.

Loads the model once at import time (called during Flask app startup).
Provides predict_proto() for inference and is_available() to check status.
"""

import sys
import os
import types
import pickle
import logging
import tempfile
import threading

logger = logging.getLogger(__name__)

# ── Paths ──────────────────────────────────────────────────────────────────────
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_APP_DIR = os.path.dirname(_THIS_DIR)
_DPD_DIR = os.path.join(_APP_DIR, "dpd")
_BACKEND_DIR = os.path.dirname(_APP_DIR)
_PROJECT_ROOT = os.path.dirname(_BACKEND_DIR)
_CHECKPOINT_PATH = os.path.join(_PROJECT_ROOT, "model", "checkpoints", "epoch34.ckpt")
_DATA_DIR = os.path.join(_PROJECT_ROOT, "model", "data", "combined")
_CONFIG_PATH = os.path.join(_PROJECT_ROOT, "model", "checkpoints", "model_config.yaml")

# ── Module state ───────────────────────────────────────────────────────────────
_model = None
_dm = None
_load_lock = threading.Lock()
_loaded = False
_load_error = None


def _mock_wandb():
    """Inject a fake wandb module to prevent import errors from DPD code."""
    if "wandb" not in sys.modules:
        fake = types.ModuleType("wandb")
        fake.Api = None
        fake.init = lambda **kw: None
        fake.log = lambda **kw: None
        fake.require = lambda *a, **kw: None
        fake.Table = lambda **kw: None
        fake.Image = lambda **kw: None
        fake.WARNING = 30
        sys.modules["wandb"] = fake


def _files_exist():
    """Check that model checkpoint and training data are present."""
    return os.path.isfile(_CHECKPOINT_PATH) and os.path.isdir(_DATA_DIR)


def _load():
    """Load the DPD model. Must be called with _load_lock held."""
    global _model, _dm, _loaded, _load_error

    if not _files_exist():
        _load_error = "Model files not found"
        logger.warning(
            "DPD model files not found (checkpoint=%s, data=%s). "
            "ML reconstruction will be unavailable.",
            _CHECKPOINT_PATH,
            _DATA_DIR,
        )
        return

    _mock_wandb()


    try:
        import torch
        from app.dpd.lib.dataloader_manager import DataloaderManager
        from app.dpd.models.biDirReconIntegration import biDirReconModelTrans
        from app.dpd.models import biDirReconStrategies
        from app.dpd.models import utils as model_utils  # noqa: F841

        import yaml
        with open(_CONFIG_PATH) as f:
            CONFIG = yaml.safe_load(f)

        c = type("C", (), CONFIG)()

        dm = DataloaderManager(
            data_dir=os.path.abspath(_DATA_DIR),
            batch_size=c.batch_size,
            test_val_batch_size=c.test_val_batch_size,
            shuffle_train=False,
            lang_separators=c.d2p_use_lang_separaters,
            skip_daughter_tone=c.skip_daughter_tone,
            skip_protoform_tone=c.skip_protoform_tone,
            include_lang_tkns_in_ipa_vocab=True,
            transformer_d2p_d_cat_style=c.transformer_d2p_d_cat_style,
            daughter_subset=None,
            min_daughters=c.min_daughters,
            verbose=False,
            proportion_labelled=c.proportion_labelled,
            datasetseed=c.datasetseed,
            exclude_unlabelled=c.exclude_unlabelled,
        )

        strategy = getattr(
            biDirReconStrategies,
            c.strategy_config["strategy_class_name"],
        )(**c.strategy_config["strategy_kwargs"])

        model = biDirReconModelTrans.load_from_checkpoint(
            checkpoint_path=os.path.abspath(_CHECKPOINT_PATH),
            map_location=torch.device("cpu"),
            ipa_vocab=dm.ipa_vocab,
            lang_vocab=dm.lang_vocab,
            has_p2d=c.strategy_config["has_p2d"],
            d2p_num_encoder_layers=c.d2p_num_encoder_layers,
            d2p_num_decoder_layers=c.d2p_num_decoder_layers,
            d2p_nhead=c.d2p_nhead,
            d2p_dropout_p=c.d2p_dropout_p,
            d2p_inference_decode_max_length=c.d2p_inference_decode_max_length,
            d2p_max_len=c.d2p_max_len,
            d2p_feedforward_dim=c.d2p_feedforward_dim,
            d2p_embedding_dim=c.d2p_embedding_dim,
            p2d_num_encoder_layers=c.p2d_num_encoder_layers,
            p2d_num_decoder_layers=c.p2d_num_decoder_layers,
            p2d_nhead=c.p2d_nhead,
            p2d_dropout_p=c.p2d_dropout_p,
            p2d_inference_decode_max_length=c.p2d_inference_decode_max_length,
            p2d_max_len=c.p2d_max_len,
            p2d_feedforward_dim=c.p2d_feedforward_dim,
            p2d_embedding_dim=c.p2d_embedding_dim,
            p2d_all_lang_summary_only=c.p2d_all_lang_summary_only,
            use_xavier_init=True,
            lr=c.lr,
            max_epochs=c.max_epochs,
            warmup_epochs=c.warmup_epochs,
            beta1=c.beta1,
            beta2=c.beta2,
            eps=c.eps,
            weight_decay=c.weight_decay,
            universal_embedding=c.universal_embedding,
            universal_embedding_dim=c.universal_embedding_dim,
            strategy=strategy,
        )
        model.eval()

        _model = model
        _dm = dm
        _loaded = True
        logger.info(
            "DPD model loaded. %d languages, IPA vocab size %d.",
            len(dm.langs),
            len(dm.ipa_vocab),
        )

    except Exception as e:
        _load_error = str(e)
        logger.error("Failed to load DPD model: %s", e, exc_info=True)


# ── Public API ─────────────────────────────────────────────────────────────────


def init():
    """Eagerly load the model. Call once at app startup."""
    with _load_lock:
        if not _loaded and _load_error is None:
            logger.info("Loading DPD model from %s ...", _CHECKPOINT_PATH)
            _load()


def is_available() -> bool:
    """Return True if the model is loaded and ready for inference."""
    return _loaded and _model is not None


def predict_proto(cognates: dict[str, str]) -> str:
    """
    Predict a proto-form from a set of daughter-language IPA strings.

    Args:
        cognates: mapping of language name to IPA string,
                  e.g. {"French": "per", "Spanish": "padre"}

    Returns:
        Predicted proto-form as a joined string, e.g. "patrem".

    Raises:
        RuntimeError: if the model is not loaded.
        ValueError: if cognates is empty.
    """
    if not is_available():
        raise RuntimeError("DPD model is not available")
    if not cognates:
        raise ValueError("cognates must not be empty")

    # Tokenize IPA strings into character-level token lists.
    # The model was trained on character-level IPA tokens.
    cognate_set: dict[str, list[str]] = {}
    for lang, ipa_str in cognates.items():
        tokens = _tokenize_ipa(ipa_str)
        if tokens:
            cognate_set[lang] = tokens

    if not cognate_set:
        raise ValueError("No valid IPA tokens found in cognates")

    predicted_tokens = _predict_protoform(cognate_set)
    return "".join(predicted_tokens)


def _tokenize_ipa(ipa_str: str) -> list[str]:
    """
    Segment an IPA string into individual tokens.

    Uses panphon's FeatureTable.segs_safe() for proper IPA segmentation
    (handles digraphs, diacritics, etc.). Falls back to character-level
    split if panphon is unavailable.
    """
    ipa_str = ipa_str.strip()
    if not ipa_str:
        return []

    try:
        import panphon
        ft = panphon.FeatureTable()
        segments = ft.segs_safe(ipa_str)
        if segments:
            return segments
    except Exception:
        logger.debug("panphon segmentation failed for '%s', falling back to character-level", ipa_str, exc_info=True)

    # Fallback: character-level tokenization
    return list(ipa_str)


def _predict_protoform(cognate_set: dict[str, list[str]]) -> list[str]:
    """Run model inference on a single cognate set."""
    import torch
    from app.dpd.lib.dataset import DatasetConcat
    from app.dpd.models import utils as model_utils

    proto_lang = _dm.langs[0]

    # Build langs list that includes the user's language names so
    # DatasetConcat's daughter filtering doesn't discard them.
    user_langs = list(cognate_set.keys())
    langs_for_pickle = [proto_lang] + user_langs

    # Build a minimal single-entry dataset matching DPD's expected format
    fake_data = {
        0: {
            "daughters": cognate_set,
            "protoform": {proto_lang: ["?"]},
        }
    }

    with tempfile.NamedTemporaryFile(suffix=".pickle", delete=False) as f:
        pickle.dump((langs_for_pickle, fake_data), f)
        tmp_path = f.name

    try:
        dataset = DatasetConcat(
            lang_separators=False,  # Bypass lang_vocab assertion for user-provided language names;
            filepath=tmp_path,
            ipa_vocab=_dm.ipa_vocab,
            lang_vocab=_dm.lang_vocab,
            skip_daughter_tone=False,
            skip_protoform_tone=False,
            daughter_subset=None,
            min_daughters=1,
            verbose=False,
            proportion_labelled=1.0,
            transformer_d2p_d_cat_style=True,
            exclude_unlabelled=True,
        )

        batch = dataset.collate_fn([dataset[0]])

        N, s_tkns, s_langs, s_indv_lens, t_tkns, t_tkns_in, t_tkns_out, \
            t_ipa_lang, t_lang_lang, s_mask, t_mask, s_pad_mask, t_pad_mask = \
            model_utils.unpack_batch_for_transformer(
                batch, _model.d2p.device, "d2p",
                _model.d2p.ipa_vocab, _model.d2p.lang_vocab, _model.d2p.protolang
            )

        with torch.no_grad():
            prediction = _model.d2p.greedy_decode(
                s_tkns, s_indv_lens, s_langs, s_mask, s_pad_mask,
                decode_max_len=_model.d2p.inference_decode_max_length,
            )

        tokens = _model.d2p.ipa_vocab.to_tokens(prediction[0], remove_special=True)
        return tokens
    finally:
        os.unlink(tmp_path)
