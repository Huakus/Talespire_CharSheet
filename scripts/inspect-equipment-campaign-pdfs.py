"""Read only the ECE campaign PDFs; write research extracts within the active workspace."""
import json
import sys
import unicodedata
from pathlib import Path
sys.path.insert(0, "tmp/pdf-tools")
import pymupdf

terms = ["monoculo", "linterna protegida", "linterna de cristal", "bomba incendiaria", "armadura de campo", "cristales de reserva", "flecha con cuerda", "flecha incendiaria", "laud de doss", "ecos profundos", "cristal de reserva", "cristal luciente", "sombra del segador"]
def normalize(text):
    return "".join(c for c in unicodedata.normalize("NFD", text.lower()) if unicodedata.category(c) != "Mn")

root = Path("tmp/pdfs")
sources = []
for filename in ["Historia ECE.pdf", "ECE_Cap1.pdf", "ECE_Cap2.pdf", "ECE_Cap3.pdf", "ECE_Cap4.pdf"]:
    document = pymupdf.open(Path("C:/Users/joaqu/Downloads") / filename)
    hits = []
    for index, page in enumerate(document):
        text = page.get_text()
        normalized = normalize(" ".join(text.split()))
        found = [term for term in terms if term in normalized]
        if found:
            hits.append({"page": index+1, "terms": found, "text": text})
    sources.append({"source": filename, "pages": len(document), "hits": hits})
root.joinpath("ece-equipment-research.json").write_text(json.dumps(sources, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps([{"source": s["source"], "pages": s["pages"], "hits": [{"page": h["page"], "terms": h["terms"]} for h in s["hits"]]} for s in sources], ensure_ascii=False))
