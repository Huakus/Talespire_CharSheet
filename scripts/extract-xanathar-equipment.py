"""Read the user's supplied manual and preserve page/column provenance for item sections."""
import json
import sys
from pathlib import Path
sys.path.insert(0, "tmp/pdf-tools")
import pymupdf

source = Path("C:/Users/joaqu/Downloads/Guia de Xanathar para todo (1).pdf")
doc = pymupdf.open(source)
items = []
current = None
for number in range(140, 145):
    page = doc[number - 1]
    lines = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            text = "".join(s["text"] for s in line["spans"]).strip()
            if not text or line["bbox"][1] < 20 or line["bbox"][3] > page.rect.height - 20 or "CAPITULO" in text.upper() or text.isdigit():
                continue
            lines.append({"text": text, "page": number, "bbox": line["bbox"], "size": max(s["size"] for s in line["spans"]), "font": line["spans"][0]["font"]})
    lines.sort(key=lambda l: (int(l["bbox"][0] >= 300), round(l["bbox"][1], 1), l["bbox"][0]))
    for line in lines:
        if line["font"] == "MrsEavesSmallCaps" and 12 < line["size"] < 14:
            current = {"name": line["text"], "page": number, "lines": []}
            items.append(current)
        elif line["size"] >= 14:
            current = None
        elif current:
            current["lines"].append(line)
Path("tmp/pdfs/xge-magic-items.json").write_text(json.dumps(items, ensure_ascii=False), encoding="utf-8")
print(json.dumps({"sections": len(items), "names": [i["name"] for i in items]}))
