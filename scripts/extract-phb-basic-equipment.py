import sys,json,re
from pathlib import Path
sys.path.insert(0,"tmp/pdf-tools")
import pymupdf
p=pymupdf.open("C:/Users/joaqu/Downloads/D&D - Manual del Jugador 5E (1).pdf")
normalize=lambda t: re.sub(r"\s+"," ",re.sub(r"(?<=[a-záéíóúñ])-\s*\n\s*(?=[a-záéíóúñ])","",t)).strip()
text=p[128].get_text(); start=text.index("Set de Juego."); end=text.index("Monturas y Vehículos",start)
games=normalize(text[start:end])
text=p[110].get_text(); match=re.search(r"un rollo de pergamino lleno de notas de tus estudios\s+o plegarias",text)
assert match
rows=[]; lines=[s.strip() for s in p[127].get_text().splitlines() if s.strip()]
for name in ["Set de ajedrez de dragón","Set de tres dragones"]:
 index=lines.index(name);row=lines[index:index+3];assert row[1]=="1 po";rows.append(row)
Path("tmp/pdfs/phb-basic-equipment-excerpts.json").write_text(json.dumps({"gameRules":{"page":129,"text":games},"gameRows":{"page":128,"rows":rows},"hermitNotes":{"page":111,"text":normalize(match[0])}},ensure_ascii=False),encoding="utf-8")
print(json.dumps({"gameRows":rows,"hermitSource":111}))
