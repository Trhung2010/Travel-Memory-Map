export const SCENES=[
  'camera','pro-camera','filters','filter-preview','review','editor','crop','adjust','decorate','compare',
  'export','share','library','photo','albums','album','favorites','search','memories','settings'
] as const;
export type Scene=typeof SCENES[number];
export const TITLES:Record<Scene,string>={
  camera:'Chụp thường','pro-camera':'Chụp Pro',filters:'Bộ lọc','filter-preview':'Xem thử bộ lọc',
  review:'Ảnh vừa chụp',editor:'Chỉnh sửa ảnh',crop:'Cắt và xoay',adjust:'Ánh sáng và màu',
  decorate:'Chữ và hình dán',compare:'Trước và sau',export:'Xuất ảnh',share:'Chia sẻ ảnh',
  library:'Thư viện LUMA',photo:'Chi tiết ảnh',albums:'Album',album:'Chi tiết album',
  favorites:'Ảnh yêu thích',search:'Tìm ảnh',memories:'Kỷ niệm',settings:'Cài đặt và lưu trữ'
};
export function isScene(value:string):value is Scene{return (SCENES as readonly string[]).includes(value);}
