import {File} from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import {FilterMode,ImageFormat,MipmapMode,Skia,rect} from '@shopify/react-native-skia';
import {derivedName,fileFor} from './gallery';
import {registerVariant} from './localLibrary';

const MAX_EDGE=2048;
async function source(name:string){
  const file=fileFor(name);if(!file.exists)throw new Error('Ảnh gốc không còn trên máy.');
  const dimensions=await ImageManipulator.manipulateAsync(file.uri,[],{format:ImageManipulator.SaveFormat.JPEG});
  return {uri:file.uri,width:dimensions.width,height:dimensions.height};
}
async function persist(uri:string,name:string,parent:string){
  const out=fileFor(name);await new File(uri).copy(out);await registerVariant(name,parent);return name;
}
export async function transform(name:string,kind:'square'|'4:3'|'16:9'|'rotate'|'flip'){
  const input=await source(name);
  const actions:ImageManipulator.Action[]=[];
  if(kind==='rotate')actions.push({rotate:90});
  else if(kind==='flip')actions.push({flip:ImageManipulator.FlipType.Horizontal});
  else{
    const ratio=kind==='square'?1:kind==='4:3'?4/3:16/9;
    const width=Math.min(input.width,Math.floor(input.height*ratio));
    const height=Math.min(input.height,Math.floor(input.width/ratio));
    actions.push({crop:{originX:Math.floor((input.width-width)/2),originY:Math.floor((input.height-height)/2),width,height}});
  }
  const result=await ImageManipulator.manipulateAsync(input.uri,actions,{compress:.95,format:ImageManipulator.SaveFormat.JPEG});
  return persist(result.uri,derivedName(name,kind.replace(':','-')),name);
}
async function skiaSource(name:string){
  const input=await source(name);let uri=input.uri;
  if(Math.max(input.width,input.height)>MAX_EDGE){
    const scale=MAX_EDGE/Math.max(input.width,input.height);
    uri=(await ImageManipulator.manipulateAsync(uri,[{resize:{width:Math.round(input.width*scale)}}],
      {compress:.97,format:ImageManipulator.SaveFormat.JPEG})).uri;
  }
  const bytes=await new File(uri).bytes();
  const image=Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(bytes));
  if(!image)throw new Error('Không đọc được ảnh JPEG.');
  const surface=Skia.Surface.MakeOffscreen(image.width(),image.height());
  if(!surface)throw new Error('Thiết bị không thể xử lý ảnh này.');
  return {image,surface};
}
async function saveSurface(name:string,tag:string,surface:ReturnType<typeof Skia.Surface.MakeOffscreen>){
  if(!surface)throw new Error('Không thể tạo ảnh.');
  surface.flush();const snapshot=surface.makeImageSnapshot();
  if(!snapshot)throw new Error('Không thể xuất ảnh.');
  const outputName=derivedName(name,tag);const out=fileFor(outputName);
  out.create();out.write(snapshot.encodeToBytes(ImageFormat.JPEG,94));
  await registerVariant(outputName,name);return outputName;
}
export async function applyColor(name:string,tag:string,matrix:number[]){
  const {image,surface}=await skiaSource(name);const w=image.width(),h=image.height();
  const paint=Skia.Paint();paint.setColorFilter(Skia.ColorFilter.MakeMatrix(matrix));
  surface.getCanvas().drawImageRectOptions(image,rect(0,0,w,h),rect(0,0,w,h),FilterMode.Linear,MipmapMode.Linear,paint);
  return saveSurface(name,tag,surface);
}
export type Sticker='none'|'star'|'heart'|'circle';
export async function addDecoration(name:string,caption:string,placement:'top'|'center'|'bottom',color:string,sticker:Sticker){
  const text=caption.trim().slice(0,60);if(!text&&sticker==='none')throw new Error('Nhập chữ hoặc chọn hình dán.');
  const {image,surface}=await skiaSource(name);const w=image.width(),h=image.height();const canvas=surface.getCanvas();
  canvas.drawImage(image,0,0);
  const size=Math.max(24,Math.round(w*.055));const font=Skia.Font(undefined,size);
  const paint=Skia.Paint();paint.setColor(Skia.Color(color));
  const shadow=Skia.Paint();shadow.setColor(Skia.Color('#000000'));
  const y=placement==='top'?size+30:placement==='center'?Math.round(h/2):h-35;
  if(sticker!=='none'){
    const cx=w/2,cy=text?y-size*1.7:y-size*.35,r=size*.75;
    if(sticker==='circle')canvas.drawCircle(cx,cy,r,paint);
    else{
      const builder=Skia.PathBuilder.Make();
      if(sticker==='star'){
        for(let i=0;i<10;i++){const angle=-Math.PI/2+i*Math.PI/5,rad=i%2?r*.45:r;
          const px=cx+Math.cos(angle)*rad,py=cy+Math.sin(angle)*rad;if(i===0)builder.moveTo(px,py);else builder.lineTo(px,py);}
        builder.close();
      }else{
        builder.moveTo(cx,cy+r*.85).cubicTo(cx-r*1.6,cy-r*.1,cx-r*.8,cy-r*1.35,cx,cy-r*.5)
          .cubicTo(cx+r*.8,cy-r*1.35,cx+r*1.6,cy-r*.1,cx,cy+r*.85).close();
      }
      canvas.drawPath(builder.detach(),paint);
    }
  }
  if(text){const x=Math.max(18,Math.round((w-font.measureText(text).width)/2));
    canvas.drawText(text,x+2,y+2,shadow,font);canvas.drawText(text,x,y,paint,font);}
  return saveSurface(name,'decorate',surface);
}
