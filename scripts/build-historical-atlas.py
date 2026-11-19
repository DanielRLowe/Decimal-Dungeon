#!/usr/bin/env python3
"""Generate three offline political atlases. Run from any directory:
python3 scripts/build-historical-atlas.py cshapes_2.0.tar.gz ne_110m_land.zip

Primary data and license: https://icr.ethz.ch/data/cshapes/
Use the GW TopoJSON inside the publisher's R archive. Unlike the companion
shapefile, it includes status, governing polity and shared geographic arcs.
The second input is Natural Earth's public-domain 1:110m physical land.
See web/historical-atlas-credits.html for dates, scope, corrections and credit.
"""
import argparse
from collections import Counter, defaultdict
import json
import lzma
from pathlib import Path
import runpy
import tarfile
import zipfile

HERE = Path(__file__).resolve().parent
WORLD = runpy.run_path(str(HERE/'build-world-atlas.py'))
CAPS = runpy.run_path(str(HERE/'build-capitals.py'))
project, number, area = WORLD['project'], WORLD['number'], WORLD['area']
GEOMETRY, INSIDE, MARKER = CAPS['geometry'], CAPS['inside'], CAPS['marker']
ERAS = [
    ('1886','1886-07-01','July 1, 1886','The world in 1886',
     'The Ottoman, Russian and Qing empires span much of Eurasia. Colonial borders in parts of Africa are still taking shape.'),
    ('ww1','1914-07-01','July 1, 1914','World War I',
     'In the weeks before World War I, Austria-Hungary borders Serbia. The German, Russian and Ottoman empires are still on the map.'),
    ('ww2','1939-08-31','August 31, 1939','World War II',
     'The day before Germany invaded Poland. This map follows recognized borders, so Austria and Czechoslovakia appear despite German annexation and occupation.')
]
# GW numerical identifiers locate the same historical state across snapshots.
# Three-letter map codes (including present-day geographical aliases) support
# stable labeling and search. No contemporary flag is assigned to a period state.
CODES = dict(item.split(':') for item in """
2:USA 20:CAN 40:CUB 41:HTI 42:DOM 70:MEX 90:GTM 91:HND 92:SLV 93:NIC 94:CRI 95:PAN
100:COL 101:VEN 130:ECU 135:PER 140:BRA 145:BOL 150:PRY 155:CHL 160:ARG 165:URY
200:GBR 205:IRL 210:NLD 211:BEL 212:LUX 220:FRA 225:CHE 230:ESP 235:PRT 255:DEU
290:POL 300:AHU 305:AUT 310:HUN 315:CSK 325:ITA 339:ALB 340:SRB 341:MNE 345:YUG
350:GRC 355:BGR 360:ROU 365:RUS 366:EST 367:LVA 368:LTU 375:FIN 380:SWE 385:NOR 390:DNK
450:LBR 490:CFS 530:ETH 560:ZAF 563:ZAR 564:OFS 580:MDG 600:MAR 630:IRN 640:TUR 645:IRQ
651:EGY 670:SAU 678:YEM 698:OMN 700:AFG 710:CHN 711:TIB 712:MNG 730:KOR 740:JPN
790:NPL 800:THA 815:VNM 900:AUS 920:NZL
""".split())
# CShapes uses one name field for every historical incarnation of a state.
# Prefer the name on the selected date. Names below also avoid modern aliases
# in dependency lists, where one record can span an independence/name change.
NAMES = {
    2:'United States',20:'Canada',80:'British Honduras',110:'British Guiana',115:'Suriname',
    120:'French Guiana',200:'British Empire',325:'Kingdom of Italy',360:'Romania',
    404:'Portuguese Guinea',411:'Spanish Guinea',434:'Dahomey',452:'Gold Coast',
    470:'Kamerun',482:'Ubangi-Shari',484:'French Congo',500:'Uganda',
    521:'British Somaliland',522:'French Somaliland',530:'Ethiopian Empire',
    551:'Northern Rhodesia',552:'Southern Rhodesia',553:'Nyasaland',560:'Union of South Africa',
    563:'South African Republic',565:'South West Africa',570:'Basutoland',571:'Bechuanaland',
    572:'Swaziland',580:'Madagascar',585:'Réunion',678:'Kingdom of Yemen',663:'Transjordan',
    665:'Mandatory Palestine',696:'Trucial States',698:'Muscat and Oman',713:'Taiwan',
    740:'Empire of Japan',750:'British India',775:'Burma',780:'Ceylon',811:'Cambodia',
    823:'North Borneo',850:'Dutch East Indies',860:'Portuguese Timor',911:'Papua',
    940:'Solomon Islands',3461:'Bosnia',3462:'Herzegovina',7020:'Emirate of Bukhara',7030:'Khanate of Khiva',
    7351:'Karafuto',8202:'Selangor'
}
DATES = {
    1886:{140:'Empire of Brazil',255:'German Empire',365:'Russian Empire',380:'Sweden–Norway',
          490:'Congo Free State',565:'German South West Africa',630:'Persia',640:'Ottoman Empire',
          710:'Qing Empire',730:'Joseon Korea',800:'Siam',815:'Annam',912:'German New Guinea'},
    1914:{255:'German Empire',365:'Russian Empire',432:'Upper Senegal and Niger',490:'Belgian Congo',
          501:'East Africa Protectorate',510:'German East Africa',565:'German South West Africa',630:'Persia',
          640:'Ottoman Empire',710:'Republic of China',800:'Siam',815:'Annam, Tonkin and Cochinchina',912:'German New Guinea'},
    1939:{255:'Germany',365:'Soviet Union',432:'French Sudan',461:'French Togoland',471:'French Cameroun',
          490:'Belgian Congo',510:'Tanganyika',630:'Iran',640:'Turkey',710:'Republic of China',
          800:'Thailand',815:'Annam, Tonkin and Cochinchina',912:'Territory of New Guinea'}
}
CITY_NAMES = {'Washington':'Washington, D.C.','San Jose':'San José','Bogota':'Bogotá','Asuncion':'Asunción',
              'Masqat':'Muscat','Bukarest':'Bucharest','Durres':'Durrës','Tirane':'Tirana',
              'Saint Petersburg (Petrograd)':'Saint Petersburg','Ulan Bator':'Ulaanbaatar'}
# Corrections to capital sites / city names, with supporting sources in credits.
CITY_SITES = {(1886,145):('Sucre',-65.2619,-19.0471),(1886,530):('Mekelle',39.4753,13.4967),
              (1886,600):('Fez',-4.9998,34.0331),(1939,710):('Chongqing',106.5516,29.5630),
              (1939,230):('Burgos',-3.7045,42.3439)}
CITY_NOTES = {(1886,530):'Emperor Yohannes IV held court in Mekelle.',
              (1886,490):'Leopold II ruled the Congo Free State personally. Belgium took it over in 1908.',
              (1939,710):'Chongqing was the wartime seat of China’s national government.',
              (1939,230):'The government remained in Burgos until October 1939.',
              (1939,305):'Germany annexed Austria in 1938. CShapes retains its recognized outline.',
              (1939,315):'By this date the state had been broken apart. CShapes preserves its recognized outline.',
              (1939,530):'Italy occupied Ethiopia in 1936. CShapes retains Ethiopia’s recognized outline.'}
# Deliberate game crossings, with endpoints given as period territorial units.
# If these units belong to the same power or already meet by land, omit the link.
CROSSINGS = [(2,40),(2,200),(2,4),(4,740),(20,200),(41,40),(41,51),(42,6),(51,40),(70,40),
 (140,433),(220,200),(200,385),(390,380),(390,385),(380,375),(325,338),(325,616),(350,640),
 (230,600),(600,402),(580,541),(580,590),(740,710),(740,730),(730,710),(740,365),(740,840),
 (750,780),(750,698),(850,900),(850,800),(900,920),(912,900),(920,950),(698,651)]
# Overland links appear only through actual shared arcs. Crossings between
# separate territorial units below are only included if they join across water.



def named(p, year):
    return DATES[year].get(p['gwcode'],NAMES.get(p['gwcode'],p['country_name'].split(' (')[0]))


def region(g):
    if g < 100: return 'North America and the Caribbean'
    if g < 200: return 'South America'
    if g < 400: return 'Europe'
    if g < 630: return 'Africa'
    if g in (640,): return 'Europe and Asia'
    if g < 900: return 'Asia'
    return 'Oceania'


def read_source(path):
    with tarfile.open(path) as archive:
        item=archive.extractfile('cshapes/inst/extdata/cshapes_2_gw.topojson.xz')
        data=json.loads(lzma.decompress(item.read()))
    assert 'transform' not in data, 'This release stores absolute coordinates'
    return data['objects']['cshapes_2_gw']['geometries'],data['arcs']


def geometries(feature):
    return [feature['arcs']] if feature['type']=='Polygon' else feature['arcs']


def simplified(points, tolerance=.07):
    """Douglas-Peucker on projected shared arcs: same border on both sides."""
    p=[points[0]]
    p.extend(x for i,x in enumerate(points[1:]) if x!=points[i])
    if len(p)<=3: return p
    keep={0,len(p)-1}
    segments=[(0,len(p)-1)]
    while segments:
        a,b=segments.pop()
        ax,ay=p[a]; bx,by=p[b]; dx,dy=bx-ax,by-ay
        denom=dx*dx+dy*dy
        best=tolerance*tolerance
        pivot=None
        for j in range(a+1,b):
            x,y=p[j]
            t=max(0,min(1,((x-ax)*dx+(y-ay)*dy)/denom)) if denom else 0
            err=(x-ax-t*dx)**2+(y-ay-t*dy)**2
            if err>best: pivot,best=j,err
        if pivot is not None:
            keep.add(pivot)
            segments.extend([(a,pivot),(pivot,b)])
    if p[0]==p[-1] and len(keep)<4: return p
    return [p[i] for i in sorted(keep)]


def absref(ref):
    return ref if ref>=0 else ~ref


def ring_points(refs, arcs):
    result=[]
    for ref in refs:
        a=arcs[absref(ref)]
        if ref<0: a=a[::-1]
        result.extend(a if not result else a[1:])
    return result


def svg(rings):
    return ''.join('M'+' '.join(number(x)+','+number(y) for x,y in r[:-1])+'Z' for r in rings
                   if len(r)>3 and r[0]==r[-1] and area(r)>.00001)


def union_path(countries, arcs):
    # Remove shared internal arcs, then join the remaining oriented arc ends.
    refs=Counter(ref for c in countries for poly in geometries(c) for ring in poly for ref in ring)
    boundary=[]
    for ref,count in refs.items():
        if count>refs[~ref]: boundary.append(ref)
    starts=defaultdict(set)
    def end(ref,first):
        a=arcs[absref(ref)]
        return a[0 if first==(ref>=0) else -1]
    for ref in boundary: starts[end(ref,True)].add(ref)
    remaining=set(boundary)
    loops=[]
    while remaining:
        head=min(remaining); pos=end(head,True); start=pos; chain=[]
        while True:
            next_ref=min(starts[pos] & remaining)
            chain.append(next_ref); remaining.remove(next_ref); pos=end(next_ref,False)
            if pos==start: break
        loops.append(ring_points(chain,arcs))
    return svg(loops)


def label_point(core, arcs, city):
    # Attach the sovereign label to its core territory, away from overseas possessions.
    options=[ring_points(poly[0],arcs) for poly in geometries(core)]
    ring=max(options,key=area)
    xs,ys=zip(*ring)
    poly=GEOMETRY(svg([ring]))
    best=None
    for j in range(1,20):
        y=min(ys)+(max(ys)-min(ys))*j/20
        cross=sorted(p[0]+(q[0]-p[0])*(y-p[1])/(q[1]-p[1])
                     for p,q in zip(ring,ring[1:]) if (p[1]>y)!=(q[1]>y))
        for lo,hi in zip(cross[::2],cross[1::2]):
            x=(lo+hi)/2
            weight=(hi-lo)*(1-0.25*abs(j-10)/10)
            if best is None or weight>best[0]:best=(weight,round(x,2),round(y,2))
    if best and INSIDE(poly,*best[1:]): return best[1:]
    return city


def component_info(feature, arcs):
    """Area for label priority and a camera box for the largest polygon."""
    parts=[(ring_points(poly[0],arcs),[ring_points(r,arcs) for r in poly[1:]]) for poly in geometries(feature)]
    main=max(parts,key=lambda part:area(part[0]))[0]
    xs,ys=zip(*main)
    total=sum(area(outer)-sum(area(hole) for hole in holes) for outer,holes in parts)
    return round(total,2),[min(xs),min(ys),max(xs),max(ys)]


def shore_points(feature, arcs, unit_shares):
    """Boundary samples on edges where the historical map records no land neighbor."""
    refs={absref(ref) for poly in geometries(feature) for ring in poly for ref in ring}
    pts=sorted({p for arc in refs if len(unit_shares[arc])==1 for p in arcs[arc]})
    if not pts: raise ValueError(('Missing shore',feature['properties']['country_name']))
    return pts


def shortest_crossing(a,b):
    # Compare sampled coasts first, then compare nearby full-resolution points.
    # Wrap the horizontal separation across the Pacific dateline.
    def separation(p,q):
        dx=abs(p[0]-q[0])
        return min(dx,1000-dx)**2+(p[1]-q[1])**2
    def closest(a,b):
        return min((separation(p,q),p,q) for p in a for q in b)
    _,ca,cb=closest(a[::max(1,len(a)//96)],b[::max(1,len(b)//96)])
    a0=sorted(a,key=lambda x:separation(x,ca))[:48]
    b0=sorted(b,key=lambda x:separation(x,cb))[:48]
    return closest(a0,b0)


def render_era(key,date,label,title,description,features,arcs):
    year=int(date[:4])
    groups=defaultdict(list); owners={}; properties={}; units={}
    for f in features:
        p=f['properties']
        if p['start']<=date<=p['end']:
            g=p['gwcode']
            # Distinguish Leopold II's personal possession from the Belgian state.
            own=g if (year,g)==(1886,490) else int(p['owner'])
            owners[g]=own; properties[g]=p; units[g]=f; groups[own].append(f)
    roster=sorted(groups)
    ids={gw:i for i,gw in enumerate(roster)}
    land=defaultdict(set); sea=defaultdict(set); routes=defaultdict(set); shares=defaultdict(set)
    unit_shares=defaultdict(set); coasts={}; links={}
    for own,parts in groups.items():
        for part in parts:
            for poly in geometries(part):
                for loop in poly:
                    for ref in loop:
                        shares[absref(ref)].add(own)
                        unit_shares[absref(ref)].add(part['properties']['gwcode'])
    for adjacent in shares.values():
        for a in adjacent: land[a].update(adjacent-{a})
    for ac,bc in CROSSINGS:
        a,b=owners.get(ac),owners.get(bc)
        if a is None or b is None or a==b or b in land[a]:
            continue
        if a>b: a,b,ac,bc=b,a,bc,ac
        for unit in [ac,bc]:
            if unit not in coasts: coasts[unit]=shore_points(units[unit],arcs,unit_shares)
        distance,pa,pb=shortest_crossing(coasts[ac],coasts[bc])
        key0=(a,b)
        if key0 not in links or distance<links[key0][0]:
            links[key0]=(distance,'sea',pa,pb,named(properties[ac],year),named(properties[bc],year))
        sea[a].add(b); sea[b].add(a)
    # Link the Ethiopian highlands and Italian coastal territory across the
    # unmapped gap via Massawa. Use interior sites for the two route markers.
    if year==1886:
        a,b=owners[530],owners[531]
        start=project(39.4753,13.4967)
        shore=project(39.454,15.609)
        endpoint=tuple(MARKER(GEOMETRY(union_path([units[531]],arcs)),[],*shore))
        if a<b: links[a,b]=(0,'expedition',start,endpoint,'Mekelle','Italian Red Sea coast')
        else: links[b,a]=(0,'expedition',endpoint,start,'Italian Red Sea coast','Mekelle')
        routes[a].add(b);routes[b].add(a)
    local_routes=defaultdict(list)
    for (a,b),(_,kind,pa,pb,na,nb) in links.items():
        for src,dst,fr,to,fr_name,to_name in [(a,b,pa,pb,na,nb),(b,a,pb,pa,nb,na)]:
            local_routes[src].append(dict(to=ids[dst],type=kind,fromX=fr[0],fromY=fr[1],toX=to[0],toY=to[1],
                                          fromName=fr_name,toName=to_name))
    rows=[]
    for g in roster:
        p=properties[g]
        core=next(f for f in groups[g] if f['properties']['gwcode']==g)
        path=union_path(groups[g],arcs)
        name=named(p,year)
        cap=CITY_NAMES.get(p['capname'],p['capname'])
        if g==385 and year==1914:cap='Kristiania'
        if g==640 and year!=1939:cap='Constantinople'
        cap,lon,lat=CITY_SITES.get((year,g),(cap,p['caplong'],p['caplat']))
        geometry=GEOMETRY(path)
        cx,cy=MARKER(geometry,[],*project(lon,lat))
        x,y=label_point(core,arcs,(cx,cy))
        if not INSIDE(geometry,x,y): x,y=cx,cy
        deps=[]
        sizes={f['properties']['gwcode']:component_info(f,arcs) for f in groups[g]}
        for f in groups[g]:
            if f==core:continue
            data=f['properties']; dep_id=data['gwcode']
            site=project(data['caplong'],data['caplat'])
            part_geo=GEOMETRY(union_path([f],arcs))
            xx,yy=label_point(f,arcs,site)
            if not INSIDE(part_geo,xx,yy) or not INSIDE(geometry,xx,yy):
                xx,yy=MARKER(part_geo,[],*site)
            dep_area,bounds=sizes[dep_id]
            deps.append(dict(name=named(data,year),status=data['status'],x=xx,y=yy,mapArea=dep_area,bounds=bounds))
        deps.sort(key=lambda r:r['name'])
        rows.append(dict(id=ids[g],gwcode=g,code=CODES[str(g)],iso2='',name=name,region=region(g),x=x,y=y,
                    tiny=max(area(ring_points(poly[0],arcs)) for poly in geometries(core)) < 9,
                    path=path,capital=cap,capitalX=cx,capitalY=cy,capitalNote=CITY_NOTES.get((year,g),''),
                    dependencies=[d['name'] for d in deps],dependencyDetails=deps,
                    mapArea=round(sum(value[0] for value in sizes.values()),2),routes=sorted(local_routes[g],key=lambda r:r['to']),
                    neighbors=sorted(ids[b] for b in land[g]|sea[g]|routes[g]),seaNeighbors=sorted(ids[b] for b in sea[g]),
                    expeditionNeighbors=sorted(ids[b] for b in routes[g])))
    reach={0}; todo=[0]
    while todo:
        extra=set(rows[todo.pop()]['neighbors'])-reach
        reach.update(extra);todo.extend(extra)
    if len(reach)!=len(rows):
        raise ValueError((key,'unconnected',[(r['gwcode'],r['name'],r['neighbors']) for r in rows if r['id'] not in reach]))
    return dict(id=key,title=title,label=title,date=date,dateLabel=label,description=description,
                notes='Colonies and protectorates are grouped under the governing power recorded by CShapes. Separate dominions follow the source. Pale land lies outside its mapped states. Sea crossings and land expeditions are game routes.',
                CAPITAL_ID=ids[2],nations=rows)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive');parser.add_argument('land')
    args=parser.parse_args()
    features,raw=read_source(args.archive)
    arcs=[simplified([project(*coord) for coord in arc]) for arc in raw]
    maps={era[0]:render_era(*era,features,arcs) for era in ERAS}
    with zipfile.ZipFile(args.land) as z:
        geoms=WORLD['shape_records'](z.read(next(n for n in z.namelist() if n.endswith('.shp'))))
        base=''.join(WORLD['shape'](rings) for rings in geoms if max(lat for ring in rings for lon,lat in ring)>-60)
    pathlist=[]; positions={}
    for board in maps.values():
        for n in board['nations']:
            path=n.pop('path')
            if path not in positions:positions[path]=len(pathlist);pathlist.append(path)
            n['shapeId']=positions[path]
    def encode(o):return json.dumps(o,ensure_ascii=False,separators=(',',':'))
    output=HERE.parent/'web'/'historical-atlas.js'
    with output.open('w') as f:
        f.write('/* CShapes 2.0 adapted by Decimal Dungeon. CC BY-NC-SA 4.0. Full attribution: historical-atlas-credits.html. */\n(function(root){\n')
        f.write('  const paths='+encode(pathlist)+';\n  const landPath='+encode(base)+';\n  const maps='+encode(maps)+';\n')
        f.write("""  const colors=['#a8bd8c','#d6b780','#8eb4bb','#be9caa','#c7b398','#b7aaca','#9cb7a6','#c49d84','#a1b4c9','#b9be92','#b89fbd','#c4a98e','#91bbae'];
  const encounters=['A mossy clearing','A crystal cavern','An ancient ruin','A lantern-lit keep','A dragon’s lair','A moonlit castle'];
  for(const board of Object.values(maps)){
    for(const n of board.nations){
      n.path=paths[n.shapeId];delete n.shapeId;
      const used=new Set(n.neighbors.map(id=>board.nations[id].color));
      const start=n.gwcode%colors.length;
      const candidates=colors.slice(start).concat(colors.slice(0,start));
      n.color=candidates.find(c=>!used.has(c)) || candidates[0];
      n.biome=n.id%encounters.length; n.terrain=encounters[n.biome];
      const k=Math.floor(n.id/encounters.length);
      n.rank=k%5===4?'boss':k%5===2?'special':'normal';n.variant=k%2;
      Object.freeze(n.neighbors);Object.freeze(n.seaNeighbors);Object.freeze(n.expeditionNeighbors);Object.freeze(n.dependencies);
      n.dependencyDetails.forEach(d=>{Object.freeze(d.bounds);Object.freeze(d);});Object.freeze(n.dependencyDetails);
      n.routes.forEach(Object.freeze);Object.freeze(n.routes);Object.freeze(n);
    }
    board.WIDTH=1000;board.HEIGHT=540;board.landPath=landPath;board.NATIONS=Object.freeze(board.nations);
    board.credit='CShapes 2.0 · CC BY-NC-SA 4.0';Object.freeze(board);
  }
  root.DungeonHistoricalAtlases=Object.freeze(maps);
  if(typeof module!=='undefined'&&module.exports)module.exports=root.DungeonHistoricalAtlases;
})(globalThis);
""")
    print('Wrote',output.name,output.stat().st_size,'bytes', {k:len(v['nations']) for k,v in maps.items()})


if __name__=='__main__':main()
