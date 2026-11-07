# Methodology - Sudarshan AI Detector

## Hybrid Detection Engine

### 1. Perplexity Analysis
- Uses distilgpt2 / gpt2 as surrogate scorer.
- Computes mean negative log-likelihood.
- AI text typically has lower perplexity under GPT-2 family.
- Mapping: log_ppl -> sigmoid to AI likelihood.
- Limitation: surrogate; true perplexity needs generator's own model (unavailable for closed models).

### 2. Burstiness Analysis
- Sentence length coefficient of variation (CV).
- TTR variance across sentences.
- Human: high burstiness (CV 0.5-1.0, varied lengths).
- AI: uniform (CV 0.2-0.5).
- AI likelihood = 1 - normalized burstiness.

### 3. Stylometric Analysis
- TTR, bigram repetition, function word ratio, paragraph CV.
- AI indicators: low repetition, very regular paragraph lengths, very high TTR + low para variance.
- Human indicators: higher para CV, repetition, occasional disfluency.

### 4. Transformer Classification
- Backbone: XLM-RoBERTa-base for multilingual, IndicBERT v2 for Hindi/Hinglish.
- Fine-tuned on binary human vs AI.
- Requires training pipeline in scripts/train.py.
- Fallback to statistical if weights missing.

### 5. Zero-Shot Detection
- Hapax legomena ratio, sentence start diversity.
- AI avoids rare words and has lower start diversity.

### 6. Perturbation (DetectGPT / Fast-DetectGPT)
- Original log p(x) vs mean log p(perturbed x).
- Curvature z-score = (log p_orig - mean log p_pert)/std.
- Positive curvature => AI.
- Optional T5 for perturbation, GPT-2 for scoring. Experimental, high compute.

### 7. Watermark Detection
- Kirchenbauer et al. green-list.
- Requires watermark key. Without key, generic heuristic only.
- Never claims certainty.

### 8. Mixed-Authorship
- Sliding window over paragraphs (or 3-sentence chunks).
- Per-section burstiness+stylometry.
- Variance >0.05 and range >0.3 => mixed.

### 9. Multilingual
- Language detection via langdetect + Hindi char regex + Hinglish marker lexicon.
- IndicBERT v2 tokenizer handles Devanagari + transliteration.
- Thresholds adjusted for Hindi/Hinglish (lower FPR priority).

### 10. Provenance
- Checks metadata for C2PA manifest, watermark meta.
- Text alone cannot be cryptographically verified.
- Future: integrate C2PA verification.

## Fusion
- Weighted average with calibration.
- Default weights: perplexity 0.25, burstiness 0.20, stylometry 0.20, transformer 0.25, zero_shot 0.10
- Confidence = 1 - 2*std(scores)
- Calibrated = 0.5 + (raw-0.5)*confidence (shrink to 0.5 on disagreement)
- Classification: >=0.65 AI, <=0.35 Human, else Mixed/Inconclusive.
- Short text override: <50 words + low confidence => Inconclusive.

## Training Considerations
- Prevent contamination via source-level dedup and generator-held-out.
- Datasets: HC3, M4, RAID, TuringBench + custom Hindi/Hinglish.
- Cross-domain, cross-language eval.
- Calibration via isotonic regression on held-out.
- Low FPR prioritized for non-native writers.
