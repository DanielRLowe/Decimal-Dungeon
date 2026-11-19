/* Offline geography reference for the campaign's selected country and map date. */
(function (root) {
  'use strict';
  const whole = new Intl.NumberFormat('en-US', {maximumFractionDigits: 2});
  const compact = new Intl.NumberFormat('en-US', {notation:'compact', compactDisplay:'long', maximumFractionDigits:1});
  const list = new Intl.ListFormat('en-US', {style:'long', type:'conjunction'});
  const naturalEarth = 'https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-0-countries-2/';
  const cShapes = 'https://icr.ethz.ch/data/cshapes/';
  const escape = text => String(text).replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const historical = (era,n) => root.DungeonHistoricalCountryFacts.byEra[era.id]?.[n.code];
  const modern = n => root.DungeonCountryProfiles.get(n.code);
  const number = value => Math.abs(value) >= 1000000 ? compact.format(value) : whole.format(value);
  const mapDate = date => new Intl.DateTimeFormat('en-US',{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'}).format(new Date(date+'T00:00:00Z'));

  function flagFor(era, n) {
    if (era.id !== 'modern') return historical(era,n)?.flag;
    if (/^[A-Z]{2}$/.test(n.iso2)) {
      return {emoji:String.fromCodePoint(...Array.from(n.iso2, letter=>127397+letter.charCodeAt(0))),
        caption:'Flag of '+(n.originalName || n.name)};
    }
  }
  function flagMarkup(era, n) {
    const flag = flagFor(era,n);
    if (!flag) return '';
    return flag.src ? '<img class="cm-period-flag" src="'+escape(flag.src)+'" alt="" title="'+escape(flag.caption)+'">' :
      '<span class="cm-emoji" aria-hidden="true" title="'+escape(flag.caption)+'">'+escape(flag.emoji)+'</span>';
  }
  function preview(era, n) {
    const isModern = era.id === 'modern';
    const entry = isModern ? modern(n)?.population : historical(era,n);
    const value = isModern ? entry?.value : entry?.population;
    return value != null ? 'Population · '+number(value)+' ('+entry.year+')' : 'Explore the '+(isModern?'modern world':era.date.slice(0,4))+' atlas';
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  function sourceLink(label, url) {
    const anchor = element('a', 'guide-link', label);
    anchor.href = url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.setAttribute('aria-label',label+' (opens in browser)');
    return anchor;
  }
  function locator(era, n) {
    // The historical atlases share Natural Earth's physical coastline, also valid for the modern locator.
    const coast = root.DungeonHistoricalAtlases.ww2.landPath;
    const figure = element('figure','guide-locator');
    const capital = era.capitals.get(n.id);
    figure.innerHTML = '<svg viewBox="0 0 1000 540" aria-hidden="true"><path class="guide-coast" d="'+escape(coast)+'"/>'+
      '<path class="guide-outline" d="'+escape(n.path)+'"/>'+
      (capital?'<circle class="guide-pin-halo" cx="'+capital.x+'" cy="'+capital.y+'" r="16"/><circle class="guide-pin" cx="'+capital.x+'" cy="'+capital.y+'" r="7"/>':'')+'</svg>';
    if (capital) figure.append(element('figcaption','','Capital on map'));
    return figure;
  }
  function inSentence(name) {
    if (name.startsWith('The ')) return 'the '+name.slice(4);
    const article = /^(United States|United Kingdom|United Arab Emirates|Netherlands|Philippines|Central African Republic|Dominican Republic|(?:Democratic )?Republic of .+|Marshall Islands|Solomon Islands|Comoros|Seychelles|Maldives|Gambia|Kingdom of .+|Empire of .+|Union of .+|Soviet Union|South African Republic|Orange Free State|Congo Free State|.+ Empire)$/;
    return article.test(name) ? 'the '+name : name;
  }
  function introduction(era, n) {
    const original = era.board.NATIONS[n.id];
    const name = inSentence(original.name);
    const isModern = era.id === 'modern';
    const city = era.capitals.get(n.id);
    const facts = isModern ? modern(n) : null;
    const region = facts?.intermediateRegion || facts?.subregion || original.region;
    const sentences = [isModern ? name[0].toUpperCase()+name.slice(1)+' is in '+region+'.' :
      'Find '+name+' in '+region+' on the map for '+mapDate(era.date)+'.'];
    if (city?.note) sentences.push(city.note);
    else if (city?.name) {
      const cityName = city.name.endsWith('.') ? city.name : city.name+'.';
      sentences.push((isModern ? 'Its capital is ' : 'Its capital on this map is ')+cityName);
    }
    if (!isModern && original.dependencies?.length) {
      sentences.push('Territories grouped with '+name+' on this map include '+list.format(original.dependencies.slice(0,3).map(inSentence))+'.');
    } else {
      const sea = new Set([...(original.seaNeighbors || []), ...(original.expeditionNeighbors || [])]);
      const land = original.neighbors.filter(id=>!sea.has(id)).map(id=>inSentence(era.board.NATIONS[id].name));
      if (land.length) sentences.push('Look along its land '+(land.length===1?'border':'borders')+' to find '+list.format(land.slice(0,3))+'.');
      else if (city) {
        const north = city.y < 85*540/152;
        sentences.push(city.name+' is '+(north?'north':'south')+' of the equator.');
      }
    }
    return sentences.join(' ');
  }
  function statistic(key, label, display, year, meaning, source) {
    const cell = element('div','guide-stat');
    cell.dataset.stat = key;
    const heading = element('div','guide-stat-title');
    heading.append(element('h3','',label));
    if (year && display != null) heading.append(element('span','guide-year',year));
    cell.append(heading,element('strong',display == null?'guide-empty':'guide-value',display ?? 'No figure available'),element('p','',meaning));
    if (source) cell.append(sourceLink(source.title,source.url));
    return cell;
  }
  function currentStats(n, grid) {
    const data = modern(n), indicators = root.DungeonCountryProfiles.indicators;
    for (const [key,label,definition] of [
      ['population','Population','People who live in the country.'],
      ['gdp','GDP','The value of goods and services produced in one year, measured in that year’s US dollars.'],
      ['armedForces','Armed forces personnel','People serving on active duty across the military. The estimate also counts some paramilitary forces.'],
      ['area','Surface area','Land and water within the country, measured in square kilometers.']
    ]) {
      const stat = data?.[key], indicator = indicators[key];
      let value = null;
      if (stat) {
        value = number(stat.value);
        if (key==='gdp') value = 'US$'+value;
        if (key==='area') value += ' km²';
        if (key==='armedForces' && stat.value===0) value = '0 reported';
      }
      const source = stat?.url ? {title:stat.source, url:stat.url} :
        {title:key==='armedForces'?'World Bank · IISS':'World Bank', url:indicator.url+(data.links.worldBank?'?locations='+encodeURIComponent(n.iso2):'')};
      const cell = statistic(key,label,value,stat?.year,stat?.note ? definition+' '+stat.note : definition,source);
      if (stat) cell.querySelector('strong').title = whole.format(stat.value)+' '+indicator.unit;
      grid.append(cell);
    }
  }
  function periodStats(era,n,grid) {
    const data = historical(era,n);
    const {cow,mpd} = root.DungeonHistoricalCountryFacts.sources;
    const cowLink = {title:'Correlates of War',url:cow.url};
    const year = Number(era.date.slice(0,4));
    const maddisonLink = {title:'Maddison Project Database',url:mpd.url};
    grid.append(statistic('population','Estimated population',data?.population == null ? null : number(data.population),year,
      data?.populationSource==='mpd' ? 'People living in the area covered by the historical economy estimate.' :
        'People recorded in the historical population series.',data?.populationSource==='mpd' ? maddisonLink : cowLink));
    grid.append(statistic('militaryPersonnel','Military personnel',data?.militaryPersonnel == null ? null :
      data.militaryPersonnel===0 ? '0 thousand reported' : number(data.militaryPersonnel),year,
      'Regular military personnel on January 1. The source counts in thousands and excludes reserves.',cowLink));
    grid.append(statistic('gdp','Estimated GDP',data?.gdp == null ? null : 'Intl$'+number(data.gdp),year,
      'Measured in 2011 international dollars (PPP). These dollars compare what money could buy across countries and years.',
      maddisonLink));
  }

  function open(era,n,opener) {
    if (document.querySelector('dialog[data-country-profile][open]')) return;
    const dialog = element('dialog','country-guide');
    dialog.setAttribute('data-country-profile','');
    dialog.setAttribute('aria-labelledby','country-profile-name');
    const original = era.board.NATIONS[n.id];
    const isModern = era.id==='modern';
    const flag = flagFor(era,n);
    const header = element('header','guide-header');
    const identity = element('div','guide-identity');
    const eraLabel = element('p','guide-era',isModern?'Modern world':mapDate(era.date));
    const title = element('h2','',original.name);
    title.id='country-profile-name';
    if (flag) {
      const emblem=element('span','guide-flag');
      emblem.innerHTML=flagMarkup(era,n);
      if (flag.src) emblem.firstElementChild.alt=flag.caption;
      else {emblem.setAttribute('role','img');emblem.setAttribute('aria-label',flag.caption);}
      identity.append(emblem);
    }
    identity.append(eraLabel,title);
    if (n.name!==original.name) identity.append(element('p','guide-alias','Known as '+n.name+' in your campaign'));
    const close = element('button','guide-close','×');
    close.type = 'button';
    close.setAttribute('data-profile-close','');
    close.setAttribute('aria-label','Close country profile');
    header.append(identity,locator(era,n),close);
    const body = element('div','guide-body');
    body.append(element('p','guide-intro',introduction(era,n)));
    if (!isModern && flag?.source) {
      const flagNote = element('p','guide-flag-note',flag.caption+' ');
      flagNote.append(sourceLink('Flag history',flag.source));
      body.append(flagNote);
    }
    const grid = element('div','guide-stats');
    if (isModern) currentStats(n,grid); else periodStats(era,n,grid);
    body.append(grid);

    if (isModern) {
      const site = root.DungeonHeritageSites[n.iso2];
      if (site) {
        const place = element('section','guide-place');
        place.append(element('h3','','A place to explore'),sourceLink(site.name,'https://whc.unesco.org/en/list/'+site.id+'/'),
          element('p','',site.fact || 'UNESCO added this place to the World Heritage List in '+site.year+'.'));
        body.append(place);
      }
    } else {
      const data = historical(era,n);
      const notes = [...new Set([data?.scope,data?.gdpScope].filter(Boolean))];
      if (notes.length) body.append(element('p','guide-scope',notes.join(' ')));
    }
    const sources = element('footer','guide-sources');
    sources.append(element('span','','Explore the sources'));
    const links = element('div','guide-source-links');
    if (isModern) {
      const data=modern(n);
      if (data?.links.geography) links.append(sourceLink('UN country profile',data.links.geography));
      links.append(sourceLink('Natural Earth atlas',naturalEarth));
    } else {
      links.append(sourceLink('CShapes historical atlas',cShapes));
    }
    sources.append(links);
    body.append(sources);
    dialog.append(header,body);
    document.body.append(dialog);
    close.addEventListener('click',()=>dialog.close());
    dialog.addEventListener('close',()=>{
      dialog.remove();
      if (opener.isConnected) opener.focus({preventScroll:true});
    },{once:true});
    dialog.showModal();
    close.focus({preventScroll:true});
  }

  root.DungeonCountryGuide = {flagMarkup,preview,open};
})(globalThis);
