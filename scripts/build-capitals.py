#!/usr/bin/env python3
"""Regenerate web/capitals.js after building the 50m world atlas.
python3 scripts/build-capitals.py ne_10m_populated_places_simple.zip ne_50m_lakes.zip
Public-domain Natural Earth source, https://www.naturalearthdata.com/about/terms-of-use/
https://naturalearth.s3.amazonaws.com/10m_cultural/ne_10m_populated_places_simple.zip
https://naturalearth.s3.amazonaws.com/50m_physical/ne_50m_lakes.zip
"""
import argparse
import json
import math
import runpy
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ATLAS = runpy.run_path(str(HERE / 'build-world-atlas.py'))
# Select a seat when more than one capital is listed, and correct newer city designations.
# https://data.un.org/legacy/en/iso/bi.html (Gitega)
# https://data.un.org/legacy/en/iso/tz.html (Dodoma)
# https://data.un.org/legacy/en/iso/bj.html (Porto-Novo)
# https://www.gov.kz/article/232335?lang=en (Astana)
# https://data.un.org/legacy/en/iso/mm.html (Nay Pyi Taw)
PREFERRED = {'BDI':'Gitega', 'BOL':'Sucre', 'LKA':'Sri Jayawardenepura Kotte', 'ZAF':'Pretoria',
             'CIV':'Yamoussoukro', 'PSE':'Ramallah', 'SSD':'Juba', 'BEN':'Porto-Novo', 'TZA':'Dodoma'}
DISPLAY = {'AND':'Andorra la Vella','KAZ':'Astana','MMR':'Nay Pyi Taw','USA':'Washington, D.C.',
           'DNK':'Copenhagen','COL':'Bogotá','KIR':'South Tarawa'}
NOTES = {'PSE':'Ramallah is the administrative seat used for this campaign marker.',
         'ISR':'The campaign uses Jerusalem as its starting city. The city’s international status is disputed.',
         'BOL':'Sucre is the constitutional capital. Government also sits in La Paz.',
         'ZAF':'Pretoria is the administrative capital. South Africa also has legislative and judicial capitals.',
         'NRU':'Yaren District is the seat of government. Naoero has no official capital city.',
         'CHE':'Bern is the federal city and seat of government.',
         'LKA':'Sri Jayawardenepura Kotte is the legislative capital.',
         'SWZ':'Mbabane is the administrative capital. Lobamba is the royal and legislative capital.'}
# Approximate city coordinates (latitude, longitude)
EXTRA = {
    # UK Permanent Committee on Geographical Names, Equatorial Guinea factfile, January 2026, table p. 4
    # https://assets.publishing.service.gov.uk/media/65b78d77a0ae1b0012526157/Equatorial_Guinea_Toponymic_Factfile.pdf
    'GNQ': ('Ciudad de la Paz', 1 + 35/60 + 33/3600, 10 + 49/60 + 25/3600),
    # Place-name reference and approximate map location: https://www.geonames.org/8063361/ngerulmud.html
    'PLW': ('Ngerulmud', 7.501, 134.624),
    # Naoero's Yaren District is its government seat; UNdata profile uses Yaren as capital.
    # https://data.un.org/legacy/en/iso/nr.html
    # https://open.unep.org/docs/gef/PIR/10267_PIR_UNEP_2024_GEF_CW.10267.ISLANDS_Pacific.pdf
    'NRU': ('Yaren District', -0.5477, 166.9208)
}


def inside(rings, x, y):
    result = False
    for points, bounds in rings:
        l, t, r, b = bounds
        if not (l <= x <= r and t <= y <= b):
            continue
        ax, ay = points[-1]
        for bx, by in points:
            if (ay > y) != (by > y) and x < ax + (bx - ax) * (y - ay) / (by - ay):
                result = not result
            ax, ay = bx, by
    return result


def geometry(path):
    result = []
    for ring in path.split('M')[1:]:
        points = [tuple(float(s) for s in pair.split(',')) for pair in ring[:-1].split()]
        xs, ys = zip(*points)
        result.append((points,(min(xs),min(ys),max(xs),max(ys))))
    return result


def marker(rings, lakes, x, y):
    def valid(p):
        return inside(rings, *p) and not inside(lakes, *p)
    if valid((x, y)):
        return [x, y]
    # At map scale a coastal city point can fall just offshore. Move its marker
    # inside the nearest mapped coastline without moving the country's geometry.
    candidates = []
    for points, _ in rings:
        ax, ay = points[-1]
        for bx, by in points:
            dx, dy = bx - ax, by - ay
            length = math.hypot(dx,dy)
            if length:
                t = max(.0001, min(.9999, ((x-ax)*dx + (y-ay)*dy) / length**2))
                sx, sy = ax+t*dx, ay+t*dy
                candidates.append((math.hypot(sx-x, sy-y), sx, sy, -dy/length, dx/length))
            ax, ay = bx, by
    for _, sx, sy, nx, ny in sorted(candidates):
        for ds in [.0002,-.0002,.001,-.001,.02,-.02]:
            p = [round(sx+ds*nx,6), round(sy+ds*ny,6)]
            if valid(p):
                return p
    raise ValueError('No interior map point near '+str((x,y)))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('cityzip'); parser.add_argument('lakezip')
    args = parser.parse_args()
    web = HERE.parent / 'web'
    nations = [json.loads(row.strip().rstrip(',')) for row in (web/'campaign-data.js').read_text().splitlines()
               if row.lstrip().startswith('{"id":')]
    assert len(nations) == 195
    with zipfile.ZipFile(args.cityzip) as z:
        records = list(ATLAS['dbf_rows'](z.read(next(k for k in z.namelist() if k.endswith('.dbf')))))
    with zipfile.ZipFile(args.lakezip) as z:
        records_lakes = ATLAS['shape_records'](z.read(next(k for k in z.namelist() if k.endswith('.shp'))))
        lake_path = ''.join(ATLAS['shape'](rings) for rings in records_lakes)
    lakes = geometry(lake_path)
    output = {}
    for n in nations:
        code = n['code']
        all_rows = [row for row in records if row['adm0_a3'] == {'PSE':'PSX'}.get(code, code)]
        if code in EXTRA:
            name, lat, lon = EXTRA[code]
        else:
            preferred = PREFERRED.get(code)
            matches = [r for r in all_rows if r['name'] == preferred] if preferred else [r for r in all_rows if r['adm0cap'] == '1']
            if len(matches) != 1:
                raise ValueError((code, [r['name'] for r in matches]))
            city = matches[0]
            name = DISPLAY.get(code, city['name'])
            lat, lon = float(city['latitude']), float(city['longitude'])
        raw = [round((lon+180)*1000/360,6), round((85-lat)*540/152,6)]
        plotted = marker(geometry(n['path']), lakes, *raw)
        note = NOTES.get(code, '')
        if math.dist(raw, plotted) > 0.05:
            note = (note + ' Its marker uses the nearest visible land at atlas scale.').strip() if note else 'The marker uses the nearest visible land at atlas scale.'
        output[code] = [name, *plotted] + ([note] if note else [])
    target = web/'capitals.js'
    old = target.read_text()
    start = old.index('  // BEGIN generated reference data')
    end = old.index('  // END generated reference data',start)
    rows = [f'  // BEGIN generated reference data\n  const cities = {{']
    for code, data in sorted(output.items()):
        rows.append('    '+code+':'+json.dumps(data, ensure_ascii=False, separators=(',',':'))+',')
    rows += ['  };','  const lakes = '+json.dumps(lake_path)+';','']
    target.write_text(old[:start]+'\n'.join(rows)+old[end:])
    print('Mapped', len(output), 'campaign capitals and', len(lakes), 'lake rings.')


if __name__ == '__main__':
    main()
