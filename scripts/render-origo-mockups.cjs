// Run offline: NODE_PATH=<directory containing sharp> node scripts/render-origo-mockups.cjs FRONT.png BACK.png ART_DIR
// Studio blank extents and reference garment/art bounds are in pixels on the respective images.
// Reference coordinates use the Airventory editor screenshots rendered at 1996 px viewport width.
// Keep each original art's aspect ratio, excluding transparent padding from placement.
const sharp = require('sharp');
const path = require('node:path');
const [front, back, artwork] = process.argv.slice(2);
const output = path.join(__dirname, '../public/assets/origo-001');
const studio = { front: [51,161,1200,1097], back: [49,162,1199,1093] };
const template = {
  front: { shirt:[214,382,1067,1073], print:[602,559,679,596] },
  original: { shirt:[214,382,1067,1073], print:[433,490,850,1019] },
  // The two patterned files share the same cutout bounds and face scale. Use the
  // centered Fuchsia template as the reference for the patterned edition pair.
  bordered: { shirt:[178,243,1270,1127], print:[442,367,1008,1077] }
};
async function render(side, ref, file, name) {
  const base = side==='front' ? front : back;
  const meta=await sharp(base).metadata();
  if(meta.width!==1254||meta.height!==1254) throw Error('Unexpected studio blank dimensions');
  const [x,y,r,b]=studio[side], [ax,ay,ar,ab]=ref.shirt, [l,t,rr,bb]=ref.print;
  const width=Math.round((rr-l)/(ar-ax)*(r-x));
  const cx=x+((l+rr)/2-ax)/(ar-ax)*(r-x);
  const cy=y+((t+bb)/2-ay)/(ab-ay)*(b-y);
  const opacity=await sharp(path.join(artwork,file)).extractChannel('alpha').raw().toBuffer({resolveWithObject:true});
  let x0=opacity.info.width,y0=opacity.info.height,x1=-1,y1=-1;
  for(let i=0;i<opacity.data.length;i++) if(opacity.data[i]>10){
    const xx=i%opacity.info.width, yy=Math.floor(i/opacity.info.width);
    if(xx<x0)x0=xx;if(xx>x1)x1=xx;if(yy<y0)y0=yy;if(yy>y1)y1=yy;
  }
  const layer=await sharp(path.join(artwork,file)).extract({left:x0,top:y0,width:x1-x0+1,height:y1-y0+1}).resize({width}).png().toBuffer({resolveWithObject:true});
  const left=Math.round(cx-width/2),top=Math.round(cy-layer.info.height/2);
  await sharp(base).composite([{input:layer.data,left,top}]).webp({quality:95,effort:6}).toFile(path.join(output,name+'.webp'));
  console.log(name, {left,top,width,height:layer.info.height,hemGap:b-top-layer.info.height});
}
(async()=>{
  await render('front',template.front,'Frente-Platano.png','studio-front');
  for(const e of ['Original','Cobalt','Fuchsia'])await render('back',e==='Original'?template.original:template.bordered,'Espalda-'+e+'.png','studio-'+e.toLowerCase()+'-back');
})().catch(e=>{console.error(e);process.exitCode=1});
