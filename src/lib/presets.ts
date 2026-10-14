// Color matrices operate on RGBA [0..1] and apply an affine transform.
// Artistic approximations only, NOT genuine Leica/Hasselblad/ZEISS profiles.
export type Preset = { id:string; label:string; family:string; subtitle:string; matrix:number[] };
const m=(r:number,g:number,b:number,ro=0,go=0,bo=0,s=1):number[] => {
  const a=(1-s)*0.2126, c=(1-s)*0.7152, d=(1-s)*0.0722;
  return [r*(a+s),r*c,r*d,0,ro, g*a,g*(c+s),g*d,0,go, b*a,b*c,b*(d+s),0,bo, 0,0,0,1,0];
};
export const PRESETS:Preset[]=[
 {id:'original',label:'Original',family:'Neutral',subtitle:'Không chỉnh màu',matrix:m(1,1,1)},
 {id:'leica-classic',label:'Leica Classic',family:'Leica inspired',subtitle:'Ấm · trầm · tương phản',matrix:m(1.07,1.015,0.91,0.014,0,-0.012,0.94)},
 {id:'leica-vivid',label:'Leica Vivid',family:'Leica inspired',subtitle:'Đỏ đậm · màu giàu',matrix:m(1.11,1.02,0.97,0.008,-0.005,-0.005,1.13)},
 {id:'hassel-natural',label:'Hassel Natural',family:'Hasselblad inspired',subtitle:'Da tự nhiên · màu dịu',matrix:m(1.025,1.015,1.005,0.002,0.001,0,0.96)},
 {id:'hassel-portrait',label:'Hassel Portrait',family:'Hasselblad inspired',subtitle:'Ấm nhẹ · mềm sắc',matrix:m(1.04,1.005,0.98,0.009,0.004,0.003,0.90)},
 {id:'zeiss-natural',label:'ZEISS Natural',family:'ZEISS inspired',subtitle:'Màu sạch · cân bằng',matrix:m(1.00,1.01,1.04,0,0,0,0.99)},
 {id:'zeiss-crisp',label:'ZEISS Crisp',family:'ZEISS inspired',subtitle:'Lạnh nhẹ · tươi',matrix:m(1.025,1.035,1.07,-0.003,-0.003,0,1.065)}
];
export function matrixAt(p:Preset,intensity:number):number[]{
  const t=Math.max(0,Math.min(1,intensity));
  const id=m(1,1,1);
  return p.matrix.map((v,i)=>id[i]+(v-id[i])*t);
}
