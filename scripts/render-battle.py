#!/usr/bin/env python3
"""Render Lanterns Across the Vale, the original country-battle underscore.

Python with NumPy, ffmpeg, GarageBand's recorded orchestral instruments and
the Prince Hall impulse response are needed only to render the stereo master.
"""
import json
import re
import struct
import subprocess
import tempfile
import wave
from functools import lru_cache
from pathlib import Path

import numpy as np

RATE = 32000
BANK = Path('/Library/Application Support/GarageBand/Instrument Library/Sampler/Sampler Files')
HALL = Path('/Library/Audio/Impulse Responses/Apple/01 Large Spaces/02 Halls/03.9s Prince Hall One-OST.SDIR')
OUTPUT = Path(__file__).resolve().parents[1] / 'web/assets/frontier-battle.m4a'
TARGET_LUFS = -23.7
rng = np.random.default_rng(84132)

# Two-bar phrases, in quarter notes. Every voice has its own entrances, breath
# marks (rests), and held notes; a vertical bar is simply a score-reading aid.
# The lower strings lead the third strain. The horn first takes the tune in the
# fourth, where the soprano strings gradually gather around its sustained notes.
sections = [
    dict(title='A far light', bpm=58, dynamic=.78, melody='clarinet', answer='flute',
         lead=['r:1 g3:1 c4:2.5 eb4:1.5 d4:1 c4:1',
               'bb3:2 g3:1 r:.5 eb4:1.5 f4:2 eb4:1',
               'd4:1 g4:3 f4:1.5 eb4:1 c4:1.5',
               'bb3:2 d4:1.5 c4:3 r:1.5'],
         counter=['r:8','r:4 bb4:2 g4:2','r:5 ab4:1.5 g4:1.5','f4:2 r:2 g4:3 r:1'],
         bass=['c3:5 g2:3','ab2:4 eb3:4','f2:4 ab2:2 bb2:2','g2:4 c3:4'],
         inner=['eb3:4 g3:4','c4:3.5 bb3:.5 g3:4','ab3:3 c4:1 eb4:4','d4:2 g3:2 eb3:4']),
    dict(title='Under the bridge', bpm=60, dynamic=.91, melody='flute', answer='clarinet',
         lead=['r:.75 bb4:1.25 g4:1.5 eb5:2.5 d5:1 c5:1',
               'bb4:2.5 ab4:.75 g4:.75 f4:3 r:1',
               'g4:1.5 c5:2.5 eb5:2 d5:1 bb4:1',
               'ab4:2 c5:1 bb4:3 g4:1 r:1'],
         counter=['g3:4 r:2 eb4:2','c4:3 r:2 f4:2 eb4:1','r:3 g3:2.5 ab3:2.5','f4:2.5 eb4:1.5 d4:3 r:1'],
         bass=['eb3:6.5 d3:1.5','c3:4 bb2:4','ab2:4 eb3:4','f2:4 bb2:4'],
         inner=['g3:4 bb3:4','ab3:2.5 g3:1.5 f3:4','eb3:4 g3:4','ab3:4 f3:4']),
    dict(title='The ford at dusk', bpm=55, dynamic=.77, melody='strings', answer='horn',
         lead=['r:1 c4:1 f4:2.5 eb4:1.5 ab3:2',
               'bb3:1.5 c4:2 db4:2.5 c4:1 r:1',
               'ab3:1.5 eb4:2.5 f4:1.5 eb4:1 db4:1.5',
               'c4:3 bb3:1 g3:2.5 r:1.5'],
         counter=['r:6 c3:2','f3:4 r:4','r:3.5 ab3:2.5 g3:2','f3:3 eb3:2 d3:2 r:1'],
         bass=['f2:5 c3:3','db3:4 ab2:4','bb2:3.5 ab2:.5 db3:4','ab2:4 g2:4'],
         inner=['ab3:4 c4:4','f3:3 ab3:1 eb3:4','db3:4 ab3:4','eb3:4 b3:4']),
    dict(title='Beyond the hill', bpm=60, dynamic=1.05, melody='horn', answer='flute',
         lead=['r:.5 eb4:1.5 ab4:3 g4:1.5 eb4:1.5',
               'c4:2 eb4:1 f4:2.5 g4:1.5 ab4:1',
               'bb4:3 g4:1 eb4:2 f4:2',
               'ab4:1.5 g4:1.5 f4:2 eb4:2 r:1'],
         counter=['r:5.5 c5:1.5 bb4:1','ab4:2 r:3 c5:1.5 eb5:1.5',
                  'd5:2.5 eb5:1.5 bb4:2 r:2','r:2 ab4:2.5 g4:2.5 r:1'],
         bass=['ab2:5 eb3:3','f2:4 ab2:4','eb3:4 c3:4','db3:4 eb3:4'],
         inner=['c4:4 eb4:4','ab3:4 c4:4','bb3:2.5 g3:1.5 g3:4','ab3:4 bb3:4']),
    dict(title='The answering shore', bpm=61, dynamic=1.03, melody='strings', answer='clarinet',
         lead=['g4:1.5 bb4:1 eb5:3 d5:1.5 c5:1',
               'bb4:3 ab4:1 g4:2 eb4:1 r:1',
               'f4:1.5 ab4:1 bb4:1.5 c5:2 eb5:1 d5:1',
               'c5:1.5 g4:2.5 f4:1 bb4:2 r:1'],
         counter=['r:3 eb4:2.5 d4:2.5','c4:2.5 eb4:1.5 r:2 bb3:2',
                  'ab3:3.5 c4:.5 eb4:3 r:1','r:2 d4:2 bb3:2.5 ab3:1.5'],
         bass=['eb3:5 bb2:3','c3:4 eb3:4','ab2:4 f2:4','c3:4 bb2:4'],
         inner=['g3:3 eb4:1 f4:4','eb4:4 bb3:4','c4:4 ab3:4','eb3:4 f3:4']),
    dict(title='Back to the lantern', bpm=56, dynamic=.77, melody='clarinet', answer='flute',
         lead=['g4:2 eb4:1 c4:2.5 bb3:1.5 g3:1',
               'ab3:2 c4:1.5 eb4:2 d4:1 bb3:1.5',
               'c4:1.5 f4:2.5 eb4:2 d4:1 c4:1',
               'b3:2 d4:1.5 c4:3.5 r:1'],
         counter=['r:5 g4:1.5 f4:1.5','eb4:3 r:5','r:5.5 g4:2.5','f4:1.5 eb4:1.5 d4:1 eb4:3 r:1'],
         bass=['c3:5 g2:3','ab2:4 eb3:4','f2:4 ab2:4','g2:4 c3:4'],
         inner=['eb3:4 g3:4','eb3:4 g3:4','ab3:4 c4:4','d4:3 b3:1 g3:4'])
]

# Manually spaced beat times follow both the broad tempo changes and the small
# relaxations a conductor gives at the ends of phrases.
beat_edges = [0.0]
for section in sections:
    for i in range(32):
        within = i % 8
        rubato = [1.025,1.000,.981,.974,.988,1.003,1.028,1.064][within]
        if i>=29: rubato *= [1.025,1.055,1.10][i-29]
        beat_edges.append(beat_edges[-1]+60/section['bpm']*rubato)
frames = round(beat_edges[-1]*RATE/1024)*1024
seconds = frames/RATE
beat_edges = np.asarray(beat_edges) * (seconds/beat_edges[-1])
mix = np.zeros((frames,2),np.float32)

def at(beat):
    return np.interp(beat,np.arange(len(beat_edges)),beat_edges)

def midi(label):
    n=re.fullmatch(r'([a-g])([b#]?)([0-8])',label)
    if not n: raise ValueError('Invalid pitch '+label)
    return (int(n[3])+1)*12 + {'c':0,'d':2,'e':4,'f':5,'g':7,'a':9,'b':11}[n[1]] + {'':0,'b':-1,'#':1}[n[2]]

def sample(path):
    with wave.open(str(path)) as source:
        assert source.getsampwidth()==2 and source.getnchannels()==2
        sr=source.getframerate()
        pcm=np.frombuffer(source.readframes(source.getnframes()),'<i2').reshape(-1,2).astype(np.float32)/32768
    raw=path.read_bytes()
    pos=12
    while pos+8<len(raw):
        size=struct.unpack_from('<I',raw,pos+4)[0]
        if raw[pos:pos+4]==b'smpl':
            info=struct.unpack_from('<9I',raw,pos+8)
            root=info[3]+info[4]/2**32
            loop=struct.unpack_from('<6I',raw,pos+44)[2:4] if info[7] else None
            energy=float(np.sqrt(np.mean(pcm[:min(len(pcm),2*sr)]**2)))
            # A softer wind embouchure carries less edge. Work on the original
            # performance while retaining its breath, vibrato and attack.
            freq=np.fft.rfftfreq(len(pcm),1/sr)
            color=0.64+0.36/(1+(freq/3200)**3)
            pcm=np.fft.irfft(np.fft.rfft(pcm,axis=0)*color[:,None],n=len(pcm),axis=0).astype(np.float32)
            return root,sr,pcm,loop,energy
        pos+=8+size+size%2
    raise ValueError('Missing tuning data: '+str(path))

@lru_cache(maxsize=None)
def bank(name):
    patterns={'strings':'String Ensemble/*[nm]*.wav','clarinet':'Clarinet Solo/*sus_mf/*.wav',
              'flute':'Flute Solo/*sus_mf/*.wav','horn':'Horn Solo/*_sus_mf/*.wav'}
    paths=sorted(BANK.glob(patterns[name]))
    if not paths: raise FileNotFoundError(f'{name}: install the GarageBand orchestral instruments to render')
    return [sample(path) for path in paths]

def add(start,signal):
    index=round(start*RATE)%frames
    n=min(len(signal),frames-index)
    mix[index:index+n]+=signal[:n]
    if n<len(signal): mix[:len(signal)-n]+=signal[n:]

def notes(lines):
    events=[]
    for i,line in enumerate(lines):
        start=i*8
        for symbol in line.split():
            label,length=symbol.split(':')
            length=float(length)
            if label!='r':
                events.append([start,length,midi(label)])
            start+=length
        if start!=(i+1)*8: raise ValueError('Phrase should contain eight beats: '+line)
    return events

def tie(events):
    merged=[]
    for start,length,pitch in events:
        if merged and pitch==merged[-1][2] and merged[-1][0]+merged[-1][1]==start:
            merged[-1][1]+=length
        else: merged.append([start,length,pitch])
    return merged

def play(instrument,pitch,when,length,level,pan,slurred,lift,shape):
    root,sr,pcm,loop,rms=min(bank(instrument),key=lambda row:abs(row[0]-pitch))
    string=instrument=='strings'
    attack=(.19 if string else .105) if not slurred else (.115 if string else .066)
    release=(.46 if string else .23) if lift else (.20 if string else .115)
    # Overlap between connected notes, and a little air ahead of genuine rests.
    t=np.arange(round((length+release)*RATE))/RATE
    onset_offset=rng.uniform(.033,.067) if slurred and not string else .004
    tuning=rng.uniform(-1.3,1.3)
    cursor=(t+onset_offset)*sr*2**((pitch-root+tuning/100)/12)
    if loop:
        begin,end=loop
        cursor=np.where(cursor>=end,begin+(cursor-begin)%max(1,end-begin),cursor)
    cursor=np.clip(cursor,0,len(pcm)-2)
    idx=cursor.astype(int)
    frac=(cursor-idx).astype(np.float32)[:,None]
    signal=pcm[idx]*(1-frac)+pcm[idx+1]*frac
    # Place the recorded stereo sources in a chamber-sized ensemble.
    center=signal.mean(axis=1)
    width=.76 if string else .47
    signal=width*signal+(1-width)*center[:,None]
    travel=np.clip(t/length,0,1)
    bow=.83+(.13+.10*shape)*np.sin(np.pi*travel)**1.45+.075*shape*travel
    envelope=np.sin(np.minimum(1,t/attack)*np.pi/2)**1.35
    envelope*=np.cos(np.clip((t-length)/release,0,1)*np.pi/2)**1.8
    stereo=np.sqrt([1-pan,1+pan])
    add(when,signal*(level*bow*envelope/(.06+rms))[:,None]*stereo)

def part(events,section_number,name,level,pan,connected):
    section=sections[section_number]
    for i,(local,length,pitch) in enumerate(events):
        start=32*section_number+local
        end=start+length
        before=i>0 and events[i-1][0]+events[i-1][1]==local
        after=i+1<len(events) and events[i+1][0]==local+length
        # Local ensemble delays and swells vary by desk and by phrase. Shared
        # notes are tied through harmony changes instead of restarting every bar.
        delay=rng.uniform(-.012,.024) if before else rng.uniform(.012,.075)
        length_s=at(end)-at(start)
        body=length_s-(.018 if after else min(.15,.08*length_s))
        position=local/32
        arc=.83+.23*np.sin(np.pi*position)
        play(name,pitch,at(start)+delay,max(.2,body),level*section['dynamic']*arc*rng.uniform(.95,1.04),
             pan,connected and before,not after,rng.uniform(-.45,.70))

def perform():
    for i,section in enumerate(sections):
        name=section['melody']
        part(notes(section['lead']),i,name,.151 if name!='strings' else .178,
             {'clarinet':.13,'flute':-.22,'horn':.21,'strings':-.19}[name],True)
        part(notes(section['counter']),i,section['answer'],.082,
             -.20 if section['answer']=='flute' else .18,True)
        part(tie(notes(section['bass'])),i,'strings',.108,.11,True)
        part(tie(notes(section['inner'])),i,'strings',.078,-.25,True)
    # A high, quiet string desk joins only at the peak of the long central arc.
    part([[5,7,midi('eb5')],[16.75,4.5,midi('g4')],[22,4.5,midi('ab4')],[27,4,midi('g4')]],
         3,'strings',.040,-.05,True)
    part([[.75,5.25,midi('bb3')],[7,3,midi('g4')],[13.5,4,midi('eb4')],[20,6,midi('c4')]],
         4,'horn',.049,.24,True)

def render_hall():
    raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(HALL),'-ar',str(RATE),'-ac','2','-f','f32le','-'])
    impulse=np.frombuffer(raw,'<f4').reshape(-1,2)
    block=32768
    nfft=1<<(block+len(impulse)-2).bit_length()
    for c in range(2):
        dry=mix[:,c].copy()
        kernel=impulse[:,c].astype(np.float64)
        kernel/=np.linalg.norm(kernel)
        response=np.fft.rfft(kernel,nfft)
        wet=np.zeros(frames+len(kernel),np.float32)
        for start in range(0,frames,block):
            piece=dry[start:start+block]
            tail=np.fft.irfft(np.fft.rfft(piece,nfft)*response,nfft)[:len(piece)+len(kernel)-1]
            wet[start:start+len(tail)]+=tail.astype(np.float32)
        # Ring the end of the recorded hall into the beginning of the repeat.
        wet[:len(kernel)]+=wet[frames:frames+len(kernel)]
        wet=wet[:frames]
        scale=.41*np.sqrt(np.mean(dry**2)/np.mean(wet**2))
        mix[:,c]+=wet*scale

def master():
    mix[:]-=mix.mean(axis=0)
    # Leave generous margin through the conversion to the intermediate PCM.
    mix[:]*=.72/np.max(np.abs(mix))
    n=round(.011*RATE)
    silence=round(.002*RATE)
    edge=np.r_[np.zeros(silence),np.sin(np.linspace(0,np.pi/2,n-silence))**2][:,None]
    mix[:n]*=edge
    mix[-n:]*=edge[::-1]
    with tempfile.TemporaryDirectory() as tmp:
        audio=Path(tmp)/'lanterns.wav'
        with wave.open(str(audio),'wb') as out:
            out.setnchannels(2);out.setsampwidth(2);out.setframerate(RATE)
            out.writeframes((mix*32767).astype('<i2').tobytes())
        analysis=subprocess.run(['ffmpeg','-hide_banner','-nostats','-i',str(audio),'-af',
                                 f'loudnorm=I={TARGET_LUFS}:TP=-4:LRA=12:print_format=json','-f','null','-'],
                                capture_output=True,text=True,check=True).stderr
        report=json.loads(analysis[analysis.rindex('{'):analysis.rindex('}')+1])
        gain=TARGET_LUFS-float(report['input_i'])
        # Fixed gain preserves the written dynamics, including the quiet opening.
        subprocess.run(['ffmpeg','-v','error','-y','-i',str(audio),'-af',f'volume={gain:.3f}dB',
                        '-c:a','aac','-b:a','104k','-movflags','+faststart','-metadata',
                        'title=Lanterns Across the Vale','-metadata','album=Decimal Dungeon',str(OUTPUT)],check=True)
    print(f'{len(sections)*8} bars, {seconds:.3f}s, {OUTPUT.stat().st_size:,} bytes')

if __name__=='__main__':
    perform()
    render_hall()
    master()
