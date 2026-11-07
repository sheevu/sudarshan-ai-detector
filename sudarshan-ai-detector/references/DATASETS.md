# Datasets

## Recommended
- **HC3**: Human vs ChatGPT comparison, English + Chinese. https://huggingface.co/datasets/Hello-SimpleAI/HC3
- **M4**: Multi-generator, multi-domain, multilingual. https://huggingface.co/datasets/GenAI-M4/M4
- **RAID**: Robust AI Detection dataset, 11 generators, paraphrase attacks. https://huggingface.co/datasets/liamdugan/raid
- **TuringBench**: 20 generators, Turing test. https://github.com/jonathanpeyre/turingbench

## Hindi / Hinglish
- Custom collection required:
  - Human: Hindi Wikipedia, news (BBC Hindi, Dainik Jagran), Hindi stories, government docs
  - Hinglish: Twitter, YouTube comments, WhatsApp-style (anonymized), Bollywood forums
  - AI: Generate via ChatGPT, Claude, Gemini, Llama with prompts in Hindi/Hinglish
  - Include human-edited AI and AI-edited human

## Preparation
- Source-level deduplication (MinHash)
- Language verification
- Generator-held-out split (e.g., train on GPT-3.5/4, test on Claude)
- Cross-domain eval (news vs essay vs QA)

## Licensing
- Respect each dataset license
- No redistribution of copyrighted text
- Anonymize PII
