"""Minimal stdlib .xlsx reader: yields rows (lists of strings) per sheet."""
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
REL = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'


def col_index(ref):
    letters = re.match(r'[A-Z]+', ref).group(0)
    n = 0
    for ch in letters:
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def read_xlsx(path):
    z = zipfile.ZipFile(path)
    shared = []
    if 'xl/sharedStrings.xml' in z.namelist():
        root = ET.fromstring(z.read('xl/sharedStrings.xml'))
        for si in root.findall('m:si', NS):
            shared.append(''.join(t.text or '' for t in si.iter('{%s}t' % NS['m'])))
    wb = ET.fromstring(z.read('xl/workbook.xml'))
    rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    target = {r.get('Id'): r.get('Target') for r in rels}
    sheets = {}
    for s in wb.find('m:sheets', NS):
        t = target[s.get(REL)].lstrip('/')
        if not t.startswith('xl/'):
            t = 'xl/' + t
        root = ET.fromstring(z.read(t))
        rows = []
        for row in root.iter('{%s}row' % NS['m']):
            cells = {}
            for c in row.findall('m:c', NS):
                v = c.find('m:v', NS)
                typ = c.get('t')
                if typ == 'inlineStr':
                    val = ''.join(x.text or '' for x in c.iter('{%s}t' % NS['m']))
                elif v is None:
                    val = ''
                elif typ == 's':
                    val = shared[int(v.text)]
                else:
                    val = v.text
                cells[col_index(c.get('r'))] = val
            if cells:
                rows.append([cells.get(i, '') for i in range(max(cells) + 1)])
        sheets[s.get('name')] = rows
    return sheets


if __name__ == '__main__':
    for name, rows in read_xlsx(sys.argv[1]).items():
        print('== sheet', name, len(rows), 'rows')
        for r in rows[:4]:
            print(r[:60])
