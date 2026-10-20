import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {Canvas,ColorMatrix,Image as SkImage,useImage} from '@shopify/react-native-skia';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import {useFocusEffect,useLocalSearchParams,useRouter} from 'expo-router';
import {ActivityIndicator,Alert,Image,Pressable,ScrollView,StyleSheet,Switch,Text,TextInput,View,useWindowDimensions} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Action,BottomNav,Chip,EmptyState,Panel,ScreenHeader,SectionTitle} from '../components/Ui';
import {addDecoration,applyColor,transform,type Sticker} from '../lib/imageOps';
import {createAlbum,deleteAlbum,deleteLocalPhoto,library,setAlbum,toggleFavorite,type Album,type LocalPhoto} from '../lib/localLibrary';
import {matrixAt,PRESETS} from '../lib/presets';
import {usePrefs} from '../state/Prefs';
import {C} from '../theme/colors';
import {isScene,TITLES,type Scene} from './scenes';
import CameraScreen from '../../app/index';

const navScenes=new Set<Scene>(['filters','library','memories','settings']);
const date=(time:number)=>new Date(time||Date.now()).toLocaleDateString('vi-VN');
function PhotoGrid({items,onOpen,width}:{items:LocalPhoto[];onOpen:(name:string)=>void;width:number}){
  const size=(width-48)/3;
  return <View style={styles.grid}>{items.map(p=><Pressable key={p.name} accessibilityRole="button" accessibilityLabel={`Mở ảnh ${p.name}`} onPress={()=>onOpen(p.name)}>
    <Image source={{uri:p.uri}} style={{width:size,height:size,borderRadius:8,backgroundColor:C.elevated}}/>
  </Pressable>)}</View>;
}
function PhotoPreview({uri}:{uri:string}){return <Image source={{uri}} style={styles.preview} resizeMode="contain"/>;}
function Row({title,detail,onPress}:{title:string;detail?:string;onPress:()=>void}){
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.row}><View style={{flex:1}}><Text style={styles.rowTitle}>{title}</Text>{detail&&<Text style={styles.muted}>{detail}</Text>}</View><Text style={styles.chevron}>›</Text></Pressable>;
}
function adjustMatrix(brightness:number,contrast:number,saturation:number){
  const gray=[.2126,.7152,.0722],keep=1-saturation;
  const offset=(1-contrast)/2+brightness;
  const color=(channel:number)=>gray.map((weight,i)=>contrast*(keep*weight+(i===channel?saturation:0)));
  const r=color(0),g=color(1),b=color(2);
  return [r[0],r[1],r[2],0,offset,g[0],g[1],g[2],0,offset,b[0],b[1],b[2],0,offset,0,0,0,1,0];
}
export default function StudioScene(){
  const router=useRouter();const params=useLocalSearchParams<{scene:string;name?:string;id?:string;preset?:string;undo?:string}>();
  const scene=isScene(params.scene)?params.scene:'library';
  const name=typeof params.name==='string'?params.name:'';
  const albumId=typeof params.id==='string'?params.id:'';
  const {width}=useWindowDimensions();const {prefs,setPrefs}=usePrefs();
  const [photos,setPhotos]=useState<LocalPhoto[]>([]),[albums,setAlbums]=useState<Album[]>([]);
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  const [albumTitle,setAlbumTitle]=useState(''),[search,setSearch]=useState('');
  const [selected,setSelected]=useState('hassel-natural'),[intensity,setIntensity]=useState(1),[showOriginal,setShowOriginal]=useState(false);
  const [brightness,setBrightness]=useState(0),[contrast,setContrast]=useState(1),[saturation,setSaturation]=useState(1);
  const [caption,setCaption]=useState(''),[placement,setPlacement]=useState<'top'|'center'|'bottom'>('bottom'),[textColor,setTextColor]=useState<string>(C.white),[sticker,setSticker]=useState<Sticker>('none');
  const [,requestWritePermission]=MediaLibrary.usePermissions({writeOnly:true,granularPermissions:['photo']});
  const reload=useCallback(async()=>{try{const found=await library();setPhotos(found.photos);setAlbums(found.albums);}catch(e){Alert.alert('Không mở được thư viện',String(e));}finally{setLoading(false);}},[]);
  useFocusEffect(useCallback(()=>{setLoading(true);void reload();},[reload]));
  useEffect(()=>{if(typeof params.preset==='string'&&PRESETS.some(p=>p.id===params.preset))setSelected(params.preset);},[params.preset]);
  const photo=photos.find(p=>p.name===name);
  const skImage=useImage(photo?.uri??null);
  const preset=PRESETS.find(p=>p.id===selected)||PRESETS[0];
  const filterMatrix=useMemo(()=>matrixAt(preset,showOriginal?0:intensity),[preset,intensity,showOriginal]);
  const colorMatrix=useMemo(()=>adjustMatrix(showOriginal?0:brightness,showOriginal?1:contrast,showOriginal?1:saturation),[brightness,contrast,saturation,showOriginal]);
  const previewWidth=width-40;const previewHeight=skImage?Math.min(480,Math.max(180,previewWidth*skImage.height()/skImage.width())):300;
  const go=(target:Scene,extra:Record<string,string>={})=>target==='camera'?router.push('/'):
    router.push({pathname:'/studio/[scene]',params:{scene:target,...extra}});
  const back=()=>router.canGoBack()?router.back():router.replace('/');
  const run=async(task:()=>Promise<void>)=>{if(busy)return;setBusy(true);try{await task();}catch(e){Alert.alert('Không thực hiện được',e instanceof Error?e.message:String(e));}finally{setBusy(false);}};
  const open=(photoName:string)=>go('photo',{name:photoName});
  const saveVariant=async(task:()=>Promise<string>)=>run(async()=>{const next=await task();await reload();go('review',{name:next,undo:'1'});});
  const undoVariant=()=>void run(async()=>{
    const parent=photo?.parent;if(!parent||!photos.some(p=>p.name===parent))throw new Error('Không tìm thấy bản ảnh trước.');
    await deleteLocalPhoto(name);
    router.replace({pathname:'/studio/[scene]',params:{scene:'review',name:parent}});
  });
  const dateMatches=(p:LocalPhoto,query:string)=>date(p.created).includes(query)||new Date(p.created).toLocaleString('vi-VN',{month:'long',year:'numeric'}).toLowerCase().includes(query);
  const searchResults=photos.filter(p=>p.name.toLowerCase().includes(search.toLowerCase())||dateMatches(p,search.toLowerCase())||
    p.albumIds.some(id=>albums.find(a=>a.id===id)?.title.toLowerCase().includes(search.toLowerCase())));
  const album=albums.find(a=>a.id===albumId);
  const sortedMonths=[...new Set(photos.map(p=>new Date(p.created).toLocaleString('vi-VN',{month:'long',year:'numeric'})))];
  const preview=(matrix:number[])=>skImage?<View style={styles.canvasWrap}><Canvas style={{width:previewWidth,height:previewHeight}}>
    <SkImage image={skImage} x={0} y={0} width={previewWidth} height={previewHeight} fit="contain"><ColorMatrix matrix={matrix}/></SkImage>
  </Canvas></View>:<View style={styles.loading}><ActivityIndicator color={C.accent}/><Text style={styles.muted}>Đang mở ảnh…</Text></View>;
  const requirePhoto=()=>photo?<PhotoPreview uri={photo.uri}/>:<EmptyState title="Không tìm thấy ảnh" detail="Ảnh có thể đã bị xóa khỏi LUMA." action={<Action title="Mở thư viện" onPress={()=>go('library')}/>}/>;

  if(scene==='pro-camera')return <CameraScreen mode="pro"/>;
  if(scene==='camera')return <CameraScreen/>;
  const body=():React.ReactNode=>{
    switch(scene){
      case 'filters':return <>
        <Text style={styles.muted}>Chọn màu có sẵn. Màu là mô phỏng phong cách ảnh, không phải bộ lọc chính hãng.</Text>
        {!photo&&<Panel><Text style={styles.rowTitle}>Áp màu cho ảnh nào?</Text><Text style={styles.muted}>Chọn bộ lọc, rồi chạm một ảnh bên dưới để xem thử.</Text>
          {!photos.length&&<Action title="Chụp ảnh" secondary onPress={()=>go('camera')}/>}</Panel>}
        <SectionTitle>BỘ LỌC CÓ SẴN</SectionTitle>
        {PRESETS.map(p=><Pressable key={p.id} accessibilityRole="button" accessibilityState={{selected:selected===p.id}} style={[styles.row,selected===p.id&&styles.selectedRow]}
          onPress={()=>photo?go('filter-preview',{name,preset:p.id}):setSelected(p.id)}><View style={{flex:1}}><Text style={styles.rowTitle}>{p.label}</Text><Text style={styles.muted}>{p.subtitle}</Text></View><Text style={styles.chevron}>{photo?'›':selected===p.id?'✓':''}</Text></Pressable>)}
        {!photo&&!!photos.length&&<><SectionTitle>CHỌN ẢNH</SectionTitle><PhotoGrid items={photos} onOpen={picked=>go('filter-preview',{name:picked,preset:selected})} width={width}/></>}
      </>;
      case 'filter-preview':return photo?<>
        {preview(filterMatrix)}<Panel><Text style={styles.hero}>{preset.label}</Text><Text style={styles.muted}>{preset.subtitle}</Text>
          <Action title={showOriginal?'Đang xem ảnh gốc · chạm để trở lại':'Xem ảnh gốc'} secondary onPress={()=>setShowOriginal(v=>!v)}/></Panel>
        <SectionTitle>CƯỜNG ĐỘ</SectionTitle><View style={styles.chips}>{[0,.25,.5,.75,1].map(n=><Chip key={n} title={`${Math.round(n*100)}%`} active={intensity===n} onPress={()=>setIntensity(n)}/>)}</View>
        <SectionTitle>BỘ LỌC</SectionTitle><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{PRESETS.map(p=><Chip key={p.id} title={p.label} active={p.id===selected} onPress={()=>setSelected(p.id)}/>)}</ScrollView>
        <Action title={busy?'Đang lưu…':'Lưu thành ảnh mới'} disabled={busy||!skImage} onPress={()=>void saveVariant(()=>applyColor(name,preset.id,matrixAt(preset,intensity)))}/>
      </>:requirePhoto();
      case 'review':return photo?<>{requirePhoto()}<Text style={styles.muted}>Đã lưu trong LUMA · {date(photo.created)}</Text>
        {params.undo==='1'&&photo.parent&&<Action title="Hoàn tác bước vừa rồi" secondary disabled={busy} onPress={undoVariant}/>}
        <Action title="Chỉnh sửa ảnh" onPress={()=>go('editor',{name})}/><Action title="Chia sẻ" secondary onPress={()=>go('share',{name})}/><Action title="Xem chi tiết" secondary onPress={()=>go('photo',{name})}/>
        <Action title="Chụp ảnh tiếp" secondary onPress={()=>go('camera')}/></>:requirePhoto();
      case 'editor':return photo?<>{requirePhoto()}<SectionTitle>CÔNG CỤ CHỈNH SỬA</SectionTitle>
        <Row title="Bộ lọc" detail="Màu ảnh lấy cảm hứng từ máy ảnh" onPress={()=>go('filters',{name})}/>
        <Row title="Cắt và xoay" detail="Khung vuông, 4:3, 16:9, xoay và lật" onPress={()=>go('crop',{name})}/>
        <Row title="Ánh sáng và màu" detail="Độ sáng, tương phản, độ rực" onPress={()=>go('adjust',{name})}/>
        <Row title="Chữ và hình dán" detail="Thêm chữ hoặc hình dán trực tiếp vào ảnh" onPress={()=>go('decorate',{name})}/>
        <Row title="So sánh trước/sau" detail="Xem ảnh gốc và bản chỉnh sửa" onPress={()=>go('compare',{name})}/>
      </>:requirePhoto();
      case 'crop':return photo?<>{requirePhoto()}<Text style={styles.muted}>Mỗi thao tác tạo một ảnh mới; ảnh hiện tại được giữ nguyên.</Text>
        <SectionTitle>TỶ LỆ KHUNG</SectionTitle><View style={styles.chips}>{(['square','4:3','16:9'] as const).map(v=><Chip key={v} title={v==='square'?'Vuông':v} active={false} onPress={()=>void saveVariant(()=>transform(name,v))}/>)}</View>
        <SectionTitle>XOAY VÀ LẬT</SectionTitle><Action title="Xoay 90°" secondary disabled={busy} onPress={()=>void saveVariant(()=>transform(name,'rotate'))}/>
        <Action title="Lật ngang" secondary disabled={busy} onPress={()=>void saveVariant(()=>transform(name,'flip'))}/>
      </>:requirePhoto();
      case 'adjust':return photo?<>{preview(colorMatrix)}<Action title={showOriginal?'Đang xem gốc · chạm để trở lại':'Xem ảnh gốc'} secondary onPress={()=>setShowOriginal(v=>!v)}/>
        <SectionTitle>ĐỘ SÁNG</SectionTitle><View style={styles.chips}>{[-.2,-.1,0,.1,.2].map(v=><Chip key={v} title={`${Math.round(v*100)}`} active={brightness===v} onPress={()=>setBrightness(v)}/>)}</View>
        <SectionTitle>TƯƠNG PHẢN</SectionTitle><View style={styles.chips}>{[.7,.85,1,1.15,1.3].map(v=><Chip key={v} title={`${Math.round(v*100)}%`} active={contrast===v} onPress={()=>setContrast(v)}/>)}</View>
        <SectionTitle>ĐỘ RỰC</SectionTitle><View style={styles.chips}>{[0,.5,1,1.25,1.5].map(v=><Chip key={v} title={`${Math.round(v*100)}%`} active={saturation===v} onPress={()=>setSaturation(v)}/>)}</View>
        <Action title={busy?'Đang lưu…':'Lưu thành ảnh mới'} disabled={busy||!skImage} onPress={()=>void saveVariant(()=>applyColor(name,'adjust',adjustMatrix(brightness,contrast,saturation)))}/>
      </>:requirePhoto();
      case 'decorate':return photo?<><View style={styles.decorated}><Image source={{uri:photo.uri}} style={styles.preview} resizeMode="contain"/>
        {(!!caption.trim()||sticker!=='none')&&<View style={[styles.decorationOverlay,placement==='top'?{top:25}:placement==='center'?{top:'43%'}:{bottom:25}]}>
          {sticker!=='none'&&<Text style={[styles.stickerPreview,{color:textColor}]}>{sticker==='star'?'★':sticker==='heart'?'♥':'●'}</Text>}
          {!!caption.trim()&&<Text style={[styles.overlayText,{color:textColor}]} numberOfLines={1}>{caption}</Text>}
        </View>}</View>
        <TextInput style={styles.input} placeholder="Nhập chữ trên ảnh" placeholderTextColor={C.dim} value={caption} onChangeText={setCaption} maxLength={60}/>
        <SectionTitle>VỊ TRÍ</SectionTitle><View style={styles.chips}>{(['top','center','bottom'] as const).map((v,i)=><Chip key={v} title={['Trên','Giữa','Dưới'][i]} active={placement===v} onPress={()=>setPlacement(v)}/>)}</View>
        <SectionTitle>MÀU CHỮ</SectionTitle><View style={styles.chips}>{[C.white,C.accent,C.danger].map((v,i)=><Chip key={v} title={['Trắng','Vàng','Hồng'][i]} active={textColor===v} onPress={()=>setTextColor(v)}/>)}</View>
        <SectionTitle>HÌNH DÁN</SectionTitle><View style={styles.chips}>{(['none','star','heart','circle'] as const).map((v,i)=><Chip key={v} title={['Không','Sao','Tim','Chấm'][i]} active={sticker===v} onPress={()=>setSticker(v)}/>)}</View>
        <Action title={busy?'Đang lưu…':'Lưu thành ảnh mới'} disabled={busy||(!caption.trim()&&sticker==='none')} onPress={()=>void saveVariant(()=>addDecoration(name,caption,placement,textColor,sticker))}/>
        <Text style={styles.muted}>Ảnh xuất sẽ giới hạn cạnh dài 2.048 px để xử lý ổn định trên điện thoại.</Text>
      </>:requirePhoto();
      case 'compare':return photo?<>{photo.parent&&photos.some(p=>p.name===photo.parent)?<>
        <Text style={styles.muted}>Chạm từng ảnh để mở chi tiết.</Text><View style={styles.compareRow}>
          {[photos.find(p=>p.name===photo.parent)!,photo].map((p,i)=><Pressable key={p.name} style={styles.compareCell} onPress={()=>open(p.name)}>
            <Image source={{uri:p.uri}} style={styles.compareImage} resizeMode="contain"/><Text style={styles.muted}>{i?'Sau':'Trước'}</Text></Pressable>)}
        </View></>:<EmptyState title="Đây là ảnh gốc" detail="Hãy tạo bản chỉnh sửa để so sánh trước và sau." action={<Action title="Chỉnh sửa ảnh" onPress={()=>go('editor',{name})}/>}/>}</>:requirePhoto();
      case 'export':return photo?<>{requirePhoto()}<Panel><Text style={styles.rowTitle}>Lưu vào thư viện điện thoại</Text>
        <Text style={styles.muted}>Tạo một bản sao bên ngoài LUMA. Bản sao này còn trên máy khi xóa ảnh trong ứng dụng.</Text></Panel>
        <Action title={busy?'Đang xuất…':'Lưu vào máy'} disabled={busy} onPress={()=>void run(async()=>{const permission=await requestWritePermission();if(!permission.granted)throw new Error('Bạn cần cho phép lưu ảnh vào thư viện điện thoại.');
          await MediaLibrary.createAssetAsync(photo.uri);Alert.alert('Đã lưu ảnh','Ảnh đã nằm trong thư viện điện thoại.');})}/>
      </>:requirePhoto();
      case 'share':return photo?<>{requirePhoto()}<Panel><Text style={styles.rowTitle}>Chọn ứng dụng để gửi</Text>
        <Text style={styles.muted}>Điện thoại sẽ mở bảng chia sẻ. LUMA không tự đăng công khai hoặc lưu danh sách người nhận.</Text></Panel>
        <Action title={busy?'Đang mở…':'Mở bảng chia sẻ'} disabled={busy} onPress={()=>void run(async()=>{if(!await Sharing.isAvailableAsync())throw new Error('Thiết bị không hỗ trợ bảng chia sẻ.');
          await Sharing.shareAsync(photo.uri,{mimeType:'image/jpeg',dialogTitle:'Chia sẻ ảnh LUMA'});})}/>
        <Action title="Lưu vào máy" secondary onPress={()=>go('export',{name})}/>
      </>:requirePhoto();
      case 'library':return <><Text style={styles.muted}>{photos.length} ảnh lưu trên máy · không cần tài khoản</Text>
        <View style={styles.quick}><Action title="Album" secondary onPress={()=>go('albums')}/><Action title="Yêu thích" secondary onPress={()=>go('favorites')}/><Action title="Tìm ảnh" secondary onPress={()=>go('search')}/></View>
        {!photos.length?<EmptyState title="Chưa có ảnh" detail="Chụp ảnh đầu tiên để bắt đầu thư viện của bạn." action={<Action title="Mở camera" onPress={()=>go('camera')}/>}/>:<PhotoGrid items={photos} onOpen={open} width={width}/>}
      </>;
      case 'photo':return photo?<>{requirePhoto()}<Text style={styles.muted}>{date(photo.created)} · {(photo.size/1048576).toFixed(2)} MB · JPEG</Text>
        {photo.parent&&photos.some(p=>p.name===photo.parent)&&<Row title="Mở ảnh trước khi chỉnh" detail="Bản gốc hoặc phiên bản trước vẫn được giữ" onPress={()=>open(photo.parent!)}/>}
        <View style={styles.quick}><Action title={photo.favorite?'Bỏ yêu thích':'Yêu thích'} secondary onPress={()=>void run(async()=>{await toggleFavorite(name);await reload();})}/>
          <Action title="Chỉnh sửa" onPress={()=>go('editor',{name})}/></View>
        <View style={styles.quick}><Action title="Chia sẻ" secondary onPress={()=>go('share',{name})}/><Action title="Lưu vào máy" secondary onPress={()=>go('export',{name})}/>
          <Action title="So sánh" secondary onPress={()=>go('compare',{name})}/></View>
        <SectionTitle>THÊM VÀO ALBUM</SectionTitle>{!albums.length?<Row title="Tạo album đầu tiên" onPress={()=>go('albums')}/>:
          albums.map(a=><Pressable key={a.id} style={styles.row} onPress={()=>void run(async()=>{await setAlbum(name,a.id,!photo.albumIds.includes(a.id));await reload();})}>
            <Text style={styles.rowTitle}>{photo.albumIds.includes(a.id)?'☑':'□'} {a.title}</Text></Pressable>)}
        <Action title="Xóa ảnh khỏi LUMA" secondary onPress={()=>Alert.alert('Xóa ảnh?','Ảnh sẽ bị xóa khỏi LUMA. Bản đã lưu ra thư viện điện thoại không bị ảnh hưởng.',[
          {text:'Hủy',style:'cancel'},{text:'Xóa',style:'destructive',onPress:()=>void run(async()=>{await deleteLocalPhoto(name);router.replace({pathname:'/studio/[scene]',params:{scene:'library'}});})}])}/>
      </>:requirePhoto();
      case 'albums':return <><Text style={styles.muted}>Sắp xếp ảnh trong LUMA. Một ảnh có thể nằm trong nhiều album.</Text>
        <View style={styles.createRow}><TextInput style={[styles.input,{flex:1}]} placeholder="Tên album mới" placeholderTextColor={C.dim} value={albumTitle} onChangeText={setAlbumTitle} maxLength={50}/>
          <Action title="Tạo" disabled={!albumTitle.trim()||busy} onPress={()=>void run(async()=>{await createAlbum(albumTitle);setAlbumTitle('');await reload();})}/></View>
        {!albums.length&&<EmptyState title="Chưa có album" detail="Tạo album rồi thêm ảnh từ màn Chi tiết ảnh."/>}
        {albums.map(a=><Row key={a.id} title={a.title} detail={`${photos.filter(p=>p.albumIds.includes(a.id)).length} ảnh`} onPress={()=>go('album',{id:a.id})}/>)}
      </>;
      case 'album':return album?<><Text style={styles.hero}>{album.title}</Text><Text style={styles.muted}>{photos.filter(p=>p.albumIds.includes(album.id)).length} ảnh</Text>
        <Action title="Thêm ảnh từ thư viện" secondary onPress={()=>go('library')}/>
        {!photos.some(p=>p.albumIds.includes(album.id))?<EmptyState title="Album còn trống" detail="Mở một ảnh rồi chọn album này trong Chi tiết ảnh."/>:
          <PhotoGrid items={photos.filter(p=>p.albumIds.includes(album.id))} onOpen={open} width={width}/>}
        <Action title="Xóa album" secondary onPress={()=>Alert.alert('Xóa album?','Ảnh trong album vẫn được giữ trong Thư viện LUMA.',[
          {text:'Hủy',style:'cancel'},{text:'Xóa',style:'destructive',onPress:()=>void run(async()=>{await deleteAlbum(album.id);go('albums');})}])}/>
      </>:<EmptyState title="Không tìm thấy album" action={<Action title="Xem album" onPress={()=>go('albums')}/>}/>;
      case 'favorites':return photos.some(p=>p.favorite)?<PhotoGrid items={photos.filter(p=>p.favorite)} onOpen={open} width={width}/>:
        <EmptyState title="Chưa có ảnh yêu thích" detail="Mở Chi tiết ảnh và đánh dấu Yêu thích." action={<Action title="Mở thư viện" onPress={()=>go('library')}/>}/>;
      case 'search':return <><TextInput style={styles.input} placeholder="Tìm theo ngày, tháng, album hoặc tên file" placeholderTextColor={C.dim} value={search} onChangeText={setSearch}/>
        <Text style={styles.muted}>{search.trim()?`${searchResults.length} kết quả`:'Nhập từ khóa để tìm ảnh trên máy.'}</Text>
        {search.trim()&&<PhotoGrid items={searchResults} onOpen={open} width={width}/>}
      </>;
      case 'memories':return photos.length?sortedMonths.map(month=><View key={month}><SectionTitle>{month.toUpperCase()}</SectionTitle>
        <PhotoGrid items={photos.filter(p=>new Date(p.created).toLocaleString('vi-VN',{month:'long',year:'numeric'})===month)} onOpen={open} width={width}/></View>):
        <EmptyState title="Chưa có kỷ niệm" detail="Ảnh chụp trong LUMA sẽ xuất hiện ở đây theo thời gian." action={<Action title="Mở camera" onPress={()=>go('camera')}/>}/>;
      case 'settings':return <><SectionTitle>CAMERA</SectionTitle>
        <Panel><View style={styles.settingRow}><View style={{flex:1}}><Text style={styles.rowTitle}>Lưới bố cục 3 × 3</Text><Text style={styles.muted}>Căn khung khi chụp</Text></View>
          <Switch value={prefs.grid} onValueChange={v=>setPrefs({grid:v})} trackColor={{true:C.accent,false:C.elevated}} thumbColor={C.white}/></View></Panel>
        <Panel><Text style={styles.rowTitle}>Hẹn giờ mặc định</Text><View style={styles.chips}>{([0,3,5,10] as const).map(n=><Chip key={n} title={n?`${n} giây`:'Tắt'} active={prefs.timer===n} onPress={()=>setPrefs({timer:n})}/>)}</View></Panel>
        <Panel><Text style={styles.rowTitle}>Chất lượng JPEG</Text><View style={styles.chips}>{[.85,.95,1].map(n=><Chip key={n} title={`${Math.round(n*100)}%`} active={prefs.quality===n} onPress={()=>setPrefs({quality:n})}/>)}</View></Panel>
        <SectionTitle>LƯU TRỮ VÀ RIÊNG TƯ</SectionTitle><Panel><Text style={styles.rowTitle}>{photos.length} ảnh · {(photos.reduce((sum,p)=>sum+p.size,0)/1048576).toFixed(1)} MB</Text>
          <Text style={styles.muted}>Ảnh và album nằm trên thiết bị. Gỡ ứng dụng hoặc xóa dữ liệu ứng dụng có thể làm mất ảnh chưa xuất sang thư viện điện thoại. LUMA không dùng tài khoản hay tự tải ảnh lên mạng.</Text>
          <Text style={styles.muted}>Chụp Pro chỉ có điều khiển mà Expo Go hỗ trợ trên thiết bị: zoom, đèn flash, hẹn giờ, đổi camera và khung ngắm.</Text></Panel>
      </>;
    }
  };
  return <SafeAreaView style={styles.screen} edges={['top','bottom']}>
    <ScreenHeader title={TITLES[scene]} back={back}/>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      {loading?<View style={styles.loading}><ActivityIndicator color={C.accent}/></View>:body()}
    </ScrollView>
    <BottomNav active={navScenes.has(scene)?scene:scene==='filter-preview'?'filters':'library'} navigate={target=>target==='camera'?router.replace('/'):
      router.replace({pathname:'/studio/[scene]',params:{scene:target}})}/>
  </SafeAreaView>;
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:C.bg},content:{padding:16,paddingBottom:32,gap:12},
  muted:{color:C.muted,fontSize:13,lineHeight:20},hero:{color:C.white,fontSize:22,fontWeight:'700'},
  preview:{width:'100%',height:330,backgroundColor:C.surface,borderRadius:12},decorated:{position:'relative'},
  decorationOverlay:{position:'absolute',alignSelf:'center',alignItems:'center',maxWidth:'88%'},
  overlayText:{fontSize:20,fontWeight:'800',textShadowColor:'#000000',textShadowRadius:4,textShadowOffset:{width:1,height:2}},
  stickerPreview:{fontSize:32,fontWeight:'800',textShadowColor:'#000000',textShadowRadius:4,textShadowOffset:{width:1,height:2}},
  canvasWrap:{alignItems:'center',backgroundColor:C.surface,borderRadius:12,overflow:'hidden'},
  loading:{minHeight:240,justifyContent:'center',alignItems:'center',gap:12},
  chips:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:6},
  quick:{flexDirection:'row',flexWrap:'wrap',gap:8},grid:{flexDirection:'row',flexWrap:'wrap',gap:8},
  row:{minHeight:62,flexDirection:'row',alignItems:'center',backgroundColor:C.surface,borderRadius:12,borderWidth:1,borderColor:C.border,paddingHorizontal:16,paddingVertical:10,gap:12},
  selectedRow:{borderColor:C.accent},
  rowTitle:{color:C.white,fontSize:15,fontWeight:'700'},chevron:{color:C.accent,fontSize:26},
  input:{minHeight:48,backgroundColor:C.surface,borderWidth:1,borderColor:C.border,borderRadius:12,paddingHorizontal:14,color:C.white,fontSize:14},
  createRow:{flexDirection:'row',gap:8,alignItems:'center'},
  compareRow:{flexDirection:'row',gap:8},compareCell:{flex:1,alignItems:'center',gap:8},compareImage:{width:'100%',height:260,backgroundColor:C.surface,borderRadius:10},
  settingRow:{flexDirection:'row',alignItems:'center',gap:10},
});
