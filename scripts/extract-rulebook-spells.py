"""Extract spell reference text from the user-supplied Spanish 2014 books.

Run with PYTHONPATH=tmp/pdf-tools. No PDF or campaign file is changed.
The committed JSON keeps stable English keys and Spanish display text separately.
"""
import json
import re
import sys
import unicodedata
from pathlib import Path
import pymupdf

ROOT = Path(__file__).resolve().parents[1]
DOWNLOADS = Path.home() / 'Downloads'


def lines(filename, start, end, columns):
    doc = pymupdf.open(DOWNLOADS / filename)
    result = []
    for number in range(start, end + 1):
        page = doc[number - 1]
        rows = [line for block in page.get_text('dict')['blocks'] if 'lines' in block
                for line in block['lines'] if 48 < line['bbox'][1] < page.rect.height - 42]
        for column in range(columns):
            selected = [line for line in rows if min(columns - 1, int((line['bbox'][0] - 32) / (page.rect.width - 64) * columns)) == column]
            for line in sorted(selected, key=lambda row: (round(row['bbox'][1], 1), row['bbox'][0])):
                result.append({'text': ''.join(span['text'] for span in line['spans']).strip(),
                               'size': max(span['size'] for span in line['spans']), 'page': number})
    return result


def clean(text):
    text = re.sub(r'-\s*\n\s*(?=[a-záéíóúüñ])', '', text)
    return re.sub(r'\s+', ' ', text).strip()


def norm(text):
    return re.sub('[^a-z0-9]', '', unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode().lower())


base = json.loads((ROOT / 'src/domain/character/phb-srd-spells.json').read_text(encoding='utf8'))
known = {norm(spell['name']): spell['key'] for spell in base}
known.update({norm(name): key for name, key in {
    "Tasha's Hideous Laughter": 'hideous-laughter', "Evard's Black Tentacles": 'black-tentacles',
    "Mordenkainen's Faithful Hound": 'faithful-hound', "Mordenkainen's Magnificent Mansion": 'magnificent-mansion',
    "Mordenkainen's Private Sanctum": 'private-sanctum', "Mordenkainen's Sword": 'arcane-sword',
    "Mordekainen's Sword": 'arcane-sword', "Nystul's Magic Aura": 'arcanists-magic-aura',
    "Otiluke's Freezing Sphere": 'freezing-sphere', "Otiluke's Resilient Sphere": 'resilient-sphere',
    "Otto's Irresistible Dance": 'irresistible-dance', "Drawmij's Instant Summons": 'instant-summons',
    "Rary's Telepathic Bond": 'telepathic-bond', "Leomund's Secret Chest": 'secret-chest',
    "Leomund's Tiny Hut": 'tiny-hut', "Melf's Acid Arrow": 'acid-arrow',
    "Tenser's Floating Disk": 'floating-disk', "Bigby's Hand": 'arcane-hand',
    "Word Recall": 'word-of-recall', "Grasping Vines": 'grasping-vine',
}.items()})

phb = lines('D&D - Manual del Jugador 5E (1).pdf', 173, 237, 3)
starts = []
for i, row in enumerate(phb):
    if 7.9 < row['size'] < 8.1 and '[' in row['text']:
        heading = row['text']
        j = i + 1
        while ']' not in heading and j < len(phb):
            heading += '\n' + phb[j]['text']
            j += 1
        if not re.match(r'(?:N\w*\s+\d|Truco)', phb[j]['text']):
            continue
        if i and ']' not in phb[i-1]['text'] and 7.9 < phb[i-1]['size'] < 8.1 and (phb[i-1]['text'].endswith('-') or heading.startswith('[')):
            heading = phb[i-1]['text'] + '\n' + heading
        match = re.fullmatch(r'(.+?)\s*\[(.+?)\]', clean(heading))
        if match:
            spanish, english = match.groups()
            key = known.get(norm(english), re.sub(r'[^a-z0-9]+', '-', english.lower().replace("'", '').replace('’', '')).strip('-'))
            starts.append((i, j, key, spanish, english, row['page']))

# Lists contain all six PHB spellcasting classes, including non-SRD spells.
class_by_name = {}
current_class = None
class_headers = {'bardo': 'bard', 'brujo': 'warlock', 'clerigo': 'cleric', 'druida': 'druid',
                 'explorador': 'ranger', 'hechicero': 'sorcerer', 'mago': 'wizard', 'paladin': 'paladin'}
for i, row in enumerate(phb):
    if row['page'] > 178 or row['size'] > 7.8 and '[' in row['text']:
        continue
    header = re.search(r'Conjuros (?:de|del) (.+)', row['text'], re.I)
    if header:
        current_class = class_headers.get(norm(header.group(1)))
    if current_class and '[' in row['text']:
        heading = row['text']
        j = i + 1
        while ']' not in heading and j < len(phb):
            heading += '\n' + phb[j]['text']; j += 1
        match = re.search(r'\[(.+?)\]', clean(heading))
        if match:
            class_by_name.setdefault(norm(match[1]), set()).add(current_class)

localized = {}
extras = []
for index, (start, body_start, key, name, english, page) in enumerate(starts):
    end = starts[index + 1][0] if index + 1 < len(starts) else len(phb)
    body = clean('\n'.join(row['text'] for row in phb[body_start:end]))
    level_match = re.match(r'(?:N\w* (\d),?|Truco,?)\s*([^T]+?)\s*Tiempo de lanzamiento[:.]', body)
    if not level_match:
        print('Review header:', key, body[:130]); continue
    metadata = re.search(r'Tiempo de lanzamiento[:.]\s*(.*?)\s*Alcance:\s*(.*?)\s*Componen\w*:\s*(.*?)\s*Duración:\s*(.*)', body)
    if not metadata:
        print('Review metadata:', key); continue
    casting_time, distance, components, tail = metadata.groups()
    duration_match = re.match(r'((?:[Cc]oncentración,\s*)?(?:de\s+)?(?:[Hh]asta\s*)?(?:[Ii]nstantáne[ao]|Especial|Permanente|(?:\d+|una?)\s*(?:minutos?|horas?|días?|asaltos?|rondas?|turnos?)|(?:que |ser )[^.]+?(?= [A-ZÁÉÍÓÚ])))[.\s]*(.*)', tail)
    if key == 'symbol':
        duration_match = re.match(r'(hasta que sea disipado o activado)[.\s]*(.*)', tail)
    if key == 'resilient-sphere':
        tail = re.sub(r'Concentra- \+5 ción', 'Concentración', tail).replace('+0 ', '').replace('-5 Modificador de ', '').replace('+10 ', '').replace('-10 ', '')
        duration_match = re.match(r'(Concentración, hasta 1 minuto)\s*(.*)', tail)
    if not duration_match:
        print('Review duration:', key, tail[:100]); continue
    duration, description = duration_match.groups()
    description, *higher = re.split(r'A niveles superiores\.', description, maxsplit=1)
    localized[key] = dict(name=name, englishName=english, description=description.strip(), higherLevels=clean(' '.join(higher)),
                          castingTime=casting_time, range=distance, duration=duration,
                          material=components[components.find('(') + 1:components.rfind(')')] if '(' in components else '',
                          source='PHB 2014 · PDF aportado', page=page)
    if key not in {spell['key'] for spell in base}:
        extras.append(dict(key=key, level=int(level_match[1] or 0), school=level_match[2].replace('(ritual)', '').strip(),
                           classes=sorted(class_by_name.get(norm(english), set())), components=components.split('(')[0].strip(),
                           ritual='ritual' in level_match[2], concentration='Concentración' in duration, attackType='none',
                           saveAbility='', damageExpression='', upcastDamageExpression='', addAbilityModifier=False, damageType='', year='2014', **localized[key]))

(ROOT / 'src/domain/character/spells-es-2014.json').write_text(json.dumps(localized, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
(ROOT / 'tmp/pdfs/phb-extra-spells.json').write_text(json.dumps(extras, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
(ROOT / 'src/domain/character/phb-additional-spells.json').write_text(json.dumps(extras, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
missing = [(spell['key'],spell['name']) for spell in base if spell['key'] not in localized]
print('Localized:', len(localized), 'Additional:', len(extras), 'Unmatched:', missing)

xge = lines('Guia de Xanathar para todo (1).pdf', 155, 178, 2)
metadata_rows = [i for i,row in enumerate(xge) if row['text'].startswith('Tiempo de lanzamiento')]
names = json.loads((ROOT / 'scripts/xanathar-spell-metadata.json').read_text(encoding='utf8'))
assert len(metadata_rows) == len(names) == 94
class_lists = {
 'cleric': 'word-of-radiance toll-the-dead ceremony life-transference dawn holy-weapon temple-of-the-gods',
 'paladin': 'ceremony find-greater-steed holy-weapon',
 'bard': 'thunderclap earth-tremor skywrite pyrotechnics warding-wind enemies-abound catnap charm-monster skill-empowerment synaptic-static psychic-scream mass-polymorph',
 'ranger': 'absorb-elements zephyr-strike snare beast-bond healing-spirit flame-arrows guardian-of-nature steel-wind-strike wrath-of-nature',
 'druid': 'control-flames create-bonfire frostbite infestation mold-earth thunderclap magic-stone gust primal-savagery shape-water absorb-elements ice-knife earth-tremor snare beast-bond earthbind dust-devil skywrite healing-spirit warding-wind flame-arrows wall-of-water tidal-wave erupting-earth watery-sphere guardian-of-nature charm-monster elemental-bane control-winds wrath-of-nature transmute-rock maelstrom druid-grove primordial-ward bones-of-the-earth investiture-of-ice investiture-of-flame investiture-of-stone investiture-of-wind whirlwind',
 'warlock': 'frostbite create-bonfire infestation magic-stone thunderclap toll-the-dead cause-fear earthbind mind-spike shadow-blade enemies-abound summon-lesser-demons thunder-step charm-monster summon-greater-demon elemental-bane sickening-radiance shadow-of-moil danse-macabre enervation synaptic-static negative-energy-flood infernal-calling wall-of-light far-step investiture-of-ice investiture-of-flame investiture-of-stone investiture-of-wind mental-prison scatter soul-cage crown-of-stars power-word-pain maddening-darkness psychic-scream',
 'wizard': 'frostbite control-flames create-bonfire infestation mold-earth gust toll-the-dead shape-water thunderclap absorb-elements catapult cause-fear ice-knife earth-tremor snare aganazzars-scorcher maximilians-earthen-grasp dragons-breath earthbind dust-devil skywrite mind-spike shadow-blade pyrotechnics snillocs-snowball-swarm warding-wind enemies-abound flame-arrows summon-lesser-demons wall-of-sand wall-of-water melfs-minute-meteors tidal-wave thunder-step tiny-servant catnap erupting-earth life-transference watery-sphere storm-sphere vitriolic-sphere charm-monster summon-greater-demon elemental-bane sickening-radiance dawn control-winds danse-macabre skill-empowerment enervation synaptic-static steel-wind-strike immolation negative-energy-flood infernal-calling wall-of-light far-step transmute-rock create-homunculus scatter investiture-of-ice investiture-of-flame investiture-of-stone investiture-of-wind soul-cage mental-prison tensers-transformation crown-of-stars power-word-pain whirlwind illusory-dragon mighty-fortress abi-dalzims-horrid-wilting maddening-darkness psychic-scream invulnerability mass-polymorph',
 'sorcerer': 'frostbite control-flames create-bonfire infestation mold-earth thunderclap gust shape-water absorb-elements catapult ice-knife chaos-bolt earth-tremor aganazzars-scorcher maximilians-earthen-grasp dragons-breath earthbind dust-devil mind-spike shadow-blade pyrotechnics snillocs-snowball-swarm warding-wind enemies-abound flame-arrows melfs-minute-meteors wall-of-water tidal-wave thunder-step catnap erupting-earth watery-sphere storm-sphere vitriolic-sphere charm-monster sickening-radiance control-winds skill-empowerment enervation synaptic-static immolation wall-of-light far-step scatter investiture-of-ice investiture-of-flame investiture-of-stone investiture-of-wind mental-prison crown-of-stars power-word-pain whirlwind abi-dalzims-horrid-wilting psychic-scream mass-polymorph',
}
bonus = {'dragons-breath','holy-weapon','zephyr-strike','guardian-of-nature','shadow-blade','far-step'}
damage = {
 'aganazzars-scorcher': ('3d8','fire','dexterity'), 'absorb-elements': ('1d6','choice',''), 'catapult': ('3d8','bludgeoning','dexterity'),
 'dawn': ('4d10','radiant','constitution'), 'holy-weapon': ('2d8','radiant',''), 'frostbite': ('1d6','cold','constitution'),
 'crown-of-stars': ('4d12','radiant','attack'), 'create-bonfire': ('1d8','fire','dexterity'), 'ice-knife': ('1d10','piercing','attack'),
 'dust-devil': ('1d8','bludgeoning','strength'), 'illusory-dragon': ('7d6','choice','intelligence'), 'enervation': ('4d8','necrotic','dexterity'),
 'storm-sphere': ('2d6','bludgeoning','strength'), 'vitriolic-sphere': ('10d4','acid','dexterity'), 'mind-spike': ('3d8','psychic','wisdom'),
 'synaptic-static': ('8d6','psychic','intelligence'), 'psychic-scream': ('14d6','psychic','intelligence'), 'steel-wind-strike': ('6d10','force','attack'),
 'shadow-blade': ('2d8','psychic',''), 'infestation': ('1d6','poison','constitution'), 'immolation': ('8d6','fire','dexterity'),
 'negative-energy-flood': ('5d12','necrotic','constitution'), 'abi-dalzims-horrid-wilting': ('12d8','necrotic','constitution'),
 'melfs-minute-meteors': ('2d6','fire','dexterity'), 'wall-of-light': ('4d8','radiant','constitution'), 'tidal-wave': ('4d8','bludgeoning','dexterity'),
 'maddening-darkness': ('8d8','psychic','wisdom'), 'word-of-radiance': ('1d6','radiant','constitution'), 'thunderclap': ('1d6','thunder','constitution'),
 'thunder-step': ('3d10','thunder','constitution'), 'magic-stone': ('1d6','bludgeoning','attack'), 'mental-prison': ('5d10','psychic','intelligence'),
 'sickening-radiance': ('4d10','radiant','constitution'), 'primal-savagery': ('1d10','acid','attack'), 'earth-tremor': ('1d6','bludgeoning','dexterity'),
 'erupting-earth': ('3d12','bludgeoning','dexterity'), 'toll-the-dead': ('1d8','necrotic','wisdom'), 'whirlwind': ('10d6','bludgeoning','dexterity'),
 'snillocs-snowball-swarm': ('3d6','cold','dexterity'), 'life-transference': ('4d8','necrotic',''), 'maelstrom': ('6d6','bludgeoning','strength'),
 'maximilians-earthen-grasp': ('2d6','bludgeoning','strength'), 'dragons-breath': ('3d6','choice','dexterity'),
}
new_spells = []
for number,(position,(key,name)) in enumerate(zip(metadata_rows,names)):
    end = metadata_rows[number+1]-1 if number+1 < len(metadata_rows) else len(xge)
    # Remove the next title(s) while retaining continuation text across pages.
    while end > position and xge[end-1]['size'] >= 12.9:
        end -= 1
    body = clean('\n'.join(row['text'] for row in xge[position:end]))
    school_line = xge[position-1]['text']
    school_line = xge[position-1]['text']
    offset = 2
    while offset <= 5 and (not any(norm(s) in norm(school_line) for s in ['Abjuración','Adivinación','Conjuración','Encantamiento','Evocación','Ilusión','Nigromancia','Transmutación']) or not ('truco' in school_line or re.search(r'\d[°ºª]',school_line))):
        school_line = xge[position-offset]['text']+' '+school_line
        offset += 1
    level = 0 if 'truco' in school_line else int(re.findall(r'(\d)[°ºª]', school_line)[-1])
    school = next((s for s in ['Abjuración','Adivinación','Conjuración','Encantamiento','Evocación','Ilusión','Nigromancia','Transmutación'] if norm(s) in norm(school_line)), 'Encantamiento')
    match = re.search(r'Tiempo de lanzamiento:\s*(.*?)\s*Alcance:\s*(.*?)\s*Componentes:\s*(.*?)\s*Duración:\s*(.*)', body)
    if not match:
        raise ValueError((key,body[:300]))
    casting_time,distance,components,tail = match.groups()
    duration_match = re.match(r'((?:Concentración,\s*)?(?:[Hh]asta\s*)?(?:Instantáne[ao]|Especial|(?:\d+|una?)\s*(?:minutos?|horas?|días?|rondas?)|que[^.]+?(?=\.| [A-ZÁÉÍÓÚ])))[.\s]*(.*)', tail)
    if not duration_match:
        raise ValueError((key,tail[:150]))
    duration,description = duration_match.groups()
    description,*higher = re.split(r'A niveles superiores\.', description,maxsplit=1)
    expression,damage_type,save = damage.get(key,('','',''))
    definition = dict(key=key,name=name,level=level,school=school,classes=[c for c,keys in class_lists.items() if key in keys.split()],
      castingTime='1 acción adicional' if key in bonus else casting_time,range=distance,components=components.split('(')[0].strip(),
      material=components[components.find('(')+1:components.rfind(')')] if '(' in components else '',
      duration=duration,description=description,higherLevels=' '.join(higher),ritual='ritual' in school_line,concentration='Concentración' in duration,
      attackType='attack' if save == 'attack' else 'save' if save else 'none',saveAbility='' if save == 'attack' else save,
      damageExpression=expression,upcastDamageExpression='',addAbilityModifier=key=='magic-stone',damageType=damage_type,year='2014',source='Xanathar · PDF aportado',page=xge[position]['page'])
    if key == 'absorb-elements':
        definition['higherLevels'] = 'El daño adicional aumenta 1d6 por cada nivel de espacio superior a 1.'
    if key == 'healing-spirit':
        definition['description'] += ' Errata oficial: el espíritu puede curar 1 + tu modificador de lanzamiento veces (mínimo dos). Tras la última curación desaparece.'
    if key == 'mind-spike':
        definition['higherLevels'] = 'El daño aumenta 1d8 por cada nivel de espacio superior a 2.'
    if key == 'life-transference':
        definition['description'] += ' Errata oficial: el daño que recibís no puede reducirse de ninguna manera.'
    new_spells.append(definition)
# The supplied Spanish PDF omits the Chaos Bolt description (it is in its index).
new_spells.append(dict(key='chaos-bolt',name='Perno de Caos',level=1,school='Evocación',classes=['sorcerer'],castingTime='1 acción',range='120 pies',components='V, S',material='',duration='Instantánea',description='Ataque mágico a distancia contra una criatura: 2d8 + 1d6. Elegí el tipo según uno de los d8: 1 ácido, 2 frío, 3 fuego, 4 fuerza, 5 rayo, 6 veneno, 7 psíquico, 8 trueno. Si los d8 coinciden, podés repetir el ataque contra otra criatura a 30 pies de la anterior, con nuevas tiradas; una criatura solo puede recibirlo una vez por lanzamiento.',higherLevels='+1d6 por nivel de espacio superior a 1.',ritual=False,concentration=False,attackType='attack',saveAbility='',damageExpression='2d8+1d6',upcastDamageExpression='1d6',addAbilityModifier=False,damageType='choice',year='2014',source='Xanathar',page=0))
assert all(s['classes'] for s in new_spells)
(ROOT / 'src/domain/character/xanathar-spells.json').write_text(json.dumps(new_spells, ensure_ascii=False, indent=2)+'\n',encoding='utf8')
print('Xanathar spells:',len(new_spells))
