"""Optional native S3TC textures. Lossless WebP/PNG remains the portable fallback."""
from pathlib import Path
from io import BytesIO
import json,struct
import numpy as np
from PIL import Image
root=Path(__file__).resolve().parents[1]/'public/world-map/environment'
report={}
for name,codec in [('terrain-albedo','DXT1'),('architecture-surface','DXT5')]:
    image=Image.open(root/(name+'.webp')).convert('RGBA').transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    parts=[];header=None;level=image;count=0
    while True:
        output=BytesIO();level.save(output,format='DDS',pixel_format=codec);data=output.getvalue()
        if header is None:header=bytearray(data[:128])
        parts.append(data[128:]);count+=1
        if level.width==1 and level.height==1:break
        level=level.resize((max(1,level.width//2),max(1,level.height//2)),Image.Resampling.LANCZOS)
    struct.pack_into('<I',header,8,struct.unpack_from('<I',header,8)[0]|0x20000)
    struct.pack_into('<I',header,28,count)
    struct.pack_into('<I',header,108,0x1000|0x8|0x400000)
    data=bytes(header)+b''.join(parts);dest=root/(name+'.dds');dest.write_bytes(data)
    decoded=np.asarray(Image.open(dest).convert('RGBA'),dtype=float)[:,:,:3]
    mae=float(np.mean(np.abs(decoded-np.asarray(image,dtype=float)[:,:,:3]))/255)
    assert mae<.035,(name,mae)
    report[name]={'bytes':len(data),'mipmaps':count,'meanAbsoluteError':round(mae,5),'codec':codec}
(root/'gpu-textures.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
