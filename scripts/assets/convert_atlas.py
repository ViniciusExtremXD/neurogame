"""Convert pinned SPL data to web GLB surfaces + registered T1/ID PNGs.

No PDF content is read. Labels remain nearest-neighbor integer IDs. Original
surfaces are retained without decimation. Only six missing surface files are
derived, by marching cubes at 0.5 on their actual source label masks.
"""
from __future__ import annotations
import argparse, csv, gzip, hashlib, json, pathlib, re, shutil, sys
import numpy as np
import nrrd
from PIL import Image
from scipy.ndimage import affine_transform
from scipy.spatial import cKDTree
import trimesh
import vtk
from vtk.util.numpy_support import vtk_to_numpy, numpy_to_vtk

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--cache',type=pathlib.Path,default=pathlib.Path('.private-assets/spl-source'))
parser.add_argument('--output',type=pathlib.Path,default=pathlib.Path('public/anatomy'))
args=parser.parse_args()
SOURCE=args.cache
OUT=args.output
COMMIT='bec24db25aad5f7600e2df3becfb1f883e61ff56'
BASE=f'https://raw.githubusercontent.com/mhalle/spl-brain-atlas/{COMMIT}/'

def digest(path):
    raw=path.read_bytes()
    return {'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),
            'gzipBytes':len(gzip.compress(raw,mtime=0))}

def affine(header):
    mat=np.eye(4)
    mat[:3,:3]=np.array(header['space directions']).T
    mat[:3,3]=header['space origin']
    return mat

def module_for(label,name):
    if label in [4,5,15,19,24,43,44]:return 'ventricles'
    if label in [7,46] or 300<=label<=377:return 'cerebellum'
    if label in [35,40,61,66,71,79,84] or 3020<=label<=3033:return 'brainstem'
    if label in [72,77,78,85,100,200,215,216,3002,3003,3008,3011,3012] or 380<=label<=391 or 500<=label<=525:return 'diencephalon'
    return 'telencephalon'

def mesh_from_vtk(path):
    reader=vtk.vtkPolyDataReader();reader.SetFileName(str(path));reader.Update()
    triangulate=vtk.vtkTriangleFilter();triangulate.SetInputData(reader.GetOutput());triangulate.Update()
    poly=triangulate.GetOutput()
    vertices=vtk_to_numpy(poly.GetPoints().GetData()).astype(np.float32)
    cell=vtk_to_numpy(poly.GetPolys().GetData()).reshape((-1,4))
    assert np.all(cell[:,0]==3)
    source_normals=poly.GetPointData().GetNormals()
    normals=vtk_to_numpy(source_normals).astype(np.float32) if source_normals else None
    return trimesh.Trimesh(vertices=vertices,faces=cell[:,1:],vertex_normals=normals,process=False)

def derive_label_mesh(label,volume):
    image=vtk.vtkImageData();image.SetDimensions(*volume.shape)
    mask=np.asfortranarray((volume==label).astype(np.uint8))
    image.GetPointData().SetScalars(numpy_to_vtk(mask.ravel(order='F'),deep=True))
    contour=vtk.vtkMarchingCubes();contour.SetInputData(image);contour.SetValue(0,0.5);contour.Update()
    poly=contour.GetOutput()
    points=vtk_to_numpy(poly.GetPoints().GetData())
    points=np.column_stack((128-points[:,2],128-points[:,0],128-points[:,1]))
    faces=vtk_to_numpy(poly.GetPolys().GetData()).reshape((-1,4))[:,1:]
    normals=vtk_to_numpy(poly.GetPointData().GetNormals())
    normals=np.column_stack((-normals[:,2],-normals[:,0],-normals[:,1]))
    # IJK->RAS has determinant -1, so winding must be reversed.
    return trimesh.Trimesh(vertices=points,faces=faces[:,::-1],vertex_normals=normals,process=False)

def view_array(volume,plane,index):
    if plane=='axial':return volume[:,index,:]
    if plane=='coronal':return volume[index,:,:]
    return volume[:,:,index].T

def main():
    lock=json.loads(pathlib.Path(__file__).with_name('source-lock.json').read_text())
    for record in lock['files']:
        data=(SOURCE/record['path']).read_bytes()
        assert len(data)==record['bytes'] and hashlib.sha256(data).hexdigest()==record['sha256'],record['path']
    for d in ['models','packs','slices','licenses']: (OUT/d).mkdir(parents=True,exist_ok=True)
    volume,h=nrrd.read(str(SOURCE/'slicer/volumes/labels/hncma-atlas.nrrd'))
    mri,mh=nrrd.read(str(SOURCE/'slicer/volumes/imaging/A1_grayT1-1mm_resample.nrrd'))
    ijk_lps=affine(h);mri_lps=affine(mh)
    ras=np.diag([-1.,-1.,1.,1.])@ijk_lps
    assert np.allclose(ras,[[0,0,-1,128],[-1,0,0,128],[0,-1,0,128],[0,0,0,1]])
    sampling=np.linalg.inv(mri_lps)@ijk_lps
    aligned=affine_transform(mri.astype(np.float32),sampling[:3,:3],offset=sampling[:3,3],
                             output_shape=volume.shape,order=1,mode='constant',cval=0,prefilter=False)
    # A fixed whole-volume robust window retains reproducibility; no anatomy is edited.
    upper=float(np.percentile(aligned[aligned>0],99.5))
    gray=np.round(np.clip(aligned/upper,0,1)*255).astype(np.uint8)
    metadata={int(r['value']):r for r in csv.DictReader((SOURCE/'labelinfo/brain-atlas-labels-with-metadata.tsv').open(),delimiter='\t')}
    lut={int(r['value']):r for r in csv.DictReader((SOURCE/'labelinfo/hncma-atlas-lut.tsv').open(),delimiter='\t')}
    sources={int(p.name.split('_')[1]):p for p in (SOURCE/'slicer/models').glob('Model_*.vtk') if int(p.name.split('_')[1])!=3}
    labels=set(int(x) for x in np.unique(volume) if 1<x<4000)
    ids=sorted(labels | set(sources))
    structure_json=json.loads((SOURCE/'slicer/atlasStructure.json').read_text())
    selectors={}
    for node in structure_json:
        if node.get('@type')=='Structure':
            for selector in node.get('sourceSelector',[]):
                if 'LabelMapSelector' in selector.get('@type',[]):selectors[selector['dataKey']]=node
    assets=[];packs={};validation=[]
    for label in ids:
        if label==1 or 4000<=label<5000:continue
        meta=metadata.get(label,lut.get(label,{}))
        name=meta.get('label') or sources[label].stem.split('_',2)[2].replace('_',' ')
        asset_id=f'spl-{label}'
        has_volume=label in labels
        generated=label not in sources
        mesh=derive_label_mesh(label,volume) if generated else mesh_from_vtk(sources[label])
        assert len(mesh.faces)>0 and np.isfinite(mesh.vertices).all()
        module=module_for(label,name)
        color_values=[int(x) for x in re.findall(r'\d+',meta.get('color','rgb(145,165,195)'))[:3]]
        color='#'+''.join(f'{x:02x}' for x in color_values)
        material=trimesh.visual.material.PBRMaterial(name=asset_id,baseColorFactor=color_values+[255],metallicFactor=0.0,roughnessFactor=0.78,doubleSided=False)
        mesh.visual=trimesh.visual.TextureVisuals(material=material)
        mesh.metadata={'assetId':asset_id,'labelId':label,'sourceCommit':COMMIT,'coordinates':'RAS millimeters'}
        scene=trimesh.Scene();scene.add_geometry(mesh,node_name=asset_id,geom_name=asset_id)
        rel=f'models/{asset_id}.glb';path=OUT/rel;path.write_bytes(scene.export(file_type='glb',include_normals=True))
        bbox=np.stack((mesh.vertices.min(0),mesh.vertices.max(0)))
        item={'id':asset_id,'labelId':label,'nameEn':name,'moduleId':module,'path':'anatomy/'+rel,
              'color':color,'center':bbox.mean(0).round(5).tolist(),'bounds':bbox.round(5).tolist(),
              'vertices':len(mesh.vertices),'triangles':len(mesh.faces),'hasVolume':has_volume,
              'representation':'segmentation-isosurface' if generated else ('surface-curve' if label>=5000 else 'source-surface'),
              'radlexId':meta.get('radlex_id') or None,'sourceNode':selectors.get(label,{}).get('@id'),
              'sourcePath':('slicer/volumes/labels/hncma-atlas.nrrd' if generated else str(sources[label].relative_to(SOURCE)).replace('\\','/')),
              'humanReview':'pending','technicalReview':'verified','licenseId':'Slicer-1.0-Part-B',**digest(path)}
        if has_volume:
            vox=np.column_stack(np.where(volume==label))
            assert len(vox)>0
            world=np.column_stack((128-vox[:,2],128-vox[:,0],128-vox[:,1]))
            vb=np.stack((world.min(0)-0.5,world.max(0)+0.5))
            bounds_error=float(np.max(np.abs(vb-bbox)))
            # Check independently against voxel centers. The source label volume
            # contains a few outlier voxels omitted from some official surfaces;
            # report those discrepancies instead of silently enlarging a model.
            stride=max(1,len(mesh.vertices)//2048)
            distances=cKDTree(world).query(mesh.vertices[::stride])[0]
            max_distance=float(distances.max())
            outside=int(np.count_nonzero(np.any((world<bbox[0]-2)|(world>bbox[1]+2),axis=1)))
            if bounds_error>=4.0 or max_distance>=3.0:
                item['technicalReview']='source-discrepancy'
                item['reviewNote']='Source surface and label volume differ; exploration only, excluded from evaluation pending review.'
                print(f'Source discrepancy {asset_id}: bounds={bounds_error:.3f}mm nearest-center={max_distance:.3f}mm outside={outside}',flush=True)
            samples={}
            for plane,axis in [('axial',1),('coronal',0),('sagittal',2)]:
                index=int(np.bincount(vox[:,axis],minlength=256).argmax())
                mask=view_array(volume,plane,index)==label
                pixels=np.column_stack(np.where(mask))
                p=pixels[np.argmin(np.linalg.norm(pixels-pixels.mean(0),axis=1))]
                samples[plane]={'index':index,'pixel':[int(p[1]),int(p[0])],'areaPixels':len(pixels)}
            item.update({'voxelCount':len(vox),'bestSlices':samples,'volumeBounds':vb.tolist()})
            validation.append({'id':asset_id,'sourceMeshVolumeBoundsMaxDifferenceMm':round(bounds_error,5),
                               'surfaceToLabelCenterMaxDistanceMm':round(max_distance,5),
                               'voxelsOutsideSurfaceBoundsPlus2mm':outside,
                               'technicalReview':item['technicalReview'],
                               'voxelCount':len(vox),'samples':samples})
        assets.append(item)
        if module=='telencephalon':
            pack='sulci' if label>=5000 else ('cortex-left' if 1000<=label<2000 else ('cortex-right' if 2000<=label<3000 else 'deep-telencephalon'))
        else:pack=module
        if pack not in packs:packs[pack]=trimesh.Scene()
        packs[pack].add_geometry(mesh,node_name=asset_id,geom_name=asset_id)
        item['packId']=pack
    print(f'Converted {len(assets)} meshes.',flush=True)
    pack_info=[]
    for name,scene in sorted(packs.items()):
        path=OUT/f'packs/{name}.glb';path.write_bytes(scene.export(file_type='glb',include_normals=True))
        pack_info.append({'id':name,'path':f'anatomy/packs/{name}.glb','assetIds':[a['id'] for a in assets if a['packId']==name],**digest(path)})
    slices={}
    for plane in ['axial','coronal','sagittal']:
        (OUT/'slices'/plane).mkdir(exist_ok=True)
        entries=[]
        for index in range(256):
            arr=view_array(volume,plane,index).astype(np.uint16)
            intensity=view_array(gray,plane,index)
            # Preserve full source labels, including non-neural IDs. Unknown IDs must
            # never be accepted as questions by the browser catalog.
            encoded=np.zeros((*arr.shape,3),dtype=np.uint8)
            encoded[:,:,0]=arr&255;encoded[:,:,1]=arr>>8
            prefix=f'slices/{plane}/{index}'
            mip=OUT/(prefix+'-mri.png');lap=OUT/(prefix+'-labels.png')
            Image.fromarray(intensity).save(mip,optimize=True)
            Image.fromarray(encoded).save(lap,optimize=True)
            relevant=sorted(int(x) for x in np.unique(arr) if int(x) in labels)
            entries.append({'index':index,'mriPath':'anatomy/'+prefix+'-mri.png',
                            'labelsPath':'anatomy/'+prefix+'-labels.png','labelIds':relevant,
                            'mri':digest(mip),'labels':digest(lap)})
        slices[plane]={'width':256,'height':256,'entries':entries}
        print(f'Wrote {plane} slices.',flush=True)
    manifest={'schemaVersion':1,'atlas':{'id':'spl-nac-pinned','name':'SPL/NAC Brain Atlas (GitHub edition)',
              'repository':'https://github.com/mhalle/spl-brain-atlas','commit':COMMIT,
              'sourcePage':'https://www.openanatomy.org/atlas-pages/atlas-spl-nac-brain.html',
              'licenseId':'Slicer-1.0-Part-B','modified':True,'humanAnatomicalReview':'pending'},
              'coordinates':{'meshSpace':'RAS','units':'mm','volumeSize':[256,256,256],
              'labelIjkToLps':ijk_lps.tolist(),'labelIjkToRas':ras.tolist(),
              'mriIjkToLps':mri_lps.tolist(),'labelIjkToMriIjk':sampling.tolist(),
              'rasToThree':[[1,0,0,0],[0,0,1,0],[0,-1,0,0],[0,0,0,1]],
              'slicePixelToIjk':{'axial':'[y,index,x]','coronal':'[index,y,x]','sagittal':'[x,y,index]'},
              'sliceOrientation':{'axial':{'top':'A','bottom':'P','left':'R','right':'L'},
                                  'coronal':{'top':'S','bottom':'I','left':'R','right':'L'},
                                  'sagittal':{'top':'S','bottom':'I','left':'A','right':'P'}},
              'labelEncoding':'PNG RGB lossless; labelId=R+256*G, B=0; no interpolation',
              'intensitySampling':'T1 trilinearly resampled into native label grid via header affine',
              'intensityWindow':[0,upper]},'assets':assets,'packs':pack_info,'slices':slices}
    (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf8')
    shutil.copyfile(pathlib.Path(__file__).with_name('source-lock.json'),OUT/'source-lock.json')
    license_text=(SOURCE/'licenses/SLICER-LICENSE.txt').read_text()
    preface='All or portions of this licensed product (such portions are the "Software") have been obtained under license from The Brigham and Women\'s Hospital, Inc. and are subject to the following terms and conditions:\n\n'
    (OUT/'licenses/SLICER-LICENSE.txt').write_text(preface+license_text,encoding='utf8')
    report={'meshCount':len(assets),'volumeMeshCount':sum(a['hasVolume'] for a in assets),
            'surfaceCurveCount':sum(a['representation']=='surface-curve' for a in assets),
            'derivedMeshIds':[a['id'] for a in assets if a['representation']=='segmentation-isosurface'],
            'mriResamplingTransform':sampling.tolist(),'validation':validation,
            'packs':pack_info,'humanReview':'pending'}
    (OUT/'validation.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k!='validation'},indent=2),flush=True)

if __name__=='__main__': main()
