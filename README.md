Proto-language reconstruction hackathon: a complete technical blueprint
A single-day hackathon can produce a working proto-form reconstructor by combining LingPy/
LingRex's SVM-based pipeline with the Meloni Romance cognate dataset, a D3.js convergence tree, and
eSpeak-based IPA pronunciation. This report synthesizes research across all seven areas — algorithms,

datasets, IPA tooling, glottochronology, visualization, TTS, and existing tools — into a concrete, dependency-
ordered build plan. The Python ecosystem for computational historical linguistics is remarkably mature: pip

install lingpy lingrex panphon gets you 80% of the way to a working prototype.

The algorithm decision: LingRex SVM for safety, CMU Transformer for wow factor
Three families of reconstruction algorithms exist, each with distinct hackathon tradeoffs.
Rule-based methods encode sound change laws (Grimm's Law, Latin rhotacism, palatalization) as
programmatic transformations. The simplest representation uses regex over IPA strings — for example, Latin
intervocalic rhotacism becomes re.sub(r'(?<=[aeiouɛɔ])s(?=[aeiouɛɔ])', 'r', word) . More powerful
representations use finite-state transducers (FSTs) via Foma, HFST ( pip install hfst ), or Pynini ( pip install
pynini ), which support rule composition and — critically — inversion, enabling you to reverse sound changes
for reconstruction. PanPhon enables feature-based rules where changes operate on articulatory features

like [+voiced] or [+continuant] rather than individual characters. For a hackathon, rule-
based approaches are fast to prototype (2–4 hours) but accuracy depends entirely on the quality and

completeness of your hand-coded rules.
ML/Neural approaches have exploded since 2021. The key papers and codebases, almost all from CMU's
ChangeLing Lab (https://github.com/cmu-llab), form a clear progression:
• Meloni et al. 2021 (NAACL) — GRU encoder-decoder with attention, trained on 8,799
Romance cognate sets → Latin. PyTorch reimplementation at cmu-llab/meloni-2021-
reimplementation .
• Kim et al. 2023 (ACL) — Replaces GRU with Transformer, adds language
embeddings. Code at cmu-llab/acl-2023 . Best balance of accessibility and
performance for a hackathon.
• Akavarapu & Bhattacharya 2023 (EMNLP) — "Cognate Transformer" adapted from protein language
modeling, using HuggingFace transformers .
• Lu, Xie & Mortensen 2024 (ACL) — Semi-supervised DPD-BiReconstructor enforcing
invertibility between daughter→proto and proto→daughter directions. Code at cmu-llab/dpd .
• Lu, Wang & Mortensen 2024 (LREC-COLING) — Reranks beam search candidates using reflex
prediction. Code at cmu-llab/reranked-reconstruction with HuggingFace
checkpoints available.

Wikibooks

PyPI

GitHub ACL Anthology

arXiv +2

arXiv +2

Changelinglab arXiv

arXiv +2 GitHub

arXiv

GitHub
arXiv

Changelinglab Semantic Scholar
GitHub

Neural approaches need 4–8 hours with existing code and a GPU. Training the Kim 2023 Transformer on the
Romance dataset takes ~1–2 hours on a modern GPU.
The hybrid sweet spot — LingRex ( pip install lingrex ) combines SCA-based phonological alignment (via
LingPy) with SVM classification of sound correspondence patterns. It first aligns cognate sets into
correspondence columns, extracts features from each column, then classifies the most likely proto-phoneme.

This was the baseline for the SIGTYP 2022 Shared Task and takes 3–5 hours to implement with pre-
existing CLDF data. This is the recommended primary approach — it's pip-installable, well-documented,

and produces linguistically interpretable results without GPU requirements.
Approach Time to implement Accuracy GPU needed Wow factor
Rule-based (regex/PanPhon) 2–4 hrs Low-medium No Medium
LingRex SVM (recommended) 3–5 hrs Medium-high No Medium-high
CMU Transformer (stretch goal) 4–8 hrs High Yes Very high
Bayesian probabilistic Not feasible Very high Yes —

Datasets ready for immediate use
The field has converged on a handful of benchmark datasets, all accessible programmatically in Python.
The Meloni Romance dataset (https://github.com/shauli-ravfogel/Latin-Reconstruction-NAACL) contains
8,799 cognate sets across 5 Romance languages (Romanian, French, Italian, Spanish, Portuguese) with
Latin as the proto-form, available in both orthographic and IPA. This is the most widely
used benchmark — every major paper since 2021 evaluates on it. TSV format, trivially loadable with
pandas.read_csv() .
WikiHan (https://github.com/cmu-llab/wikihan) provides 67,943 entries across 8 Chinese varieties with
Middle Chinese as the proto-language. It's the largest reconstruction benchmark, pre-split into
train/dev/test. TSV with IPA transcriptions.
SIGTYP 2022 Shared Task data (https://github.com/sigtyp/ST2022) delivers 20 cognate-coded wordlists
spanning 6+ language families (Bai, Burmish, Karen, Lalo, Purus, Romance) in CLDF format.
Includes baseline code, evaluation scripts, and a Python package: from sigtypst2022 import
load_cognate_file . This is the best resource for multi-family evaluation.
IE-CoR (https://github.com/lexibank/iecor, the IELex successor) provides 1,600+
cognate sets across Indo-European with Proto-Indo-European reconstructions, phonemic transcriptions, and
citations from LIV2 and NIL. CLDF format, CC-BY-4.0, loadable via pycldf . PILA (https://github.com/
Mythologos/PILA) offers ~5,776 Proto-Italic ↔ Latin forms in CLDF.
GitHub +3

arXiv

Semantic Scholar arXiv

ACL Anthology

GitHub GitHub

GitHub

GitHub

Max Planck Institute for Evolut...

Clld

Semantic Scholar

Datasets that do not include proto-forms (useful for other purposes but not for supervised reconstruction
training): CogNet (8.1M cognate pairs, 338 languages, orthographic only), ASJP (11,540 varieties,
simplified 41-symbol transcription), CLICS (colexification patterns, no cognacy),
and NorthEuraLex (107 languages, IPA transcriptions, but no cognacy annotations in current version).

For the hackathon, start with the Meloni Romance dataset. It's small enough to train on quickly, has clear
proto-forms (Latin), and every existing tool has been tested against it.

The IPA processing stack: panphon + lingpy + pyclts
Three libraries form the essential IPA processing pipeline, each handling a different layer.
PanPhon ( pip install panphon ) is the foundation. It maps 5,000+ IPA segments to 21-dimensional
articulatory feature vectors (binary features like [±voiced], [±nasal], [±continuant])
and provides multiple distance metrics. The critical function for reconstruction is
panphon.distance.Distance().feature_edit_distance('θɪŋ', 'sɪn') , which computes edit distance where substitution costs
are proportional to the Hamming distance between feature vectors — phonologically similar sounds cost less to
substitute. PanPhon also supports Dolgopolsky-class distance, fast Levenshtein, and weighted feature edit
distance. 288 GitHub stars, actively maintained by David Mortensen at CMU, last release June
2025. A Rust-accelerated version exists as panphon2 .

LingPy ( pip install lingpy ) handles alignment and cognate detection. Its ipa2tokens() correctly
segments IPA strings (handling affricates like t͡ʃ), tokens2class() maps segments to sound classes (SCA,
Dolgopolsky, ASJP), and its SCA alignment algorithm produces phonologically-informed multiple sequence
alignments — the critical preprocessing step before reconstruction. LexStat provides automatic cognate
detection using permutation-based scoring.

GitHub

ScienceDirect +2 ResearchGate

Clld
Springer ResearchGate

PyPI
GitHub ACL Anthology

GitHub

PyPI Nfshost

PyPI

python
import panphon
ft = panphon.FeatureTable()
ft.word_fts('pater') # Feature vectors for each segment
import panphon.distance
dst = panphon.distance.Distance()
dst.feature_edit_distance('pater', 'fader') # Phonologically-weighted distance

GitHub

Oxford Academic

python
from lingpy import ipa2tokens, tokens2class
tokens = ipa2tokens('t͡sɔyɡə') # → ['t͡s', 'ɔy', 'ɡ', 'ə']
classes = tokens2class(tokens, 'sca') # → ['C', 'U', 'K', 'E']

pyclts ( pip install pyclts ) with SoundVectors ( pip install soundvectors ) normalizes heterogeneous transcription
data to canonical Broad IPA (BIPA) and generates 39-dimensional feature vectors dynamically — even for
sounds not in PanPhon's fixed inventory. This is essential when working with data from multiple
sources that use different transcription conventions.
Supporting libraries: epitran ( pip install epitran ) converts orthographic text to IPA for 61+ languages
— useful when input data lacks phonetic transcription. segments ( pip install segments ) provides

robust IPA tokenization with orthography profile support.

Glottochronology: a 50-line dating module
Classical glottochronology estimates divergence time from the proportion of shared cognates

using the formula t = ln(c) / (2 × ln(r)), where c is the cognate retention proportion and r is
the per-millennium retention rate (0.86 for the 100-word Swadesh list). The factor of 2
accounts for independent change in both lineages.

At 60% shared cognates (English–German on the 100-word list), this yields ~1,561 years — placing the split
around 400 CE, consistent with the Anglo-Saxon migration period. The retention curve predicts
74% at 1,000 years, 55% at 2,000 years, 30% at 4,000 years, and 5% at 10,000 years (the
practical limit).
For estimating divergence from phonological distance of individual cognate pairs rather than cognate counts,
use normalized edit distance mapped through calibration points:
NED range Approximate divergence Example
0.0–0.1 0–500 years Dialects
0.1–0.3 500–1,500 years Romance languages
0.3–0.5 1,500–3,000 years Germanic family
0.5–0.7 3,000–5,000 years IE subfamilies
0.7+ 5,000+ years Deep/uncertain

Hypotheses

Academia.edu

GitHub

Encyclopedia Britannica

Wikipedia Grokipedia

python
import math
def estimate_divergence_years(cognate_pct, retention_rate=0.86):
"""Returns estimated years since divergence."""
if cognate_pct <= 0 or cognate_pct >= 1: return None
return (math.log(cognate_pct) / (2 * math.log(retention_rate))) * 1000

iResearchNet

Wikipedia

Pagel et al. 2013 found regular sound changes in Turkic accumulate at ~0.0026 per year (~1 every 385 years),
following a Poisson process. This provides a principled basis for mapping phonological distance
to time.
Known limitations are significant. Retention rates vary wildly — Icelandic replaces ~4% per millennium
versus Norwegian's ~20%. Borrowing inflates apparent cognacy. Modern Bayesian
phylogenetic methods (Gray & Atkinson 2003, Bouckaert et al. 2012) address these issues using MCMC with
relaxed clock models calibrated against archaeological dates, but require days of compute
and deep expertise. For the hackathon, the classical formula with clearly stated uncertainty bounds is the right
choice. Swadesh lists are available programmatically via nltk.corpus.swadesh (20+ languages) and the
Concepticon project.
Key calibration dates: Romance from Latin ~1,500–2,000 years; Proto-Germanic ~2,500 years; Balto-Slavic
~3,000–4,000 years; PIE (Steppe hypothesis) ~5,500–6,500 years; Austronesian ~5,200 years.

D3.js for animated convergence trees
D3.js with d3-hierarchy is the clear winner for the frontend visualization. Its SVG rendering ensures IPA and
Unicode characters display perfectly (unlike Canvas-based alternatives like vis.js), and its transition system
enables step-by-step animation of convergence — nodes appearing progressively as two modern words
converge toward a reconstructed proto-form.
A minimal convergence tree requires ~40 lines of code:

Load via CDN ( https://d3js.org/d3.v7.min.js ) — no build step needed. For the convergence animation,
start with leaf nodes visible and use setTimeout or button clicks to progressively reveal parent nodes with
smooth SVG transitions.

PubMed Central

Wikipedia Wikipedia

Nature Language Log

javascript
const data = {
name: "*bhréh2tēr", // Reconstructed proto-form at root
children: [
{ name: "Step 2: *brāter", children: [{ name: "English: brother" }] },
{ name: "Step 2: *frāter", children: [{ name: "Latin: frāter" }] }
]
};
const tree = d3.tree().size([500, 300]);
const root = d3.hierarchy(data);
tree(root);
// Draw links, nodes, labels with d3.select()...
// Animate with .transition().duration(750)

Carleton

Fallback option: Treeflex (https://dumptyd.github.io/treeflex/) produces a static CSS-only tree from nested
HTML lists with a single CSS import — implementable in 5 minutes if animation gets cut from scope.
Avoid vis.js (Canvas struggles with Unicode), Cytoscape.js (overcomplicated for simple trees),
and Phylotree.js (wrong domain format).

ElevenLabs supports IPA — with caveats
ElevenLabs does accept IPA input via SSML phoneme tags, but only with specific models
and only for English phonemes. The required format:

Critical constraints: Works only with Eleven Turbo v2, Flash v2, or English v1 models. Supports
English phonemes only — proto-language sounds outside English's inventory (aspirated stops like *bh,
laryngeals like *h2) need approximation. CMU Arpabet is reportedly more consistent than IPA for
English.
The recommended hackathon strategy is a tiered approach. Start with eSpeak-ng.js — an open-source
speech synthesizer compiled to JavaScript that runs entirely in the browser with no API key. A
ready-made IPA-to-speech tool exists at https://itinerarium.github.io/phoneme-synthesis/ (MIT
licensed, forkable). Sound quality is robotic but phonetically accurate, and it handles non-English phonemes
that ElevenLabs cannot. Implementation takes ~30 minutes. Then add ElevenLabs as a "premium voice" toggle
for natural-sounding output where English-approximate pronunciation is acceptable.

Amazon Polly and Google Cloud TTS also support IPA via SSML with broader language
coverage, but require AWS/GCP credentials.
Dumptyd
GitHub LARUS

elevenlabs Mintlify

xml
<phoneme alphabet="ipa" ph="bhreːtɛːr">protoword</phoneme>

elevenlabs

ElevenLabs

elevenlabs ElevenLabs

Albertopettarin
Itinerarium

javascript
async function pronounceIPA(ipa, text) {
if (useElevenLabs && API_KEY) {
const ssml = `<phoneme alphabet="ipa" ph="${ipa}">${text}</phoneme>`;
const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
method: 'POST',
headers: { 'Content-Type': 'application/json', 'xi-api-key': API_KEY },
body: JSON.stringify({ text: ssml, model_id: 'eleven_turbo_v2' })
});
new Audio(URL.createObjectURL(await resp.blob())).play();
} else {
// Fallback: eSpeak in browser via meSpeak.js
}
}

AWS Murf AI
Zuplo

Existing tools that do the heavy lifting

The ecosystem is more complete than most people realize. LingRex ( pip install lingrex ) is the only pip-
installable package that performs actual proto-form prediction — not just alignment or cognate detection.

It implements the SVM-based reconstruction from List, Forkel & Hill 2022, using trimmed alignments
and sound correspondence pattern classification. It builds directly on LingPy ( pip install lingpy ), which
handles the prerequisite steps: SCA alignment, cognate detection (LexStat), and multiple sequence alignment.

Together, they provide a complete reconstruction pipeline that takes CLDF data in and produces proto-
forms out.

The CMU ChangeLing Lab repositories (https://github.com/cmu-llab) contain the most advanced neural
reconstruction implementations: acl-2023 (Transformer), meloni-2021-reimplementation (GRU), dpd
(semi-supervised), and reranked-reconstruction (with HuggingFace checkpoints). All are PyTorch-based
and well-structured research code.
EDICTOR (https://edictor.digling.org/) is a web-based annotation tool for etymological datasets
that integrates with LingRex results — useful for visualization but not automated reconstruction. CAPR
(https://github.com/knightss27/capr) combines LingPy with Foma FSTs for Proto-Burmese reconstruction
but requires Docker and is domain-specific.

Conclusion: the build order for hackathon day
The optimal build sequence, mapped to a single day:
Hours 1–2: Set up Python environment ( pip install lingpy lingrex panphon pycldf ), download the Meloni
Romance dataset, load and explore it. Get LingPy alignment working on a few cognate sets.
Hours 3–5: Implement the reconstruction pipeline — either LingRex's SVM approach (safe path) or begin
training the CMU Transformer (ambitious path). Implement the glottochronology module (~50 lines). Wire up
the Flask/FastAPI backend with endpoints for reconstruction and dating.
Hours 6–8: Build the HTML/JS frontend: D3.js convergence tree, input form for cognate pairs, IPA
pronunciation via eSpeak-ng.js. Connect frontend to backend API.
Hours 9–10: Polish, add ElevenLabs premium voice toggle if time permits, test with diverse cognate pairs,
handle edge cases, prepare demo.
The single most important insight from this research: you don't need to build a reconstruction algorithm
from scratch. LingRex + LingPy + the Meloni dataset gives you a working, published-at-ACL reconstruction
system in under 100 lines of glue code. The hackathon's real value-add is the interactive visualization,
pronunciation playback, and divergence dating — the layers that transform a command-line research tool into
an engaging, accessible web application.
