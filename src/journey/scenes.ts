export const JOURNEY_SCENES = [
  'home',
  'trips',
  'create-trip',
  'edit-trip',
  'trip-overview',
  'trip-map',
  'place-detail',
  'timeline',
  'create-memory',
  'camera',
  'capture-review',
  'media-picker',
  'audio-recorder',
  'audio-review',
  'document-picker',
  'edit-memory',
  'memory-detail',
  'gallery',
  'story',
  'settings',
] as const;

export type JourneyScene = typeof JOURNEY_SCENES[number];

export type SceneDefinition = {
  id: JourneyScene;
  title: string;
  eyebrow: string;
  description: string;
};

export const SCENE_DEFINITIONS: Record<JourneyScene, SceneDefinition> = {
  home: {id:'home', title:'Trang chủ', eyebrow:'KHÁM PHÁ', description:'Tiếp tục hành trình gần đây hoặc bắt đầu một chuyến đi mới.'},
  trips: {id:'trips', title:'Tất cả chuyến đi', eyebrow:'HÀNH TRÌNH', description:'Tìm và lọc các chuyến sắp tới, đang diễn ra hoặc đã hoàn thành.'},
  'create-trip': {id:'create-trip', title:'Tạo chuyến đi', eyebrow:'CHUYẾN ĐI MỚI', description:'Đặt tên, thời gian và điểm đến cho hành trình.'},
  'edit-trip': {id:'edit-trip', title:'Chỉnh sửa chuyến đi', eyebrow:'THÔNG TIN', description:'Cập nhật nội dung hoặc ảnh bìa của chuyến đi.'},
  'trip-overview': {id:'trip-overview', title:'Tổng quan chuyến đi', eyebrow:'TỔNG QUAN', description:'Xem tiến độ, số địa điểm và các loại kỷ niệm đã lưu.'},
  'trip-map': {id:'trip-map', title:'Bản đồ hành trình', eyebrow:'BẢN ĐỒ', description:'Khám phá các kỷ niệm theo vị trí địa lý.'},
  'place-detail': {id:'place-detail', title:'Chi tiết địa điểm', eyebrow:'ĐỊA ĐIỂM', description:'Xem những nội dung được ghi lại tại cùng một nơi.'},
  timeline: {id:'timeline', title:'Timeline hành trình', eyebrow:'DÒNG THỜI GIAN', description:'Theo dõi chuyến đi theo ngày và thời điểm.'},
  'create-memory': {id:'create-memory', title:'Tạo kỷ niệm', eyebrow:'GHI LẠI', description:'Chọn ảnh, video, âm thanh, ghi chú hoặc tài liệu.'},
  camera: {id:'camera', title:'Camera', eyebrow:'CHỤP & QUAY', description:'Ghi lại khoảnh khắc ngay trong ứng dụng.'},
  'capture-review': {id:'capture-review', title:'Xem lại nội dung', eyebrow:'XEM TRƯỚC', description:'Giữ lại, chụp lại hoặc thêm nội dung vào kỷ niệm.'},
  'media-picker': {id:'media-picker', title:'Chọn ảnh và video', eyebrow:'THƯ VIỆN MÁY', description:'Nhập ảnh hoặc video đã có trên thiết bị.'},
  'audio-recorder': {id:'audio-recorder', title:'Ghi âm kỷ niệm', eyebrow:'ÂM THANH', description:'Thu lại câu chuyện và cảm xúc của chuyến đi.'},
  'audio-review': {id:'audio-review', title:'Nghe lại ghi âm', eyebrow:'BẢN GHI', description:'Phát, đổi tên hoặc thu lại đoạn âm thanh.'},
  'document-picker': {id:'document-picker', title:'Đính kèm tài liệu', eyebrow:'TÀI LIỆU', description:'Lưu vé, lịch trình hoặc tệp PDF cùng chuyến đi.'},
  'edit-memory': {id:'edit-memory', title:'Chỉnh sửa kỷ niệm', eyebrow:'NỘI DUNG', description:'Bổ sung tiêu đề, cảm xúc, thời gian và vị trí.'},
  'memory-detail': {id:'memory-detail', title:'Chi tiết kỷ niệm', eyebrow:'KỶ NIỆM', description:'Xem toàn bộ nội dung và thông tin vị trí đã lưu.'},
  gallery: {id:'gallery', title:'Thư viện chuyến đi', eyebrow:'MEDIA', description:'Duyệt ảnh và video theo ngày hoặc địa điểm.'},
  story: {id:'story', title:'Story hành trình', eyebrow:'CÂU CHUYỆN', description:'Vuốt qua những khoảnh khắc nổi bật của chuyến đi.'},
  settings: {id:'settings', title:'Cài đặt và lưu trữ', eyebrow:'HỆ THỐNG', description:'Quản lý quyền, dung lượng và dữ liệu trên thiết bị.'},
};

export function isJourneyScene(value: string): value is JourneyScene {
  return (JOURNEY_SCENES as readonly string[]).includes(value);
}

