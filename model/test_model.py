#!/usr/bin/env python3
"""
Standalone inference script for the trained DPD model.
No wandb, no config.pkl needed. Runs on CPU (M2 Mac is fine).

Usage:
    python model/test_model.py --ckpt path/to/epoch34.ckpt

Requires: the DPD repo at model/data/dpd_repo and data at model/data/combined/
"""
import sys, os, pickle, argparse

# Block wandb from ever loading
import types
_fake_wandb = types.ModuleType('wandb')
_fake_wandb.Api = None
_fake_wandb.init = lambda **kw: None
_fake_wandb.log = lambda **kw: None
_fake_wandb.require = lambda *a, **kw: None
_fake_wandb.Table = lambda **kw: None
_fake_wandb.Image = lambda **kw: None
_fake_wandb.WARNING = 30
sys.modules['wandb'] = _fake_wandb

# Add DPD repo to path
DPD_DIR = os.path.join(os.path.dirname(__file__), 'data', 'dpd_repo')
sys.path.insert(0, DPD_DIR)

import torch
import pytorch_lightning as pl
from lib.dataloader_manager import DataloaderManager
from models.biDirReconIntegration import biDirReconModelTrans
import models.biDirReconStrategies
import models.utils as utils
from specialtokens import BOS_IDX, EOS_IDX, PAD_IDX

# ── Config from training run (hardcoded, no config.pkl needed) ──────────
CONFIG = dict(
    dataset='combined',
    batch_size=256,
    test_val_batch_size=128,
    min_daughters=1,
    skip_daughter_tone=False,
    skip_protoform_tone=False,
    d2p_use_lang_separaters=True,
    p2d_all_lang_summary_only=True,
    proportion_labelled=1.0,
    transformer_d2p_d_cat_style=True,
    exclude_unlabelled=True,
    use_xavier_init=True,
    lr=0.0007,
    max_epochs=50,
    warmup_epochs=5,
    beta1=0.9,
    beta2=0.999,
    eps=1e-08,
    weight_decay=1e-07,
    architecture='Transformer',
    d2p_num_encoder_layers=2,
    d2p_num_decoder_layers=2,
    d2p_embedding_dim=384,
    d2p_nhead=8,
    d2p_feedforward_dim=512,
    d2p_dropout_p=0.16,
    d2p_max_len=128,
    d2p_inference_decode_max_length=30,
    p2d_num_encoder_layers=2,
    p2d_num_decoder_layers=2,
    p2d_embedding_dim=384,
    p2d_nhead=8,
    p2d_feedforward_dim=512,
    p2d_dropout_p=0.34,
    p2d_max_len=128,
    p2d_inference_decode_max_length=30,
    universal_embedding=True,
    universal_embedding_dim=256,
    datasetseed=850145356,
    strategy_config=dict(
        strategy_class_name='GreedySampleCringeBackpropThroughout',
        has_p2d=True,
        strategy_kwargs=dict(
            d2p_recon_loss_weight=0.63,
            d2p_kl_loss_weight=0.5,
            emb_pred_loss_weight=0.5,
            p2d_loss_on_gold_weight=0.63,
            p2d_loss_on_pred_weight=1.2,
            cringe_alpha=0.38,
            cringe_k=1,
            alignment_convolution_masking=False,
            convolution_masking_residue=0.2,
            enable_pi_model=False,
            pi_consistency_type=None,
            pi_consistency_rampup_length=None,
            pi_max_consistency_scaling=None,
            pi_proportion_labelled=None,
        ),
        strategy_checkpoint_method=None,
        early_stopping_method=None,
    ),
)


def load_model(ckpt_path: str, data_dir: str):
    """Load the trained model and data manager."""
    c = type('C', (), CONFIG)()  # attribute-style access

    # Need to chdir so DPD's relative data paths resolve
    original_dir = os.getcwd()
    os.chdir(DPD_DIR)

    dm = DataloaderManager(
        data_dir=data_dir,
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

    strategy = getattr(models.biDirReconStrategies, c.strategy_config['strategy_class_name'])(
        **c.strategy_config['strategy_kwargs']
    )

    model = biDirReconModelTrans.load_from_checkpoint(
        checkpoint_path=ckpt_path,
        map_location=torch.device('cpu'),
        ipa_vocab=dm.ipa_vocab,
        lang_vocab=dm.lang_vocab,
        has_p2d=c.strategy_config['has_p2d'],
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
    os.chdir(original_dir)
    return model, dm


def predict_protoform(model, dm, cognate_set: dict[str, list[str]]):
    """
    Predict a proto-form from daughter cognates.
    
    Args:
        cognate_set: {language_name: [ipa_tokens]} e.g.
            {"Romance_French": ["p", "ɛ", "ʁ"],
             "Romance_Spanish": ["p", "a", "d", "ɾ", "e"],
             "Romance_Italian": ["p", "a", "d", "r", "e"]}
    
    Returns:
        list of IPA tokens for the predicted proto-form
    """
    # Build a minimal dataset entry matching DPD's expected format
    proto_lang = dm.langs[0]  # "Proto"
    
    # Create a fake single-item dataset entry
    fake_data = {
        0: {
            "daughters": cognate_set,
            "protoform": {proto_lang: ["?"]},  # dummy, will be ignored in inference
        }
    }
    
    # Save temp pickle, load via dataset
    import tempfile
    with tempfile.NamedTemporaryFile(suffix='.pickle', delete=False) as f:
        pickle.dump((dm.langs, fake_data), f)
        tmp_path = f.name
    
    try:
        from lib.dataset import DatasetConcat
        dataset = DatasetConcat(
            lang_separators=True,
            filepath=tmp_path,
            ipa_vocab=dm.ipa_vocab,
            lang_vocab=dm.lang_vocab,
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
            utils.unpack_batch_for_transformer(
                batch, model.d2p.device, 'd2p',
                model.d2p.ipa_vocab, model.d2p.lang_vocab, model.d2p.protolang
            )
        
        with torch.no_grad():
            prediction = model.d2p.greedy_decode(
                s_tkns, s_indv_lens, s_langs, s_mask, s_pad_mask,
                decode_max_len=model.d2p.inference_decode_max_length
            )
        
        tokens = model.d2p.ipa_vocab.to_tokens(prediction[0], remove_special=True)
        return tokens
    finally:
        os.unlink(tmp_path)


def run_test_samples(model, dm, n=20):
    """Run model on n test set examples and show gold vs predicted."""
    dataset = dm.test_set
    n = min(n, dataset.length)
    
    print(f"\n{'='*70}")
    print(f"  Proto-form Reconstruction — {n} test samples")
    print(f"{'='*70}\n")
    
    correct = 0
    for i in range(n):
        batch = dataset.collate_fn([dataset[i]])
        
        N, s_tkns, s_langs, s_indv_lens, t_tkns, t_tkns_in, t_tkns_out, \
            t_ipa_lang, t_lang_lang, s_mask, t_mask, s_pad_mask, t_pad_mask = \
            utils.unpack_batch_for_transformer(
                batch, model.d2p.device, 'd2p',
                model.d2p.ipa_vocab, model.d2p.lang_vocab, model.d2p.protolang
            )
        
        with torch.no_grad():
            prediction = model.d2p.greedy_decode(
                s_tkns, s_indv_lens, s_langs, s_mask, s_pad_mask,
                decode_max_len=model.d2p.inference_decode_max_length
            )
        
        gold_tokens = model.d2p.ipa_vocab.to_tokens(t_tkns[0], remove_special=True)
        pred_tokens = model.d2p.ipa_vocab.to_tokens(prediction[0], remove_special=True)
        
        gold_str = ''.join(gold_tokens)
        pred_str = ''.join(pred_tokens)
        match = "✓" if gold_str == pred_str else "✗"
        if gold_str == pred_str:
            correct += 1
        
        # Show daughters
        daughters = dataset.D[i]
        daughter_strs = []
        for lang, tokens in daughters.items():
            daughter_strs.append(f"    {lang}: {''.join(tokens)}")
        
        print(f"[{match}] Sample {i+1}")
        for ds in daughter_strs:
            print(ds)
        print(f"    Gold:      {gold_str}")
        print(f"    Predicted: {pred_str}")
        print()
    
    print(f"Accuracy: {correct}/{n} ({100*correct/n:.1f}%)")


def main():
    parser = argparse.ArgumentParser(description='Test trained DPD model')
    parser.add_argument('--ckpt', required=True, help='Path to .ckpt file')
    parser.add_argument('--data', default=os.path.join(os.path.dirname(__file__), 'data', 'combined'),
                        help='Path to combined data directory')
    parser.add_argument('-n', type=int, default=20, help='Number of test samples')
    args = parser.parse_args()

    print("Loading model...")
    model, dm = load_model(os.path.abspath(args.ckpt), os.path.abspath(args.data))
    print(f"Model loaded. {len(dm.langs)} languages, proto={dm.langs[0]}")
    print(f"IPA vocab: {len(dm.ipa_vocab)} tokens")

    run_test_samples(model, dm, n=args.n)

    # Interactive demo
    print("\n" + "="*70)
    print("  Interactive mode — enter cognates to reconstruct proto-forms")
    print("  Format: LangName:token1,token2,token3")
    print("  Example: Romance_French:p,ɛ,ʁ")
    print("  Enter multiple languages, one per line. Empty line to predict.")
    print("  Type 'quit' to exit.")
    print("="*70 + "\n")

    while True:
        cognates = {}
        print("Enter cognates (empty line to predict):")
        while True:
            line = input("  > ").strip()
            if line.lower() == 'quit':
                return
            if not line:
                break
            if ':' not in line:
                print("    Format: LangName:token1,token2,token3")
                continue
            lang, tokens_str = line.split(':', 1)
            tokens = [t.strip() for t in tokens_str.split(',') if t.strip()]
            cognates[lang.strip()] = tokens
            print(f"    Added {lang.strip()}: {tokens}")

        if cognates:
            proto = predict_protoform(model, dm, cognates)
            print(f"\n  → Proto: {''.join(proto)}")
            print(f"    Tokens: {proto}\n")


if __name__ == '__main__':
    main()
