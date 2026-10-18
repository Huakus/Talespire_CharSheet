"""Extract primary SRD English sections for bilingual retirement checks."""
import sys,json
from pathlib import Path
sys.path.insert(0,"tmp/pdf-tools")
import pymupdf
doc=pymupdf.open("tmp/pdfs/srd-5.1-en.pdf")
sections=[];current=None
for n,page in enumerate(doc,1):
 if not 207<=n<=254: continue
 lines=[]
 for block in page.get_text("dict")["blocks"]:
  for line in block.get("lines",[]):
   if not 28<line["spans"][0]["origin"][1]<page.rect.height-50:continue
   text="".join(s["text"] for s in line["spans"]).strip()
   if text:lines.append({"text":text,"x":line["bbox"][0],"y":line["bbox"][1],"fonts":list(dict.fromkeys(s["font"] for s in line["spans"])),"size":max(s["size"] for s in line["spans"])})
 lines.sort(key=lambda l:(int(l["x"]>=page.rect.width/2),round(l["y"],1),l["x"]))
 for line in lines:
  if line["size"]>=14:current=None
  elif line["fonts"]==["GillSans-SemiBold"] and abs(line["size"]-12)<0.1:
   if current and not current["lines"]:current["name"]+=" "+line["text"]
   else:
    current={"name":line["text"],"page":n,"lines":[]}
    sections.append(current)
  elif current:current["lines"].append({"text":line["text"],"page":n})
Path("tmp/pdfs/srd-retirement-en-sections.json").write_text(json.dumps(sections,ensure_ascii=False),encoding="utf8")
print(json.dumps({"sections":len(sections),"first":[s["name"] for s in sections[:8]],"last":[s["name"] for s in sections[-6:]]}))
