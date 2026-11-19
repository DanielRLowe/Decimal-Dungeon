#!/usr/bin/env python3
"""Render the original 64-bar Atlas at Dawn score into the game's offline AAC.
Build-time instruments: macOS GarageBand's recorded sampler instruments and
Logic's Big Chamber impulse response. The player needs only the finished mix.
Uses Python + NumPy and ffmpeg. Run from any directory.
"""
import math
import re
import struct
import subprocess
import tempfile
import wave
from pathlib import Path
import numpy as np

RATE = 32000
ROOT = Path(__file__).resolve().parents[1]
BANK = Path('/Library/Application Support/GarageBand/Instrument Library/Sampler/Sampler Files')
ROOM = Path('/Library/Audio/Impulse Responses/Apple/01 Large Spaces/01 Rooms/2.7s_Big Chamber.SDIR')
OUTPUT = ROOT / 'web/assets/empire-overture.m4a'
rng = np.random.default_rng(47631)

# Each bar has a harmony and four beats of written melodic material. Motifs
# return in different registers and orchestrations after the two central episodes.
sections = [
    ('Over the ridge',79,'flute',[
        ('D','r:1 d5:1 a4:.5 b4:.5 fs5:1'),('G','e5:1.5 d5:.5 b4:2'),('Bm','a4:.5 b4:.5 d5:1 fs5:1 e5:1'),('A','cs5:2 b4:1 a4:1'),
        ('D/Fs','fs5:1 e5:.5 d5:.5 a4:2'),('G','b4:1.5 d5:.5 e5:1 g5:1'),('Em','fs5:.5 e5:.5 b4:1 g4:1 b4:1'),('Asus','d5:2 cs5:1 r:1')]),
    ('The first banner',80,'horn',[
        ('D','d4:1.5 fs4:.5 a4:2'),('G','b4:1 a4:.5 g4:.5 d4:2'),('Bm','fs4:1 a4:.5 b4:.5 d5:1 a4:1'),('A','e4:1.5 fs4:.5 e4:1 cs4:1'),
        ('D/Fs','a4:2 fs4:1 d4:1'),('Em','g4:1 e4:.5 fs4:.5 b4:2'),('G','a4:.5 g4:.5 d4:1 e4:1 b3:1'),('A','cs4:2 e4:1 r:1')]),
    ('River road',83,'clarinet',[
        ('Bm','fs4:.5 b4:1 d5:.5 cs5:1 b4:1'),('D/A','a4:1 d5:.5 e5:.5 fs5:1 d5:1'),('G','g4:1.5 a4:.5 b4:.5 d5:.5 e5:1'),('Em','b4:2 g4:.5 a4:.5 b4:1'),
        ('Bm/Fs','d5:1 fs5:.5 e5:.5 cs5:1 d5:1'),('G','b4:1.5 a4:.5 g4:1 d4:1'),('Em','e4:.5 g4:.5 b4:1 a4:1 fs4:1'),('A','e4:2 cs4:1 r:1')]),
    ('Sunlit towers',82,'strings',[
        ('G','d5:1.5 g5:.5 fs5:1 e5:1'),('D/Fs','a5:2 fs5:1 d5:1'),('Em','g5:1 e5:.5 b4:.5 fs5:1 e5:1'),('Bm','d5:2 cs5:.5 b4:.5 a4:1'),
        ('G','b4:1 d5:1 g5:1.5 fs5:.5'),('D','e5:.5 fs5:.5 a5:2 d5:1'),('C','g5:1 e5:1 c5:1 g4:1'),('Asus','d5:2 e5:1 cs5:1')]),
    ('The quiet pass',77,'clarinet',[
        ('Em','r:.5 b4:1.5 g4:1 e4:1'),('D/Fs','a4:2 fs4:1 a4:1'),('G','d5:1 b4:.5 a4:.5 g4:2'),('A','e4:1 cs4:1 a3:2'),
        ('Bm','fs4:1.5 a4:.5 b4:1 d5:1'),('G','b4:2 a4:1 g4:1'),('Em','g4:.5 fs4:.5 e4:2 b3:1'),('A','cs4:1 e4:1 a4:1 r:1')]),
    ('The open valley',84,'horn',[
        ('D','d4:1 a4:1 fs4:1.5 e4:.5'),('G','g4:1.5 b4:.5 a4:1 g4:1'),('Bm','fs4:1 b4:.5 cs5:.5 d5:1 fs4:1'),('A','e4:1.5 cs4:.5 e4:1 a4:1'),
        ('D/Fs','a4:2 d5:1 fs4:1'),('G','b4:1 a4:.5 g4:.5 d4:1 g4:1'),('Em','e4:.5 g4:.5 b4:1 e5:1 b4:1'),('A','a4:2 e4:1 r:1')]),
    ('Returning light',81,'flute',[
        ('D','a4:.5 d5:1 fs5:.5 a5:1 fs5:1'),('G','g5:1.5 e5:.5 d5:1 b4:1'),('Bm','d5:1 fs5:.5 a5:.5 b5:1 a5:1'),('A','e5:2 cs5:.5 e5:.5 fs5:1'),
        ('D/Fs','a5:1.5 fs5:.5 d5:1 a4:1'),('Em','b4:1 e5:.5 fs5:.5 g5:1 e5:1'),('G','d5:1 b4:.5 d5:.5 e5:1 g5:1'),('A','fs5:.5 e5:.5 cs5:2 r:1')]),
    ('Lanterns at home',78,'horn',[
        ('Bm','d4:1 fs4:1 b4:1 a4:1'),('G','g4:2 d4:1 e4:1'),('D/Fs','fs4:1.5 a4:.5 d5:1 a4:1'),('A','e4:2 cs4:1 b3:1'),
        ('Em','g4:1.5 e4:.5 b3:2'),('G','d4:1 g4:1 b4:1 a4:1'),('Asus','e4:1 d4:1 cs4:2'),('D','d4:2 a3:1 r:1')]),
]
# Root bass followed by the chamber string voicing, low to high.
chords = {'D':(38,50,57,62,66),'D/Fs':(42,50,57,62,66),'D/A':(45,50,57,62,66),
          'G':(43,50,55,59,66),'Bm':(35,47,54,62,66),'Bm/Fs':(42,47,54,62,66),
          'A':(45,52,57,61,64),'Asus':(45,52,57,62,64),'Em':(40,47,55,59,64),'C':(36,48,55,60,64)}
def pitch(name):
    match = re.fullmatch(r'([a-g])(s?)(\d)',name)
    return 12*(int(match[3])+1)+{'c':0,'d':2,'e':4,'f':5,'g':7,'a':9,'b':11}[match[1]]+bool(match[2])

def sample_info(path):
    with wave.open(str(path)) as w:
        assert w.getsampwidth()==2 and w.getnchannels()==2
        pcm=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').reshape(-1,2).astype(np.float32)/32768
        sample_rate=w.getframerate()
    data=path.read_bytes()
    pos=12
    while pos+8<len(data):
        length=struct.unpack_from('<I',data,pos+4)[0]
        if data[pos:pos+4]==b'smpl':
            fields=struct.unpack_from('<9I',data,pos+8)
            base=fields[3]+fields[4]/2**32
            loop=struct.unpack_from('<6I',data,pos+44)[2:4] if fields[7] else (0,len(pcm)-1)
            return base,sample_rate,pcm,loop
        pos+=8+length+length%2
    raise ValueError('Missing instrument tuning: '+str(path))

def library(glob,folder):
    files=sorted((BANK/folder).glob(glob))
    if not files: raise FileNotFoundError(str(BANK/folder/glob))
    return [sample_info(p) for p in files]

instruments = {
    'strings':library('*[nm]*.wav','String Ensemble'),
    'horn':library('*_sus_mf/*.wav','Horn Solo'),
    'flute':library('*sus_mf/*.wav','Flute Solo'),
    'clarinet':library('*sus_mf/*.wav','Clarinet Solo')}
settings = {'strings':(-0.21,.20,.38),'horn':(.24,.12,.23),'flute':(-.30,.048,.19),'clarinet':(.12,.06,.16)}
duration=sum(8*4*60/bpm for _,bpm,_,_ in sections)
mix=np.zeros((round(duration*RATE),2),np.float32)

def add(start,signal):
    start=round(start*RATE)%len(mix)
    first=min(len(signal),len(mix)-start)
    mix[start:start+first]+=signal[:first]
    if first<len(signal): mix[:len(signal)-first]+=signal[first:]

def note(inst,midi,start,held,volume):
    pan,attack,release=settings[inst]
    root,sr,pcm,loop=min(instruments[inst],key=lambda sample:abs(sample[0]-midi))
    n=int((held+release)*RATE)
    t=np.arange(n,dtype=np.float64)/RATE
    pos=t*sr*2**((midi-root)/12)
    lo,hi=loop
    after=pos>=hi
    if np.any(after): pos[after]=lo+(pos[after]-lo)%max(1,hi-lo)
    ix=np.minimum(pos.astype(int),len(pcm)-2)
    delta=(pos-ix).astype(np.float32)[:,None]
    wavelet=pcm[ix]*(1-delta)+pcm[ix+1]*delta
    env=np.minimum(1,t/attack)**1.35*np.minimum(1,np.maximum(0,(held+release-t)/release))**1.65
    env*=.82+.18*np.sin(np.pi*np.minimum(t/held,1))
    rms=float(np.sqrt(np.mean(np.square(pcm[:min(len(pcm),sr*2)]))))
    stereo=np.array([math.sqrt(1-pan),math.sqrt(1+pan)])
    add(start,wavelet*(env*volume/(.055+rms))[:,None]*stereo)

def pluck(midi,start,volume):
    frequency=440*2**((midi-69)/12); t=np.arange(int(2.25*RATE))/RATE
    sound=np.zeros_like(t)
    for h in range(1,10):
        vol=math.sin(h*math.pi*.22)/(h**1.45)
        sound+=vol*np.exp(-(2.1+h*.86)*t)*np.sin(2*np.pi*frequency*h*(1+h*h*.000010)*t)
    sound*=np.minimum(1,t/.006)*np.clip((2.25-t)/.07,0,1)
    add(start,sound[:,None]*volume*np.array([.94,1.10]))

def drum(midi,start,volume):
    t=np.arange(int(1.5*RATE))/RATE; f=440*2**((midi-69)/12)
    sound=sum(weight*np.sin(2*np.pi*f*ratio*t)*np.exp(-decay*t)
        for ratio,weight,decay in [(1,.65,3.5),(1.51,.31,5.2),(1.99,.18,6.1),(2.46,.075,8.1)])
    sound*=np.minimum(1,t/.030)*np.clip((1.5-t)/.08,0,1)
    add(start,sound[:,None]*volume*np.array([.9,1.05]))

time=0.0
for section,(_,tempo,lead,bars) in enumerate(sections):
    beat=60/tempo
    for i,(harmony,melody) in enumerate(bars):
        bass,*voices=chords[harmony]
        dynamics=[.77,.84,.80,.94,.68,1.00,.91,.74][section]*(.92+.08*math.sin(math.pi*i/7))
        if section==7 and i>=4: dynamics*=1-.035*(i-3)
        beat_time=lambda b:time+b*beat
        for j,v in enumerate(voices):
            # Long bowed movement in upper voices, with inner off-beat articulations
            # during the travelling and reprise variations.
            if section in (2,5,6) and j==1:
                for at in (.55,2.55):note('strings',v,beat_time(at),beat*.86,.059*dynamics)
            else:
                note('strings',v,beat_time(.014*j),3.78*beat,.062*dynamics*(1.13 if j==0 else 1))
        note('strings',bass,beat_time(0),beat*(3.60 if section in (0,4,7) else 2.45),.096*dynamics)
        if section in (1,3,5,6):note('strings',bass+12,beat_time(2.95),beat*.89,.062*dynamics)
        patterns=[(0,1.5,3),(.5,1.5,2,3.5),(0,.75,1.5,2,2.75,3.5),(.5,1.5,2.5,3.5),
                  (0,2.5),(.5,1,1.5,2.5,3,3.5),(0,.75,1.5,2,2.75,3.5),(0,1.5,3)]
        for j,at in enumerate(patterns[section]):
            v=voices[[0,1,2,3,2,1][j%6]]
            pluck(v+(12 if section in (2,6) and j%2 else 0),beat_time(at)+rng.uniform(.001,.013),.084*dynamics)
        pos=0
        for token in melody.split():
            name,beats=token.split(':'); beats=float(beats)
            if name!='r':
                onset=beat_time(pos)+rng.uniform(.004,.019)
                level=(.179 if lead=='strings' else .173)*dynamics*rng.uniform(.94,1.05)
                note(lead,pitch(name),onset,beat*beats*(.91 if beats<=.5 else .96),level)
            pos+=beats
        assert abs(pos-4)<.001,(section,i,pos)
        # Conversational countermelodies enter and leave with the phrase.
        other='flute' if lead in ('horn','strings') else 'clarinet'
        if section in (1,3,5,6) and i in (1,3,5,7):
            for at,v,length in ((.65,voices[2]+12,1.15),(2.15,voices[3]+12,1.35)):
                note(other,v,beat_time(at),length*beat,.065*dynamics)
        if section in (3,5) and i in (0,4): drum(bass,beat_time(0),.086)
        if section in (2,5) and i==7:
            for at,level in [(2.75,.027),(3.18,.034),(3.62,.043)]: drum(bass,beat_time(at),level)
        time+=4*beat

# Circular overlap-add makes the last chord's room reflections and note releases
# part of the opening. No artificial silence or fade-out is inserted at the join.
ir=np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',str(ROOM),'-ac','2','-ar',str(RATE),
                                           '-f','f32le','-']),dtype='<f4').reshape(-1,2)
block=32768
fft_size=1<<(block+len(ir)-2).bit_length()
for channel in range(2):
    kernel=ir[:,channel].astype(np.float64)
    kernel/=math.sqrt(float(np.sum(kernel*kernel)))
    response=np.fft.rfft(kernel,fft_size)
    wet=np.zeros(len(mix)+len(ir)+block,np.float32)
    for start in range(0,len(mix),block):
        chunk=mix[start:start+block,channel]
        convolved=np.fft.irfft(np.fft.rfft(chunk,fft_size)*response,fft_size)[:len(chunk)+len(ir)-1]
        wet[start:start+len(convolved)]+=convolved.astype(np.float32)
    wet[:len(ir)]+=wet[len(mix):len(mix)+len(ir)]
    room=wet[:len(mix)]
    mix[:,channel]+=.22*room*np.sqrt(np.mean(mix[:,channel]**2)/np.mean(room**2))

mix-=mix.mean(axis=0)
mix*=.71/np.max(np.abs(mix))
with tempfile.TemporaryDirectory() as tmp:
    wav=Path(tmp)/'overture.wav'
    with wave.open(str(wav),'wb') as out:
        out.setnchannels(2);out.setsampwidth(2);out.setframerate(RATE)
        out.writeframes((mix*32767).astype('<i2').tobytes())
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-c:a','aac','-b:a','104k','-movflags','+faststart',
                    '-metadata','title=Atlas at Dawn','-metadata','album=Decimal Dungeon',str(OUTPUT)],check=True)
print(f'{duration:.2f} seconds, 64 bars, {OUTPUT.stat().st_size:,} bytes')
