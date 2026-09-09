"""Independent source-to-output assertions; never substitutes human anatomy review."""
import argparse, hashlib, json, pathlib, struct
import numpy as np
import nrrd
from PIL import Image
import trimesh

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--cache',type=pathlib.Path,default=pathlib.Path('.private-assets/spl-source'))
p.add_argument('--output',type=pathlib.Path,default=pathlib.Path('public/anatomy'))
a=p.parse_args()
m=json.loads((a.output/'manifest.json').read_text(encoding='utf8'))
src,h=nrrd.read(str(a.cache/'slicer/volumes/labels/hncma-atlas.nrrd'))

def checkfile(rel,record):
    path=a.output.parent/rel
    raw=path.read_bytes()
    assert len(raw)==record['bytes'],rel
    assert hashlib.sha256(raw).hexdigest()==record['sha256'],rel
    return raw

def glb_json(raw):
    assert raw[:4]==b'glTF' and struct.unpack_from('<I',raw,4)[0]==2
    assert struct.unpack_from('<I',raw,8)[0]==len(raw)
    length,kind=struct.unpack_from('<II',raw,12)
    assert kind==0x4E4F534A
    return json.loads(raw[20:20+length])

ids=[s['id'] for s in m['assets']]
assert len(ids)==len(set(ids))==258
assert sum(s['hasVolume'] for s in m['assets'])==236
assert set(s['id'] for s in m['assets'] if s['technicalReview']!='verified')=={
    'spl-2','spl-41','spl-506','spl-510','spl-1016','spl-3005','spl-3007'}
for s in m['assets']:
    raw=checkfile(s['path'],s);doc=glb_json(raw)
    assert any(n.get('name')==s['id'] and 'mesh' in n for n in doc['nodes']),s['id']
    assert 'NORMAL' in doc['meshes'][0]['primitives'][0]['attributes'],s['id']
    scene=trimesh.load_scene(file_obj=a.output.parent/s['path'])
    mesh=next(iter(scene.geometry.values()))
    assert np.isfinite(mesh.vertices).all() and np.isfinite(mesh.vertex_normals).all()
    assert len(mesh.faces)==s['triangles']
    assert np.allclose(mesh.bounds,s['bounds'],atol=1e-4),s['id']
    if s['representation']=='segmentation-isosurface':
        assert mesh.is_watertight and mesh.is_winding_consistent and mesh.volume>0,s['id']
for pack in m['packs']:
    doc=glb_json(checkfile(pack['path'],pack))
    assert {n['name'] for n in doc['nodes'] if 'mesh' in n}==set(pack['assetIds'])

# Read each source plane directly rather than calling the conversion helper.
# This catches transposes, reversed lateralities, truncation and byte-order errors.
checked=0
for plane,axis in [('axial',1),('coronal',0),('sagittal',2)]:
    for entry in m['slices'][plane]['entries']:
        index=entry['index']
        checkfile(entry['mriPath'],entry['mri'])
        checkfile(entry['labelsPath'],entry['labels'])
        pixels=np.asarray(Image.open(a.output.parent/entry['labelsPath'])).astype(np.uint16)
        labels=pixels[:,:,0]+256*pixels[:,:,1]
        expected=np.take(src,index,axis=axis)
        if plane=='sagittal': expected=expected.T
        assert np.array_equal(labels,expected),(plane,index)
        assert np.all(pixels[:,:,2]==0)
        checked+=1

# Header-derived transforms: known scanner grid landmarks in all eight corners.
mat=np.asarray(m['coordinates']['labelIjkToRas'])
inverse=np.linalg.inv(mat)
for i in [0,255]:
    for j in [0,255]:
        for k in [0,255]:
            voxel=np.array([i,j,k,1]);expected=np.array([128-k,128-i,128-j,1])
            assert np.array_equal(mat@voxel,expected)
            assert np.array_equal(inverse@expected,voxel)
assert np.allclose(m['coordinates']['labelIjkToMriIjk'],[[1,0,0,-.5],[0,1,0,-.5],[0,0,1,-.5],[0,0,0,1]])
# Fixed landmarks were inspected directly in the original NRRD, independently
# of bestSlices/centroid selection. The bilateral pair checks true laterality.
landmarks=[{'label':19,'ijk':[149,147,128],'ras':[0,-21,-19]},
           {'label':11,'ijk':[122,114,141],'ras':[-13,6,14]},
           {'label':50,'ijk':[122,114,115],'ras':[13,6,14]}]
for point in landmarks:
    i,j,k=point['ijk']
    assert int(src[i,j,k])==point['label']
    assert np.array_equal((mat@np.array([i,j,k,1]))[:3],point['ras'])
    for plane,index,x,y in [('axial',j,k,i),('coronal',i,k,j),('sagittal',k,i,j)]:
        rgb=Image.open(a.output/f'slices/{plane}/{index}-labels.png').getpixel((x,y))
        assert rgb[0]+256*rgb[1]==point['label'],(point,plane)
print(json.dumps({'ok':True,'glbMeshesVerified':len(ids),'packsVerified':len(m['packs']),
                  'fullLabelSlicesComparedToSource':checked,'labelPixelsCompared':checked*256*256,
                  'orientationCornersChecked':8,'fixedNamedLandmarks':3,
                  'anatomicalHumanReview':'pending'},indent=2))
