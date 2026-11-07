# Calibration

## Goals
- Produce calibrated AI-likelihood in [0,1]
- Low false-positive rate, especially for Hindi/Hinglish and non-native English
- Reliability: predicted probability matches empirical frequency

## Methods
- **Isotonic Regression**: non-parametric calibration on held-out validation
- **Platt Scaling**: logistic regression on scores (for transformer)
- **Temperature Scaling**: for overconfident models

## Procedure
1. Collect held-out set with balanced human/AI, multiple generators, multiple languages
2. Get raw scores from each detector
3. Fit isotonic regressor per detector on human=0, AI=1
4. For fusion, fit second-level calibrator on weighted ensemble

## Thresholds
- AI_THRESHOLD=0.65 (high precision)
- HUMAN_THRESHOLD=0.35
- Inconclusive zone 0.35-0.65 or low confidence

## Monitoring ECE
Expected Calibration Error: mean |pred - true|
Target ECE <0.1

## Hindi/Hinglish Adjustment
- Higher threshold for AI (0.70) for Hindi/Hinglish to reduce FPR
- Tested on IndicBERT v2 tokenization

## Never Fabricate
Do not invent calibration numbers. Report only from evaluation.
