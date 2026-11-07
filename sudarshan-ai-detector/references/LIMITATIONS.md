# Limitations & Ethics

1. **No Proof**: Detector scores are statistical signals, not proof of authorship. Never claim certainty.
2. **Short Text**: <50 words inherently inconclusive. <10 words rejected.
3. **Non-native & Hinglish**: May have higher false positives due to simpler syntax. We prioritize low FPR and use IndicBERT.
4. **Paraphrased / Edited AI**: Paraphrasing and human editing significantly reduce detection. Mixed-authorship module attempts but not perfect.
5. **Unseen Generators**: Performance drops on unseen LLMs. Generator-held-out testing required.
6. **Perplexity Surrogate**: Using GPT-2 to score text from Claude/Gemini is surrogate, not true perplexity.
7. **Watermark**: Only works if text was watermarked with known compatible scheme and key.
8. **Transformer Needs Training**: Without fine-tuned weights, transformer detector unavailable. System falls back to statistical.
9. **Perturbation Cost**: DetectGPT requires multiple forward passes (5-20x), high latency.
10. **Language Coverage**: Best for English, Hindi, Hinglish. Other Indian languages supported via XLM-R but less tested.
11. **Privacy**: No storage by default. Respect dataset licenses. Treat input as untrusted, prevent prompt injection.
12. **Bias**: Training data bias may affect results. Regular auditing needed.
13. **Adversarial**: Deliberate evasion (e.g., adding typos, burstiness injection) can fool detectors.

Always include limitations in report.
