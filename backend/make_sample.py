import sys
from pathlib import Path
root_make_sample = Path(__file__).resolve().parent.parent / 'make_sample.py'
if root_make_sample.is_file():
    with open(root_make_sample, 'r', encoding='utf-8') as f:
        code = f.read()
    exec(code)
