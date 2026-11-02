"""Deterministic offline PBR atlas, AO, sun shadows, coastline and sky bake.
Requires Pillow + NumPy only; generated assets are committed, never built in a
browser or on a server request. No downloaded texture or runtime dependency.
"""
from pathlib import Path
import json, os, time
import numpy as np
from PIL import Image, ImageFilter, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/world-map/environment'
OUT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(62817)

def noise(size, cells):
    field = rng.random((cells, cells), dtype=np.float32)
    # Wrap the sample lattice, so tiles and their derivatives are seamless.
    field = np.pad(field, ((0,1),(0,1)), mode='wrap')
    t = np.arange(size, dtype=np.float32) / size * cells
    a = np.floor(t).astype(int); f = t-a; f = f*f*(3-2*f)
    return ((field[a[:,None],a[None,:]]*(1-f[None,:])+field[a[:,None],a[None,:]+1]*f[None,:])*(1-f[:,None])
        +(field[a[:,None]+1,a[None,:]]*(1-f[None,:])+field[a[:,None]+1,a[None,:]+1]*f[None,:])*f[:,None])

def fbm(size):
    return sum(noise(size,c)*a for c,a in [(4,.34),(9,.23),(21,.17),(47,.12),(99,.08),(203,.06)])

def atomic_image(image,name,**options):
    destination=OUT/name;temporary=OUT/(name+'.pending')
    image.save(temporary,format='PNG' if name.endswith('.png') else 'WEBP',**options)
    for attempt in range(5):
        try:os.replace(temporary,destination);return
        except OSError:
            if attempt==4:raise
            time.sleep(.15)

def save(name, array, lossless=False):
    image=Image.fromarray(np.uint8(np.clip(array,0,1)*255))
    if name.endswith('.png'):atomic_image(image,name,optimize=True)
    else:atomic_image(image,name,lossless=lossless,quality=88,method=6,exact=True)

N=512
yy,xx=np.mgrid[0:N,0:N]/N
albedos=[];normals=[];packed=[]
for material in range(4):
    broad=fbm(N);fine=noise(N,173);micro=noise(N,251)
    if material==0:  # grass, lichen, scattered organic soil
        blades=(noise(N,173)-.5)*.8+(noise(N,251)-.5)*.35
        height=broad*.48+fine*.25+blades*.055
        patches=np.clip((noise(N,11)-.53)*3,0,1)
        base=np.array([.43,.53,.29])+ (broad[...,None]-.5)*np.array([.24,.24,.13])
        base=base*(1-patches[...,None]*.6)+np.array([.39,.35,.235])*patches[...,None]*.6
        rough=.91-fine*.09
    elif material==1:  # eroded bedded limestone, veins, fractures
        # Irregular limestone/moss: no repeated horizontal comb or grid joints.
        bedding=noise(N,11)*.6+noise(N,27)*.4
        cracks=np.clip((.23-noise(N,29))*3.2,0,.35)
        height=broad*.39+fine*.16+bedding*.09-cracks*.15
        base=np.array([.65,.635,.57])+(broad[...,None]-.5)*.23-cracks[...,None]*.075
        base+=np.clip((micro-.75)*.3,0,.06)[...,None]
        rough=.8+fine*.16
    elif material==2:  # mixed sand, shell grit and coarse beach pebbles
        pebbles=np.clip((noise(N,101)-.68)*6,0,1)
        height=broad*.16+micro*.17+pebbles*.28
        base=np.array([.76,.70,.56])+(broad[...,None]-.5)*.18+(fine[...,None]-.5)*.12-pebbles[...,None]*.16
        rough=.88+micro*.09
    else:  # moist soil, scree and broken moss
        moss=np.clip((noise(N,13)-.5)*3,0,1)
        stones=np.clip((fine-.65)*3,0,1)
        height=broad*.36+fine*.2+stones*.2
        base=np.array([.42,.365,.255])+(broad[...,None]-.5)*.21+stones[...,None]*.1
        base=base*(1-moss[...,None]*.4)+np.array([.35,.45,.245])*moss[...,None]*.4
        rough=.88-fine*.13
    dx=(np.roll(height,-1,1)-np.roll(height,1,1))*2.4
    dy=(np.roll(height,-1,0)-np.roll(height,1,0))*2.4
    normal=np.stack([-dx,-dy,np.ones_like(dx)],-1);normal/=np.linalg.norm(normal,axis=-1)[...,None]
    ao=np.clip(.78+height*.42-fine*.1,.62,1)
    albedos.append(np.clip(base,0,1));normals.append(normal*.5+.5);packed.append(np.stack([rough,ao,height],-1))

def atlas(tiles):
    # TextureLoader flips Y: grass/limestone are the top row in the source file.
    return np.concatenate([np.concatenate(tiles[:2],1),np.concatenate(tiles[2:],1)],0)

save('terrain-albedo.webp',atlas(albedos))
save('terrain-normal.webp',atlas(normals),True)
save('terrain-rma.webp',atlas(packed),True)

cache=ROOT/'.cache/environment-bake'
scene=json.loads((cache/'scene.json').read_text())
S=scene['size'];b=scene['bounds'];sun=np.array(scene['sun'],dtype=float)
grid=np.fromfile(cache/'height-coast.f32',dtype=np.float32).reshape(S,S,2)
height,coast=grid[:,:,0],grid[:,:,1]
dx=(b['maxX']-b['minX'])/(S-1);dz=(b['maxZ']-b['minZ'])/(S-1)

def shift(field, x, z):
    iz=np.clip(np.arange(S)+round(z/dz),0,S-1);ix=np.clip(np.arange(S)+round(x/dx),0,S-1)
    return field[iz[:,None],ix[None,:]]

ao=np.ones((S,S),dtype=np.float32);visibility=np.ones_like(ao)
for radius in [.7,1.8,4,8]:
    obstruction=np.zeros_like(ao)
    for angle in np.arange(8)*np.pi/4:
        obstruction+=np.clip((shift(height,np.cos(angle)*radius,np.sin(angle)*radius)-height)/radius,0,1.5)
    ao-=obstruction*(.045 if radius<3 else .025)
horizontal=np.linalg.norm(sun[[0,2]]);direction=sun[[0,2]]/horizontal
for distance in [.5,1,2,3.5,5.5,8,12,18,25]:
    blocker=shift(height,direction[0]*distance,direction[1]*distance)-height-distance*sun[1]/horizontal
    visibility=np.minimum(visibility,np.clip(1-blocker*1.4,0,1))

# Contact occlusion and cast shadows from static foliage, rocks and landmarks.
objects=np.ones_like(ao)
for obj in scene['shadows']:
    # Soft directional capsule, from the actual foot toward the sun-opposite tip.
    h=max(0,obj['top']-obj['ground']);ox=-sun[0]/sun[1]*h;oz=-sun[2]/sun[1]*h
    softness=.13+h*.025;rx=obj['rx']+softness;rz=obj['rz']+softness
    ix=int((obj['x']-b['minX'])/dx);iz=int((obj['z']-b['minZ'])/dz)
    px=max(1,int((rx+abs(ox))/dx*1.8));pz=max(1,int((rz+abs(oz))/dz*1.8))
    x0,x1=max(0,ix-px),min(S,ix+px+1);z0,z1=max(0,iz-pz),min(S,iz+pz+1)
    if x1<=x0 or z1<=z0:continue
    zz,xx=np.mgrid[z0:z1,x0:x1];wx=b['minX']+xx*dx;wz=b['minZ']+zz*dz
    t=np.clip(((wx-obj['x'])*ox+(wz-obj['z'])*oz)/(ox*ox+oz*oz+.001),0,1)
    falloff=np.exp(-(((wx-obj['x']-ox*t)/rx)**2+((wz-obj['z']-oz*t)/rz)**2)*2.2)
    falloff*=np.clip((obj['top']-height[z0:z1,x0:x1])/.35,0,1)
    density=.24 if obj['leaves'] else .55
    objects[z0:z1,x0:x1]=np.minimum(objects[z0:z1,x0:x1],1-falloff*density)
objects=np.array(Image.fromarray(np.uint8(np.clip(objects,0,1)*255)).filter(ImageFilter.GaussianBlur(.85)))/255
ao=np.clip(ao,.55,1)*(.9+.1*objects)
visibility=np.clip(visibility,.22,1)*np.clip(objects,.36,1)
moisture=np.clip(np.exp(-np.maximum(coast,0)/3)*.6+np.maximum(0,1-height/12)*.25,0,1)
save('lighting-mask.webp',np.flipud(np.stack([ao,visibility,moisture],-1)),True)

# Signed shore distance, actual seabed depth, open-water exposure, cliff mask.
exposure=np.zeros_like(ao)
for angle in np.arange(8)*np.pi/4:exposure+=(shift(coast,np.cos(angle)*6,np.sin(angle)*6)<0)/8
gy,gx=np.gradient(height,dz,dx)
depth=np.maximum(0,-height-.2)+np.maximum(0,-coast)*.48
water=np.stack([np.clip(.5+coast/32,0,1),np.clip(depth/20,0,1),exposure,.5+.5*np.clip(np.hypot(gx,gy)/3,0,1)],-1)
# Keep alpha >= .5: browser image decoders may erase RGB beneath alpha zero.
save('coast-depth.png',np.flipud(water),True)

# Equirectangular daylight sky. Cloud volume and light are baked into this map.
skyN=512;cloud=fbm(skyN);cy,cx=np.mgrid[0:skyN,0:skyN]/skyN
sky=np.zeros((skyN,skyN,3),dtype=np.float32)
sky[:]=np.array([.44,.66,.84])
horizon=np.exp(-((cy-.5)/.16)**2)
sky=sky*(1-horizon[...,None]*.6)+np.array([.83,.87,.91])*horizon[...,None]*.6
billow=np.clip((cloud-.49)*4.5,0,1)*np.clip(1-np.abs(cy-.29)*3.2,0,1)
shaded=np.stack([.79+cloud*.18,.81+cloud*.17,.80+cloud*.18],-1)
sky=sky*(1-billow[...,None]*.9)+shaded*billow[...,None]*.9
save('afternoon-sky.webp',sky)

waterN=256;wy,wx=np.mgrid[0:waterN,0:waterN]/waterN
# Seamless isotropic domain-warped ripples; no directional sine gratings.
def sample_tile(field,u,v):
    n=field.shape[0];u=np.mod(u,1)*n;v=np.mod(v,1)*n
    ix=np.floor(u).astype(int);iy=np.floor(v).astype(int);fx=u-ix;fy=v-iy
    return (field[iy%n,ix%n]*(1-fx)+field[iy%n,(ix+1)%n]*fx)*(1-fy)+(field[(iy+1)%n,ix%n]*(1-fx)+field[(iy+1)%n,(ix+1)%n]*fx)*fy
warp_x=noise(waterN,5)-.5;warp_y=noise(waterN,7)-.5
surface=sample_tile(fbm(waterN),wx+warp_x*.18,wy+warp_y*.18)*.34+noise(waterN,61)*.045

nx=(np.roll(surface,-1,1)-np.roll(surface,1,1))*6
ny=(np.roll(surface,-1,0)-np.roll(surface,1,0))*6
wn=np.stack([-nx,-ny,np.ones_like(nx)],-1);wn/=np.linalg.norm(wn,axis=-1)[...,None]
save('water-normal.webp',wn*.5+.5,True)

# Soft cloud cards are a few transparent quads, shaded entirely offline.
cloudN=512;cy,cx=np.mgrid[0:cloudN,0:cloudN]/cloudN
billows=fbm(cloudN)
envelope=np.exp(-(((cx-.5)/.37)**4+((cy-.51)/.22)**2)*2)
alpha=np.clip((billows-.27)*2.4,0,1)*envelope
cloudLight=np.clip(.78+billows*.23+(1-cy)*.12,0,1)
cloudRgb=np.stack([cloudLight*.98,cloudLight,cloudLight],-1)
save('coastal-cloud.webp',np.concatenate([cloudRgb,alpha[...,None]],-1))

# A compact architectural atlas: albedo grain, roughness, and relief height.
# Courses are sized in building-space by the material, across modular pieces.
tiles=[];n=256;ay,ax=np.mgrid[0:n,0:n]/n
for kind in range(4):
    grain=fbm(n);fine=noise(n,91)
    if kind==0:
        row=np.floor(ay*24);u=np.mod(ax*12+np.mod(row,2)*.5,1);v=np.mod(ay*24,1)
        joint=np.minimum(np.minimum(u,1-u),np.minimum(v,1-v))<.055
        h=.54+grain*.19-joint*.22;albedo=.64+grain*.28-joint*.16;rough=.83+fine*.12
    elif kind==1:
        row=np.floor(ay*20);u=np.mod(ax*14+np.mod(row,2)*.5,1);v=np.mod(ay*20,1)
        joint=(v<.07)|(u<.04);h=.4+v*.17+grain*.1-joint*.2
        albedo=.54+grain*.27+v*.08-joint*.1;rough=.72+fine*.16
    elif kind==2:
        seams=np.minimum(np.mod(ax*7,1),1-np.mod(ax*7,1))<.035
        stripes=np.sin(ax*550+noise(n,19)*14)*.055
        h=.5+grain*.13+stripes-seams*.18;albedo=.56+grain*.3+stripes-seams*.16;rough=.77+fine*.13
    else:
        h=.5+grain*.08;albedo=.64+grain*.14;rough=np.full_like(h,.6)
    tiles.append(np.stack([albedo,rough,h],-1))
save('architecture-surface.webp',atlas(tiles),True)

# Carved symbols are relief decals, not floating emblems or emissive effects.
relief=Image.new('RGBA',(1024,1024),(0,0,0,0))
for tile in range(4):
    layer=Image.new('RGBA',(512,512),(0,0,0,0));d=ImageDraw.Draw(layer)
    dark=(74,77,65,245);light=(174,171,144,230)
    def stroke(points,width=5):
        d.line([(x+2,y+3) for x,y in points],fill=light,width=width+2)
        d.line(points,fill=dark,width=width)
    if tile==0:
        for row in range(10):
            y=40+row*44
            for col in range(5):
                x=62+col*81;k=(row*7+col*3)%5
                stroke([(x,y),(x,y+27),(x+22,y+10),(x,y+17)],4)
                if k%2:stroke([(x-12,y+6),(x+21,y+25)],3)
                if k>1:stroke([(x+9,y),(x+9,y+29)],3)
    elif tile==1:
        stroke([(64,152),(244,190),(244,380),(64,335),(64,152)],8)
        stroke([(268,190),(448,152),(448,335),(268,380),(268,190)],8)
        stroke([(256,188),(256,388)],7)
        for row in range(5):
            stroke([(90,196+row*25),(218,222+row*25)],4)
            stroke([(292,222+row*25),(420,196+row*25)],4)
        stroke([(242,120),(256,84),(270,120),(305,134),(270,147),(256,182),(242,147),(207,134),(242,120)],5)
    elif tile==2:
        for r in [122,175,207]:d.ellipse((256-r,256-r,256+r,256+r),outline=dark,width=5)
        for j in range(24):
            a=j*np.pi/12
            stroke([(256+np.cos(a)*175,256+np.sin(a)*175),(256+np.cos(a)*(205 if j%3==0 else 190),256+np.sin(a)*(205 if j%3==0 else 190))],4)
        stroke([(256,56),(430,356),(82,356),(256,56)],5)
        stroke([(256,75),(256,437)],4);stroke([(75,256),(437,256)],4)
        d.ellipse((240,240,272,272),outline=dark,width=5)
    else:
        stroke([(100,72),(412,72),(398,301),(256,448),(114,301),(100,72)],10)
        for j in range(3):
            x=150+j*75;stroke([(x,323),(x,260-j*53),(x+62,260-j*53),(x+62,323)],10)
    relief.alpha_composite(layer,((tile%2)*512,(tile//2)*512))
atomic_image(relief,'architecture-reliefs.webp',lossless=True,exact=True,method=6)

manifest={'version':scene['version'],'sourceHash':scene['sourceHash'],'probes':scene.get('probes',[]),'sunLocal':scene['sun'],'bounds':b,'bakeSize':S,'atlasSize':1024,
    'channels':{'lighting':['ambient occlusion','sun and object visibility','moisture'],
        'coast':['signed distance: (r-.5)*32','depth: g*20','open exposure','cliff gradient: (a-.5)*2'],
        'rma':['roughness','ambient occlusion','height']},'assets':{p.name:p.stat().st_size for p in OUT.iterdir() if p.suffix in ('.webp','.png') and p.name!='coast-depth.webp'}}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(f"Baked {len(manifest['assets'])} compressed maps: {sum(manifest['assets'].values())/1024:.0f} KiB total.")
