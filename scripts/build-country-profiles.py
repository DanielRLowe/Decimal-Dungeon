#!/usr/bin/env python3
"""Build the offline modern country reference using the four WDI CSV ZIPs and UN M49.

Run python3 scripts/build-country-profiles.py to reproduce the bundled module.
--refresh downloads new WDI snapshots and the English geographic classification.
--check verifies the bundled JS against the existing inputs without writing.
The Vatican and DPRK exceptions below are separately dated primary-source readings.
"""
import argparse
import csv
import io
import json
import math
import subprocess
import tempfile
import urllib.request
import zipfile
from datetime import date
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / 'scripts' / 'profile-sources'
OUTPUT = ROOT / 'web' / 'country-profiles.js'
M49 = 'https://unstats.un.org/unsd/methodology/m49/overview/'
WORLD_BANK = 'World Bank, World Development Indicators'
INDICATORS = {
    'population': ('SP.POP.TOTL', 'Population', 'people',
                   'Estimated residents at midyear, including residents of every nationality.'),
    'gdp': ('NY.GDP.MKTP.CD', 'Gross domestic product', 'current US$',
            'The value produced by an economy during a year, measured in US dollars at that year’s prices.'),
    'area': ('AG.SRF.TOTL.K2', 'Surface area', 'km²',
             'Land, inland water, and certain coastal waterways within the country.'),
    'armedForces': ('MS.MIL.TOTL.P1', 'Armed forces personnel', 'people',
                    'Active-duty personnel across the military services. Paramilitary personnel count when their training, '
                    'organization, equipment and command allow them to support or take the place of regular forces. '
                    'Inactive reservists are excluded.'),
}
# Data from national and UN sources where WDI has no observation. Preserve the
# distinction between a reference year, a publication year and the date of a count.
EXCEPTIONS = {
    ('VAT', 'population'): {
        'value': 882, 'year': 2024, 'source': 'Vatican City State, population statistics',
        'url': 'https://www.vaticanstate.va/en/state-and-government/general-informations/population.html',
        'note': 'Residents counted on 31 December 2024, including citizens and non-citizens.',
    },
    ('VAT', 'area'): {
        'value': 0.44, 'year': 2025, 'source': 'Vatican City State, 2025 national report to the UN',
        'url': 'https://unfccc.int/sites/default/files/2025-09/Holy%2520See_NDC%25202035_September%25202025.pdf',
        'note': 'Territorial area reported in September 2025, page 3.',
    },
    ('PRK', 'gdp'): {
        'value': 16447000000, 'year': 2023, 'source': 'United Nations Statistics Division, UNdata country profile',
        'url': 'https://data.un.org/legacy/en/iso/kp.html',
        'note': 'UNdata gives 16,447 million current US dollars. Footnote b dates this observation to 2023.',
    },
}
GEO_COLS = ['ISO-alpha3 Code', 'ISO-alpha2 Code', 'Country or Area', 'Region Name', 'Sub-region Name', 'Intermediate Region Name']


class GeographyTable(HTMLParser):
    """Read the UNSD English download table, including text split across inline tags."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.inside = False
        self.rows = []
        self.row = None
        self.cell = None

    def handle_starttag(self, tag, attrs):
        if tag == 'table' and dict(attrs).get('id') == 'downloadTableEN':
            self.inside = True
        elif self.inside and tag == 'tr':
            self.row = []
        elif self.inside and tag in ('td', 'th'):
            self.cell = []

    def handle_data(self, data):
        if self.cell is not None:
            self.cell.append(data)

    def handle_endtag(self, tag):
        if not self.inside:
            return
        if tag in ('td', 'th') and self.cell is not None:
            self.row.append(' '.join(''.join(self.cell).split()))
            self.cell = None
        elif tag == 'tr':
            self.rows.append(self.row)
            self.row = None
        elif tag == 'table':
            self.inside = False


def save_geography(html, output):
    table = GeographyTable()
    table.feed(html.decode('utf-8-sig'))
    if not table.rows or not set(GEO_COLS).issubset(table.rows[0]):
        raise ValueError('Missing English M49 geography fields')
    indices = [table.rows[0].index(key) for key in GEO_COLS]
    with output.open('w', encoding='utf-8', newline='') as target:
        writer = csv.writer(target, lineterminator='\n')
        writer.writerow(GEO_COLS)
        for row in table.rows[1:]:
            if row and row[indices[0]]:
                writer.writerow(row[i] for i in indices)


def download_url(code):
    return f'https://api.worldbank.org/v2/en/indicator/{code}?downloadformat=csv'


def download(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Decimal-Dungeon offline atlas builder'})
    with urllib.request.urlopen(req, timeout=90) as response:
        return response.read()


def read_indicator(directory, code):
    with zipfile.ZipFile(directory / (code + '.zip')) as archive:
        def file(prefix):
            name, = [n for n in archive.namelist() if n.startswith(prefix + 'API_' + code + '_DS2_')]
            return io.StringIO(archive.read(name).decode('utf-8-sig'))
        data = file('')
        header = []
        for line in data:
            if line.startswith('"Country Name",'):
                data_rows = csv.DictReader(data, fieldnames=next(csv.reader([line])))
                break
            header.append(line)
        else:
            raise ValueError(f'Missing observations in {code}')
        meta = list(csv.DictReader(file('Metadata_Indicator_')))
        country_meta = {r['Country Code']: r for r in csv.DictReader(file('Metadata_Country_'))}
        update, = [row[1] for row in csv.reader(header) if row and row[0] == 'Last Updated Date']
        date.fromisoformat(update)
        if len(meta) != 1 or meta[0]['INDICATOR_CODE'] != code:
            raise ValueError(f'Unexpected indicator metadata in {code}')
        years = sorted((y for y in data_rows.fieldnames if y.isdigit()), reverse=True)
        observations = {}
        for row in data_rows:
            if row['Indicator Code'] != code:
                raise ValueError(f'Wrong indicator in {code}')
            year = next((y for y in years if row[y].strip()), None)
            if year:
                raw = row[year]
                number = int(raw) if raw.isdigit() else float(raw)
                if not math.isfinite(number) or number < 0:
                    raise ValueError(f'Unexpected value for {code}')
                observations[row['Country Code']] = {'value': number, 'year': int(year)}
        return observations, country_meta, update, meta[0]['SOURCE_ORGANIZATION']


def build(directory):
    # Use the roster and curated city notes already shipped in the atlas. World
    # Bank data also contains territories and aggregates that are not game IDs.
    js = """const atlas=require('./web/campaign-data.js'), caps=require('./web/capitals.js');
console.log(JSON.stringify(atlas.NATIONS.map(n=>({code:n.code,iso2:n.iso2,name:n.name,city:caps.get(n.id)}))));"""
    nations = json.loads(subprocess.check_output(['node', '-e', js], cwd=ROOT))
    with (directory / 'un-m49.csv').open(encoding='utf-8', newline='') as table:
        geo = {r['ISO-alpha3 Code']:r for r in csv.DictReader(table)}
    profiles = {}
    for n in nations:
        code = n['code']
        place = geo[code]
        if place['ISO-alpha2 Code'] != n['iso2']:
            raise ValueError(f'Conflicting atlas/UN identity for {code}')
        profiles[code] = {
            'code':code, 'name':n['name'], 'capital':n['city']['name'], 'capitalNote':n['city']['note'],
            'region':place['Region Name'], 'subregion':place['Sub-region Name'],
            'intermediateRegion':place['Intermediate Region Name'] or None,
            'links':{'geography':f"https://data.un.org/legacy/en/iso/{n['iso2'].lower()}.html", 'worldBank':None},
        }
    metadata = {}
    for key, (code,label,unit,definition) in INDICATORS.items():
        observations,country_meta,update,publisher = read_indicator(directory, code)
        metadata[key] = {
            'code':code, 'label':label, 'unit':unit, 'definition':definition, 'source':WORLD_BANK,
            'contributors':publisher, 'updated':update, 'url':f'https://data.worldbank.org/indicator/{code}',
            'downloadUrl':download_url(code),
            'metadataUrl':f'https://databank.worldbank.org/metadataglossary/world-development-indicators/series/{code}',
        }
        for n in nations:
            iso = n['code']
            record = profiles[iso]
            observation = observations.get(iso)
            # A source-reported zero is a real observation.
            record[key] = observation if observation is not None else EXCEPTIONS.get((iso,key))
            if iso in country_meta:
                record['worldBankName'] = country_meta[iso]['TableName']
                record['links']['worldBank'] = f"https://data.worldbank.org/?locations={n['iso2']}"
    def line(obj):
        return json.dumps(obj,ensure_ascii=False,separators=(',', ':'),allow_nan=False)
    country_rows = ',\n'.join('    '+line(key)+':'+line(record) for key,record in profiles.items())
    return f"""/* Generated by scripts/build-country-profiles.py from World Development Indicators,
 * UN M49 and the atlas's curated capital references. Each observation carries its own year. */
(function(root) {{
  'use strict';
  const indicators={line(metadata)};
  const profiles={{
{country_rows}
  }};
  function get(code) {{
    const key=typeof code==='string'?code.toUpperCase():'';
    return Object.hasOwn(profiles,key)?profiles[key]:null;
  }}
  const api={{get,indicators,geographySource:{line(M49)},license:'https://creativecommons.org/licenses/by/4.0/'}};
  root.DungeonCountryProfiles=api;
  if(typeof module!=='undefined' && module.exports)module.exports=api;
}})(globalThis);
"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--refresh', action='store_true', help='replace cached source snapshots with new downloads')
    mode.add_argument('--check', action='store_true', help='compare generated output without writing')
    args = parser.parse_args()
    if args.refresh:
        with tempfile.TemporaryDirectory() as tmp:
            incoming=Path(tmp)
            for code, *_ in INDICATORS.values():
                (incoming / f'{code}.zip').write_bytes(download(download_url(code)))
            save_geography(download(M49), incoming / 'un-m49.csv')
            output = build(incoming)
            SOURCES.mkdir(exist_ok=True)
            for f in incoming.iterdir():
                (SOURCES / f.name).write_bytes(f.read_bytes())
    else:
        output = build(SOURCES)
    if args.check:
        if OUTPUT.read_text(encoding='utf-8') != output:
            raise SystemExit('Rebuild web/country-profiles.js from the archived source files')
    else:
        OUTPUT.write_text(output,encoding='utf-8')


if __name__ == '__main__':
    main()
