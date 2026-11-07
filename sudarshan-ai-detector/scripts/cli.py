
import argparse
import json
import sys
import os
from .detector import SudarshanDetector

def main():
    parser = argparse.ArgumentParser(description="Sudarshan AI Detector CLI")
    parser.add_argument("--text", type=str, help="Text to analyze")
    parser.add_argument("--file", type=str, help="File path to analyze")
    parser.add_argument("--lang", type=str, default="auto", help="Language: auto|en|hi|hinglish|bn|ta etc")
    parser.add_argument("--json-out", type=str, help="Output JSON file")
    parser.add_argument("--enable-transformer", action="store_true", help="Enable transformer classifier (requires weights)")
    parser.add_argument("--enable-perturbation", action="store_true", help="Enable perturbation detector")
    parser.add_argument("--enable-watermark", action="store_true", help="Enable watermark detector")
    parser.add_argument("--model-path", type=str, default=None, help="Transformer model path")
    parser.add_argument("--perplexity-model", type=str, default="distilgpt2")
    args = parser.parse_args()

    if args.file:
        if not os.path.exists(args.file):
            print(f"File not found: {args.file}", file=sys.stderr)
            sys.exit(1)
        with open(args.file, 'r', encoding='utf-8') as f:
            text = f.read()
    elif args.text:
        text = args.text
    else:
        print("Provide --text or --file", file=sys.stderr)
        parser.print_help()
        sys.exit(1)

    detector = SudarshanDetector(
        use_transformer=args.enable_transformer,
        use_perturbation=args.enable_perturbation,
        use_watermark=args.enable_watermark,
        transformer_path=args.model_path,
        perplexity_model=args.perplexity_model
    )

    result = detector.detect(text, language=args.lang)
    json_str = detector.to_json(result)

    if args.json_out:
        with open(args.json_out, 'w', encoding='utf-8') as out:
            out.write(json_str)
        print(f"Report saved to {args.json_out}")
    else:
        print(json_str)

    # Human readable summary
    print("\n=== Summary ===", file=sys.stderr)
    print(f"Classification: {result.get('overall_classification')} | AI Likelihood: {result.get('ai_likelihood'):.3f} | Lang: {result.get('detected_language')} | Words: {result.get('word_count')}", file=sys.stderr)

if __name__ == "__main__":
    main()
