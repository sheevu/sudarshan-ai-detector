# Benchmarks

## Metrics
- AUROC
- AUPRC
- Precision, Recall
- FPR, FNR (focus on low FPR)
- Calibration Error (ECE)
- Inference latency

## Expected Baselines (to be measured, not fabricated)
- Statistical detectors alone: AUROC ~0.70-0.80 on in-domain
- + Fine-tuned XLM-R: AUROC ~0.85-0.92 on in-domain, ~0.75-0.85 generator-held-out
- Low FPR target: FPR <5% at 80% recall for English, <10% for Hinglish

## Reporting
- Always report per language, per generator, per domain
- Report FPR for non-native writers separately
- Never claim SOTA without reproducible eval

## Hardware
- CPU: statistical detectors <100ms for 500 words
- GPU: transformer ~200-500ms, perturbation ~2-5s
