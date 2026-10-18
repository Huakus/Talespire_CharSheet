"""Extract official CC-BY-4.0 source lines; keep coordinates/fonts for editorial verification."""
import sys
sys.path.insert(0, "tmp/pdf-tools")
import json
from pathlib import Path
import pymupdf

doc = pymupdf.open("tmp/pdfs/srd-5.1-es.pdf")
pages = []
for number, page in enumerate(doc, 1):
    if not (63 <= number <= 83 or 210 <= number <= 287 or number == 1):
        continue
    lines = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            baseline = line["spans"][0]["origin"][1]
            if not 28 < baseline < page.rect.height - 65:
                continue
            text = "".join(span["text"] for span in line["spans"])
            if not text.strip():
                continue
            lines.append({"text": text, "bbox": list(line["bbox"]), "baseline": baseline, "fonts": list(dict.fromkeys(span["font"] for span in line["spans"])), "size": max(span["size"] for span in line["spans"])})
    lines.sort(key=lambda line: (int(line["bbox"][0] >= page.rect.width / 2), round(line["baseline"], 1), line["bbox"][0]))
    pages.append({"page": number, "width": page.rect.width, "height": page.rect.height, "lines": lines})
Path("tmp/pdfs/srd-equipment-lines.json").write_text(json.dumps(pages, ensure_ascii=False), encoding="utf8")
Path("tmp/pdfs/srd-equipment.txt").write_text("\n\n".join(f"=== PDF {p['page']} ===\n" + "\n".join(line["text"] for line in p["lines"]) for p in pages), encoding="utf8")
items = []
current = None
for page in [p for p in pages if p["page"] >= 222]:
    for line in page["lines"]:
        if line["size"] >= 14:
            current = None
        elif line["fonts"] == ["Calibri"] and abs(line["size"] - 12) < 0.1:
            if current and not current["lines"]:
                current["name"] += " " + line["text"].strip()
            else:
                current = {"name": line["text"].strip(), "page": page["page"], "lines": []}
                items.append(current)
        elif current:
            current["lines"].append({**line, "page": page["page"]})
Path("tmp/pdfs/srd-magic-items.json").write_text(json.dumps(items, ensure_ascii=False), encoding="utf8")
for number in [70, 224, 259]:
    doc[number - 1].get_pixmap(matrix=pymupdf.Matrix(1.5, 1.5)).save(f"tmp/pdfs/srd-equipment-{number}.png")
english = pymupdf.open("tmp/pdfs/srd-5.1-en.pdf")
table_pages = []
for number in range(60, 74):
    page = english[number - 1]
    rows = {}
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            baseline = line["spans"][0]["origin"][1]
            if not 30 < baseline < page.rect.height - 50:
                continue
            text = "".join(span["text"] for span in line["spans"])
            rows.setdefault(round(baseline, 1), []).append({"x": line["bbox"][0], "text": " ".join(text.split())})
    table_pages.append({"page": number, "rows": [{"baseline": y, "cells": sorted(cells, key=lambda cell: cell["x"])} for y, cells in sorted(rows.items())]})
Path("tmp/pdfs/srd-en-equipment-rows.json").write_text(json.dumps(table_pages, ensure_ascii=False), encoding="utf8")
prose = []
current = None
import re
for page in [p for p in pages if 68 <= p["page"] <= 73]:
    for line in page["lines"]:
        match = re.match(r"^\s*([A-ZÁÉÍÓÚÑ][^.]{1,48})\.\s+\S", line["text"])
        if line["size"] >= 12:
            current = None
        if match and not match[1].startswith("CD ") and match[1] != "Dragones)":
            current = {"name": match[1], "page": page["page"], "lines": []}
            prose.append(current)
        if current:
            current["lines"].append({**line, "page": page["page"]})
Path("tmp/pdfs/srd-mundane-prose.json").write_text(json.dumps(prose, ensure_ascii=False), encoding="utf8")
print(json.dumps({"pages": len(doc), "extracted": len(pages), "magicSections": len(items)}))
