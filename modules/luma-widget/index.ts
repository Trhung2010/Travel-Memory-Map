import {requireOptionalNativeModule} from 'expo';

type NativeWidget={setLatest(uri:string,label:string):Promise<void>;clear():Promise<void>};
export function widgetModule():NativeWidget|null {
  return requireOptionalNativeModule<NativeWidget>('LumaWidget');
}
