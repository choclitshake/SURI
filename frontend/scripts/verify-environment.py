"""Checks the actual encoded artifacts, including transparent-RGB regressions."""
from pathlib import Path
import hashlib, json
import numpy as np
from PIL import Image

root=Path(__file__).resolve().parents[1];assets=root/'public/world-map/environment'
manifest=json.loads((assets/'manifest.json').read_text())
source=hashlib.sha256()
for name in ['landscape.ts','settlements.ts','environment.ts','architecture.ts','outerLandmarks.ts','architecturalModules.ts','landmarkDesigns.ts','supportingArchitecture.ts','northernIslands.ts','northernArchitecture.ts','traversalArchitecture.ts','traversal.ts','generated/traversal.json','worldPalette.ts','environmentDecor.ts']:
    source.update((root/'lib/worldMap'/name).read_text().replace('\r\n','\n').encode())
assert source.hexdigest()==manifest['sourceHash'],'Environment bake is stale: rerun both bake scripts.'
assert sum(manifest['assets'].values())<5*1024*1024,'Compressed asset budget'
for name,size in manifest['assets'].items():
    path=assets/name
    assert path.stat().st_size==size,f'{name}: stale manifest'
    image=Image.open(path);image.load()
    assert max(image.size)<=1024,f'{name}: tablet texture budget'

normal=np.asarray(Image.open(assets/'terrain-normal.webp'),dtype=float)/255*2-1
assert np.max(np.abs(np.linalg.norm(normal,axis=-1)-1))<.018,'Normalized tangent normals'
water_normal=np.asarray(Image.open(assets/'water-normal.webp'),dtype=float)[:,:,:2]/255-.5
energy=sum(np.abs(np.fft.fftshift(np.fft.fft2(water_normal[:,:,i])))**2 for i in range(2))
n=energy.shape[0];fy,fx=np.mgrid[-n//2:n//2,-n//2:n//2]
band=(fx*fx+fy*fy>16)&(fx*fx+fy*fy<10000);angle=np.mod(np.arctan2(fy,fx),np.pi)
directions=np.array([energy[band&(angle>=k*np.pi/12)&(angle<(k+1)*np.pi/12)].sum() for k in range(12)])
assert directions.max()/directions.sum()<.18,'Water ripples avoid a dominant repeating directional grating'
rma=np.asarray(Image.open(assets/'terrain-rma.webp'),dtype=float)/255
assert rma[:,:,0].min()>.65,'Dielectric terrain remains rough'
assert rma[:,:,1].min()>.5,'Micro AO avoids crushed black detail'
lighting=np.asarray(Image.open(assets/'lighting-mask.webp'),dtype=float)/255
assert lighting[:,:,0].min()>.35,'Conservative baked occlusion'
assert lighting[:,:,1].min()<.6 and lighting[:,:,1].max()>.95,'Sunlit and occluded terrain both represented'
coast=np.asarray(Image.open(assets/'coast-depth.png'),dtype=float)/255
assert coast[:,:,3].min()>=127/255,'Never store depth data under zero image alpha'
assert coast[:,:,1].max()>.5,'Open-ocean depth survives encoding'
b=manifest['bounds'];size=manifest['bakeSize']
for p in manifest['probes']:
    x=round((p['x']-b['minX'])/(b['maxX']-b['minX'])*(size-1))
    y=size-1-round((p['z']-b['minZ'])/(b['maxZ']-b['minZ'])*(size-1))
    decoded=(coast[y,x,0]-.5)*32
    assert abs(decoded-np.clip(p['coast'],-16,16))<.5,f'{p}: shore mask aligns with actual terrain'
sun=np.array(manifest['sunLocal']);altitude=np.degrees(np.arctan2(sun[1],np.linalg.norm(sun[[0,2]])))
assert 50<altitude<55,'Moderate mid-afternoon solar altitude'
print(f"PASS: {len(manifest['assets'])} texture assets, {sum(manifest['assets'].values())/1024:.0f} KiB; normals, AO, depth, shoreline alignment and {altitude:.1f} degree daylight.")
