/* Each campaign resolves ids within its own dated atlas. Save keys remain stable. */
(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const modern=node?require('./campaign-data.js'):root.DungeonCampaign;
  const cities=node?require('./capitals.js'):root.DungeonCapitals;
  const eras=new Map();
  eras.set('modern',{id:'modern',title:'Modern world',date:'Modern',board:modern,capitals:cities,
    description:'Play on the modern map of 195 countries. Each era saves its own empire.'});
  const titles={'1886':'The world in 1886',ww1:'World War I · 1914',ww2:'World War II · 1939'};
  function historical(){
    const data=node?require('./historical-atlas.js'):root.DungeonHistoricalAtlases;
    for(const [id,title] of Object.entries(titles)){
      if(!data?.[id]||eras.has(id)) continue;
      const source=data[id], nations=source.NATIONS||source.nations;
      const board={...source,WIDTH:1000,HEIGHT:540,NATIONS:nations,CAPITAL_ID:source.CAPITAL_ID??0};
      const capitals={lakePath:cities.lakePath,containsPoint:cities.onAtlas(board),get(i){
        const n=nations[i];return !n?null:{name:n.capital,x:n.capitalX,y:n.capitalY,note:n.capitalNote||''};
      }};
      eras.set(id,{id,title,board,capitals,date:source.date,description:(source.dateLabel||source.date)+' · '+source.description,notes:Array.isArray(source.notes)?source.notes.join(' '):source.notes});
    }
  }
  function get(id){if(!eras.has(id)&&Object.hasOwn(titles,id))historical();return eras.get(id);}
  const api={get,get list(){historical();return ['modern','ww2','ww1','1886'].map(id=>eras.get(id)).filter(Boolean);}};
  root.DungeonEras=api;
  if(node)module.exports=api;
})(globalThis);
