"""Build src/data/afcd.json from AFCD Release 3 (FSANZ, CC BY 4.0).

Usage: python -I scripts/afcd/build_afcd.py "AFCD Release 3 - Nutrient profiles.xlsx" src/data/afcd.json
(Standard library only; no installs needed.)

Output: {"source": ..., "foods": [[key, name, cal, protein, carbs, fat, unit], ...]}
Values per 100 g (unit "g") or per 100 mL for liquids (unit "ml").
Lacto-vegetarian: drops meat, fish, egg and alcohol groups, and foods whose
name says they contain meat, fish, egg or gelatine.
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from xlsx_read import read_xlsx  # noqa: E402

EXCLUDED_GROUPS = {
    '15',  # fish & seafood
    '17',  # egg
    '18',  # meat, poultry & game
    '29',  # alcoholic beverages
    '32',  # infant / breast milk
    '33',  # reptiles etc.
}
# Groups whose names mention meat/fish/custard but are vegetarian:
# 20 = dairy & meat substitutes, 16 = fruit (custard apple).
EXEMPT_GROUPS = {'16', '20'}
NON_VEG = re.compile(
    r'\b(beef|chicken|pork|lamb|ham|bacon|meat|fish|prawns?|shrimp|tuna|salmon|anchov\w*|oyster|eggs?|'
    r'gelatine?|lard|dripping|sausages?|salami|mince|turkey|duck|veal|kangaroo|frankfurt\w*|'
    r'custard|mayonnaise|aioli|worcestershire|stock|gravy|meringue|jelly|bolognese)\b',
    re.I,
)

DRINK = re.compile(r'^(milk\b|milkshake|smoothie|kefir|lassi)|beverage|juice|drink|prepared with (water|milk)', re.I)

KJ_PER_KCAL = 4.184


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def table(rows):
    header_i = next(i for i, r in enumerate(rows) if r and r[0] == 'Public Food Key')
    header = [h.replace('\n', ' ') for h in rows[header_i]]
    idx = lambda prefix: next(i for i, h in enumerate(header) if h.strip().startswith(prefix))  # noqa: E731
    cols = {
        'kj': idx('Energy with dietary fibre'),
        'protein': idx('Protein'),
        'fat': idx('Fat, total'),
        'carbs': idx('Available carbohydrate, with sugar alcohols'),
    }
    out = {}
    for r in rows[header_i + 1:]:
        if not r or not r[0].startswith('F'):
            continue
        r = r + [''] * (max(cols.values()) + 1 - len(r))
        out[r[0]] = {
            'group': r[1][:2],
            'name': ' '.join(r[3].split()),
            'cal': round(num(r[cols['kj']]) / KJ_PER_KCAL),
            'protein': round(num(r[cols['protein']]), 1),
            'carbs': round(num(r[cols['carbs']]), 1),
            'fat': round(num(r[cols['fat']]), 1),
        }
    return out


def main(src, dest):
    sheets = read_xlsx(src)
    solids = table(sheets['All solids & liquids per 100 g'])
    liquids = table(sheets['Liquids only per 100 mL'])
    foods = []
    dropped = 0
    for key, f in solids.items():
        if f['group'] in EXCLUDED_GROUPS or (f['group'] not in EXEMPT_GROUPS and NON_VEG.search(f['name'])):
            dropped += 1
            continue
        unit = 'g'
        # Drinks are measured in mL; everything else (yoghurt, sauces, oil) in grams.
        if key in liquids and (f['group'] == '11' or DRINK.search(f['name'])):
            f, unit = liquids[key], 'ml'
        foods.append([key, f['name'], f['cal'], f['protein'], f['carbs'], f['fat'], unit])
    foods.sort(key=lambda x: x[1].lower())
    data = {
        'source': 'Australian Food Composition Database – Release 3 (December 2025), Food Standards Australia New Zealand, CC BY 4.0',
        'foods': foods,
    }
    with open(dest, 'w', encoding='utf-8') as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(',', ':'))
    print(f'{len(foods)} foods kept, {dropped} dropped, {sum(1 for f in foods if f[6] == "ml")} liquids')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
