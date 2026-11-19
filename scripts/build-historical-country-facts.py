#!/usr/bin/env python3
"""Read official NMC v7 and Maddison 2023 archives, extract matched historical observations.

python3 scripts/build-historical-country-facts.py /path/to/NMCv7.zip /path/to/mpd2023_web.xlsx
Input archives used for the shipped snapshot:
https://correlatesofwar.org/wp-content/uploads/NMCv7.zip
  SHA-256 07b7396cbf0a06a3a57d97dfb56e316c5720b6feeab06db4578bcb6447be51a9
https://dataverse.nl/api/access/datafile/421302
  SHA-256 ecc5916ca12789b983fc4be437f8a354bbf4291323605324ac3e0aea4c57cbb6

Data definitions and citations are in web/historical-country-sources.html.
Uses only the Python standard library and Node (to read the game's existing atlas).
"""
import argparse
import csv
import io
import json
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
import subprocess
from xml.etree import ElementTree as ET
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / 'web'
YEARS = {'1886': 1886, 'ww1': 1914, 'ww2': 1939}
SOURCES = {
    'cow': {'title': 'National Material Capabilities v7', 'url': 'https://correlatesofwar.org/data-sets/national-material-capabilities/',
            'citation': 'Correlates of War Project. National Material Capabilities, version 7.0. Singer, Bremer and Stuckey (1972); Singer (1988).'},
    'mpd': {'title': 'Maddison Project Database 2023', 'url': 'https://www.rug.nl/ggdc/historicaldevelopment/maddison/releases/maddison-project-database-2023',
            'citation': 'Jutta Bolt and Jan Luiten van Zanden (2024). Maddison style estimates of the evolution of the world economy: A new 2023 update. Journal of Economic Surveys. DOI 10.1111/joes.12618. CC BY 4.0.'}
}

# Atlas code -> both the expected COW number and abbreviation. Absence of a
# country-year in NMC is meaningful; never use a different year or state.
COW = {}
for _entry in """
USA:2:USA CAN:20:CAN CUB:40:CUB HTI:41:HAI DOM:42:DOM MEX:70:MEX
GTM:90:GUA HND:91:HON SLV:92:SAL NIC:93:NIC CRI:94:COS PAN:95:PAN
COL:100:COL VEN:101:VEN ECU:130:ECU PER:135:PER BRA:140:BRA BOL:145:BOL
PRY:150:PAR CHL:155:CHL ARG:160:ARG URY:165:URU GBR:200:UKG IRL:205:IRE
NLD:210:NTH BEL:211:BEL LUX:212:LUX FRA:220:FRN CHE:225:SWZ ESP:230:SPN
PRT:235:POR DEU:255:GMY POL:290:POL AHU:300:AUH AUT:305:AUS HUN:310:HUN
CSK:315:CZE ITA:325:ITA ALB:339:ALB SRB:345:YUG YUG:345:YUG GRC:350:GRC
BGR:355:BUL ROU:360:ROM RUS:365:RUS EST:366:EST LVA:367:LAT LTU:368:LIT
FIN:375:FIN SWE:380:SWD NOR:385:NOR DNK:390:DEN LBR:450:LBR ETH:530:ETH
ZAF:560:SAF MAR:600:MOR IRN:630:IRN TUR:640:TUR IRQ:645:IRQ EGY:651:EGY
SAU:670:SAU YEM:678:YAR AFG:700:AFG CHN:710:CHN MNG:712:MON JPN:740:JPN
NPL:790:NEP THA:800:THI AUS:900:AUL NZL:920:NEW OMN:698:OMA
""".split():
    _atlas, _num, _ab = _entry.split(':')
    COW[_atlas] = (int(_num), _ab)

# These additional CShapes entities have no matched observation at any playable date.
UNMATCHED = {'VNM', 'KOR', 'ZAR', 'OFS', 'CFS', 'TIB', 'MNE', 'MDG'}

# GDP observations refer to named economies. Never attach one modern successor's
# GDP to a larger composite state. In particular skip modern Austria/Hungary
# for the Habsburg Empire, Turkey for the Ottomans and Sweden for Sweden–Norway.
ECONOMIES = set("""
USA CAN CUB DOM MEX GTM HND SLV NIC CRI PAN COL VEN ECU PER BRA BOL PRY CHL
ARG URY GBR IRL NLD BEL LUX FRA CHE ESP PRT ITA FIN NOR DNK NZL AUS
BGR HUN ROU GRC JPN
""".split())
METRO = {'GBR':'United Kingdom','NLD':'Netherlands','BEL':'Belgium','FRA':'France',
         'ESP':'Spain','PRT':'Portugal','ITA':'Italy','JPN':'Japan','DNK':'Denmark'}

# For changing polities, distinguish the statistical series from the historical
# country shown, and in particular from all territories controlled by an empire.
def state_scope(n, year, observed, population_source):
    code = n['code']
    if not observed:
        if population_source=='mpd':
            return 'Population is a midyear estimate from the Maddison Project. No military figure is available for this year.'
        return f'The historical sources have no matched population or military figure for {n["name"]} in {year}.'
    if code == 'GBR':
        return 'The population estimate covers the United Kingdom itself.'
    if code == 'SWE' and year == 1886:
        return 'In 1886 Sweden and Norway shared a monarch. Their union lasted from 1814 to 1905.'
    if code == 'SRB':
        return 'For this year the source series represents Serbia, before Yugoslavia formed.'
    if code == 'DEU' and year == 1939:
        return 'German statistical boundaries changed during annexations. They differ from the borders recognized on this map.'
    if code in {'CSK','ALB'} and year == 1939:
        return 'The source records a 1939 state estimate. Occupation and border changes mean its coverage can differ from the dated map.'
    if n['dependencies']:
        return 'The figures cover the state’s statistical territory. Some dependencies kept separate records.'
    return 'Annual estimates use the country boundaries in the historical records.'

def read_cow(path):
    with ZipFile(path) as outer:
        with ZipFile(io.BytesIO(outer.read('NMCv7/NMC-v7-abridged.zip'))) as inner:
            with inner.open('NMC-70-abridged.csv') as f:
                rows=list(csv.DictReader(io.TextIOWrapper(f,encoding='utf-8-sig',newline='')))
    out={}
    for row in rows:
        year=int(row['year'])
        if year not in YEARS.values():
            continue
        key=(int(row['ccode']),year)
        if key in out:
            raise ValueError(f'Duplicate COW record {key}')
        out[key]=row
    return out

def people(raw):
    value=Decimal(raw)
    if value==-9:
        return None
    if value<0 or value*1000!=(value*1000).to_integral_value():
        raise ValueError(f'Unexpected population/personnel value: {raw}')
    return int(value*1000)

def read_economies(path):
    with ZipFile(path) as z:
        shared=[''.join(n.itertext()) for n in ET.fromstring(z.read('xl/sharedStrings.xml'))]
        wb=ET.fromstring(z.read('xl/workbook.xml'))
        sheet=next(s for s in wb.findall('.//{*}sheet') if s.get('name')=='Full data')
        rel=next(v for k,v in sheet.attrib.items() if k.endswith('}id'))
        rels=ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
        f=next(r.get('Target') for r in rels if r.get('Id')==rel)
        out={}
        with z.open('xl/'+f) as data:
            for _,r in ET.iterparse(data,events=('end',)):
                if not r.tag.endswith('}row'):
                    continue
                cells={}
                for c in r.findall('{*}c'):
                    v=c.findtext('{*}v')
                    if v is not None:
                        cells[c.get('r').rstrip('0123456789')]=shared[int(v)] if c.get('t')=='s' else v
                r.clear()
                if cells.get('D')=='year':
                    if [cells[k] for k in 'ABCDEF']!=['countrycode','country','region','year','gdppc','pop']:
                        raise ValueError('Unexpected Maddison data columns')
                elif cells.get('D') in {'1886','1914','1939'} and cells.get('F') and cells.get('E'):
                    gdp_pc=Decimal(cells['E'])
                    pop=Decimal(cells['F'])*1000
                    if pop<=0 or gdp_pc<=0:
                        raise ValueError('Unexpected nonpositive GDP observation')
                    total=(gdp_pc*pop).quantize(Decimal('1E6'),rounding=ROUND_HALF_UP)
                    out[cells['A'],int(cells['D'])]=(int(total),cells['B'],int(pop.quantize(Decimal('1E3'),rounding=ROUND_HALF_UP)))
    return out

def economy_record(n,year,mpd):
    code=n['code']
    matched=code in ECONOMIES or code=='SWE' and year!=1886 or code=='TUR' and year==1939
    if not matched or (code,year) not in mpd:
        return None,None,None
    value,name,pop=mpd[code,year]
    if code in METRO:
        scope=f'The GDP estimate covers the {METRO[code]} domestic economy.' if code in {'GBR','NLD'} else f'The GDP estimate covers the domestic economy of {METRO[code]}.'
    else:
        scope=f'Maddison reports the economy of {name} for {year}.'
    return value,scope,pop

def atlas():
    js="const a=require('./web/historical-atlas'); console.log(JSON.stringify(Object.fromEntries(Object.entries(a).map(([k,s])=>[k,s.nations.map(({code,name,gwcode,dependencies})=>({code,name,gwcode,dependencies}))]))));"
    return json.loads(subprocess.check_output(['node','-e',js],cwd=ROOT))

def build(nmc,mpd):
    hist=atlas()
    cow=read_cow(nmc)
    econ=read_economies(mpd)
    flag_rows=json.loads((ROOT/'scripts/historical-flags.json').read_text())
    flags={}
    for flag in flag_rows:
        for era in flag['eras']:
            key=(era,flag['country'])
            if key in flags: raise ValueError(f'Duplicate flag {key}')
            flags[key]={k:v for k,v in flag.items() if k not in ('eras','country')}
    by_era={}
    for era,year in YEARS.items():
        by_era[era]={}
        for n in hist[era]:
            code=n['code']
            if code not in COW and code not in UNMATCHED:
                raise ValueError('Unreviewed state '+code)
            row=None
            if code in COW:
                key,abb=COW[code]
                if n['gwcode']!=(340 if code=='SRB' else key):
                    raise ValueError(f'New atlas/code mapping needs review: {code}')
                row=cow.get((key,year))
                if row is not None and row['stateabb']!=abb:
                    raise ValueError(f'Unverified source state {code}: {row["stateabb"]}')
            gdp,gs,economy_pop=economy_record(n,year,econ)
            pop=people(row['tpop']) if row else None
            pop_source='cow' if pop is not None else None
            if pop is None and economy_pop is not None:
                pop,pop_source=economy_pop,'mpd'
            record={'year':year,'population':pop,'populationSource':pop_source,
                    'militaryPersonnel':people(row['milper']) if row else None,
                    'scope':state_scope(n,year,row is not None,pop_source),'gdp':gdp}
            if row:
                record['cowState']=row['stateabb']
            if gs: record['gdpScope']=gs
            if (era,code) in flags: record['flag']=flags.pop((era,code))
            by_era[era][code]=record
    if flags: raise ValueError(f'Flag matched no atlas country: {list(flags)}')
    return {'sources':SOURCES,'byEra':by_era}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('nmc',type=Path)
    parser.add_argument('maddison',type=Path)
    args=parser.parse_args()
    data=build(args.nmc,args.maddison)
    text=json.dumps(data,ensure_ascii=False,separators=(',',':'))
    js=f"/* Generated by scripts/build-historical-country-facts.py. See historical-country-sources.html. */\n(function(root){{\n  const data={text};\n  root.DungeonHistoricalCountryFacts=data;\n  if(typeof module!=='undefined'&&module.exports)module.exports=data;\n}})(globalThis);\n"
    (WEB/'historical-country-facts.js').write_text(js)
    for era,rows in data['byEra'].items():
        print(era,len(rows),'states;',*(str(sum(r.get(k) is not None for r in rows.values()))+' '+k for k in ['population','militaryPersonnel','gdp','flag']))

if __name__=='__main__':
    main()
