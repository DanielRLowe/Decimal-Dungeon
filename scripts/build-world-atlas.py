#!/usr/bin/env python3
"""Build web/campaign-data.js from Natural Earth's public-domain 50m admin-0 ZIP
and the UN Dag Hammarskjöld Library's UN member names CSV. Runtime is offline.

Inputs:
https://naturalearth.s3.amazonaws.com/50m_cultural/ne_50m_admin_0_countries.zip
https://digitallibrary.un.org/record/4082085/files/2026_08_17_unms_names.csv

Run: python3 scripts/build-world-atlas.py boundaries.zip members.csv
"""
import argparse
import csv
import json
import struct
import zipfile
from pathlib import Path

WIDTH, HEIGHT = 1000, 540
# These crossings are rules of the game, not official borders or transport lines.
SEA_ROUTES = """
USA-CUB USA-BHS USA-JPN CAN-GBR BRA-SEN BHS-CUB CUB-MEX CUB-HTI CUB-JAM HTI-JAM DOM-ATG
ATG-KNA ATG-DMA DMA-LCA LCA-BRB LCA-VCT VCT-GRD GRD-TTO TTO-VEN
GBR-FRA GBR-ISL ISL-NOR ITA-MLT GRC-CYP CYP-LBN
SEN-CPV STP-GAB MOZ-MDG MDG-MUS MDG-COM COM-SYC COM-TZA
SAU-BHR BHR-QAT IND-LKA LKA-MDV IND-MDV MYS-SGP MYS-PHL CHN-JPN JPN-KOR
PHL-PLW PLW-FSM FSM-MHL MHL-KIR FSM-NRU NRU-KIR KIR-TUV TUV-FJI
FJI-WSM WSM-TON TON-FJI FJI-VUT VUT-SLB SLB-PNG PNG-AUS AUS-NZL
AUS-IDN IDN-SGP IDN-PHL
""".split()
COMMON_NAMES = {
    'RUS': 'Russia', 'KOR': 'South Korea', 'PRK': 'North Korea', 'IRN': 'Iran',
    'BOL': 'Bolivia', 'VEN': 'Venezuela', 'GBR': 'United Kingdom', 'TZA': 'Tanzania',
    'MDA': 'Moldova', 'LAO': 'Laos', 'SYR': 'Syria', 'BRN': 'Brunei', 'COD': 'Democratic Republic of the Congo',
    'COG': 'Republic of the Congo', 'FSM': 'Micronesia', 'VNM': 'Vietnam',
    'NLD': 'Netherlands', 'BHS': 'The Bahamas', 'STP': 'São Tomé and Príncipe'
}


def dbf_rows(data):
    count, header_size, row_size = struct.unpack_from('<IHH', data, 4)
    fields = [(data[i:i+11].split(b'\0')[0].decode(), data[i+16]) for i in range(32, header_size-1, 32)]
    for index in range(count):
        pos = header_size + row_size * index + 1
        row = {}
        for field, length in fields:
            row[field] = data[pos:pos+length].strip(b'\0 ').decode('utf-8')
            pos += length
        yield row


def shape_records(data):
    pos = 100
    while pos < len(data):
        _, words = struct.unpack_from('>2I', data, pos)
        payload = memoryview(data)[pos+8:pos+8+2*words]
        pos += 8 + 2 * words
        assert struct.unpack_from('<I', payload)[0] == 5, 'Expected a polygon'
        count, size = struct.unpack_from('<2I', payload, 36)
        offsets = list(struct.unpack_from('<' + 'I'*count, payload, 44)) + [size]
        start = 44 + count*4
        points = list(struct.iter_unpack('<2d', payload[start:start+size*16]))
        yield [points[a:b] for a, b in zip(offsets, offsets[1:])]


def project(lon, lat):
    return round((lon + 180) * WIDTH / 360, 2), round((85 - lat) * HEIGHT / 152, 2)


def number(n):
    return f'{n:.2f}'.rstrip('0').rstrip('.') or '0'


def shape(rings):
    parts = []
    for ring in rings:
        points = [project(*p) for p in ring]
        # Repeat vertices collapse when coordinates are quantized to 0.01 pixel.
        coords = [xy for i, xy in enumerate(points[:-1]) if i == 0 or xy != points[i-1]]
        if len(coords) >= 3:
            parts.append('M' + ' '.join(number(x) + ',' + number(y) for x, y in coords) + 'Z')
    return ''.join(parts)


def area(ring):
    return abs(sum(p[0]*q[1] - p[1]*q[0] for p, q in zip(ring, ring[1:]))) / 2


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('zip', type=Path)
    parser.add_argument('csv', type=Path)
    args = parser.parse_args()
    with args.csv.open(encoding='utf-8-sig') as f:
        roster = {r['iso']: r['member_state'] for r in csv.DictReader(f) if r['name_status'] == 'ms'}
    assert len(roster) == 193, 'Use the current UN member-state roster'
    roster.update(PSE='Palestine', VAT='Vatican City')
    ids = {code: i for i, code in enumerate(sorted(roster))}
    with zipfile.ZipFile(args.zip) as z:
        files = z.namelist()
        db = list(dbf_rows(z.read(next(k for k in files if k.endswith('.dbf')))))
        records = list(shape_records(z.read(next(k for k in files if k.endswith('.shp')))))
        version = z.read(next(k for k in files if k.endswith('VERSION.txt'))).decode().strip()
    assert len(db) == len(records)
    occurrences = {}
    nations = {}
    neutral = []
    for row, rings in zip(db, records):
        code = row['ISO_A3_EH']
        if code not in roster or row['ADM0_A3'] in ('IOA', 'ATC'):
            if code != 'ATA':
                neutral.append(shape(rings))
            continue
        assert code not in nations, code
        land = set()
        nations[code] = {
            'id': ids[code], 'code': code, 'iso2': row['ISO_A2_EH'], 'name': COMMON_NAMES.get(code, roster[code]),
            'region': row['SUBREGION'], 'x': None, 'y': None, 'tiny': max(map(area,rings)) < 1.05,
            'path': shape(rings), 'land': land, 'sea': set()
        }
        center = project(float(row['LABEL_X']), float(row['LABEL_Y']))
        nations[code]['x'], nations[code]['y'] = center
        for ring in rings:
            # Land borders must overlap along an edge. Meeting at one corner is not adjacency.
            normalized = [(round(x, 5), round(y, 5)) for x, y in ring]
            for p, q in zip(normalized, normalized[1:]):
                if p == q:
                    continue
                edge = (p, q) if p < q else (q, p)
                other = occurrences.setdefault(edge, code)
                if other != code:
                    land.add(other)
                    nations[other]['land'].add(code)
    assert set(nations) == set(roster), set(roster) - set(nations)
    # Several short borders fall below 1:50m's drawn coastline detail.
    # Maintain real enclave access even when its polygons are represented by points.
    # Spain's Ceuta/Melilla, Botswana's Kazungula boundary, and Canada's
    # Tartupaluk (Hans Island) boundary with the Kingdom of Denmark are subscale.
    # https://www.canada.ca/en/global-affairs/news/2022/06/boundary-dispute.html
    # https://www.consilium.europa.eu/en/policies/western-routes/
    # https://dailynews.gov.bw/news-detail/67030
    for a, b in [('ITA','VAT'), ('ITA','SMR'), ('MCO','FRA'), ('AND','ESP'), ('AND','FRA'),
                 ('ESP','MAR'), ('BWA','ZMB'), ('CAN','DNK')]:
        nations[a]['land'].add(b)
        nations[b]['land'].add(a)
    for route in SEA_ROUTES:
        a, b = route.split('-')
        assert b not in nations[a]['land'], 'Land border marked as a crossing: ' + route
        nations[a]['sea'].add(b)
        nations[b]['sea'].add(a)
    rows = []
    for code in sorted(roster):
        n = nations[code]
        land = n.pop('land')
        sea = n.pop('sea')
        n['neighbors'] = sorted(ids[k] for k in land | sea)
        n['seaNeighbors'] = sorted(ids[k] for k in sea)
        rows.append(n)
    reached = {ids['USA']}
    todo = list(reached)
    while todo:
        additions = set(rows[todo.pop()]['neighbors']) - reached
        reached.update(additions)
        todo.extend(additions)
    if len(reached) != len(rows):
        raise RuntimeError('Unreachable countries: ' + ', '.join(n['name'] for n in rows if n['id'] not in reached))
    # Colors come from Natural Earth's map coloring. Guardians and encounter realms
    # are assigned independently of national identity and do not describe real terrain.
    mapcolors = {r['ISO_A3_EH']: int(r['MAPCOLOR13']) for r in db if r['ADM0_A3'] not in ('IOA','ATC')}
    for n in rows:
        n['tint'] = mapcolors[n['code']]
    output = Path(__file__).resolve().parent.parent / 'web' / 'campaign-data.js'
    jsonargs = dict(ensure_ascii=False, separators=(',', ':'))
    with output.open('w', encoding='utf-8') as f:
        f.write('/* Generated by scripts/build-world-atlas.py. Natural Earth 1:50m v' + version +
                ', public domain. UN member states plus the two permanent observer states. */\n')
        f.write("(function (root) {\n  'use strict';\n  const rows = [\n")
        for index, n in enumerate(rows):
            f.write('    ' + json.dumps(n, **jsonargs) + (',' if index < len(rows)-1 else '') + '\n')
        f.write('  ];\n  const landPath = ' + json.dumps(''.join(neutral)) + ';\n')
        f.write("""  const colors = ['#a8bd8c','#d6b780','#8eb4bb','#be9caa','#c7b398','#b7aaca','#9cb7a6',
    '#c49d84','#a1b4c9','#b9be92','#b89fbd','#c4a98e','#91bbae'];
  const encounters = ['A mossy clearing', 'A crystal cavern', 'An ancient ruin',
    'A lantern-lit keep', 'A dragon’s lair', 'A moonlit castle'];
  for (const n of rows) {
    n.color = colors[(n.tint + colors.length - 1) % colors.length];
    n.biome = n.id % encounters.length;
    n.terrain = encounters[n.biome];
    const encounter = Math.floor(n.id / encounters.length) % 5;
    n.rank = encounter === 4 ? 'boss' : encounter === 2 ? 'special' : 'normal';
    n.variant = Math.floor(n.id / encounters.length) % 2;
    Object.freeze(n.neighbors);
    Object.freeze(n.seaNeighbors);
    Object.freeze(n);
  }
  const data = Object.freeze({ WIDTH:1000, HEIGHT:540, CAPITAL_ID:rows.findIndex(n => n.code === 'USA'),
    NATIONS:Object.freeze(rows), landPath });
  root.DungeonCampaign = data;
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
})(globalThis);
""")
    print(f'Wrote {output.name}, {len(rows)} playable countries, {len(SEA_ROUTES)} game crossings, {output.stat().st_size:,} bytes.')


if __name__ == '__main__':
    main()
