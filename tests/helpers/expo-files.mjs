import {createHash} from 'node:crypto';
export const files=new Map();
export const fault={write:false};
export const Paths={document:'file:///documents',cache:'file:///cache',availableDiskSpace:1e12};
export const FileMode={ReadOnly:'r',WriteOnly:'w'};
const uriOf=value=>typeof value==='string'?value:value.uri;
export class Directory{
  constructor(...parts){this.uri=parts.map(uriOf).join('/');}
  get exists(){return true;}
  create(){}
  list(){return [...files.keys()].filter(uri=>uri.startsWith(this.uri+'/')).map(uri=>new File(uri));}
}
export class File{
  constructor(...parts){this.uri=parts.map(uriOf).join('/');}
  get exists(){return files.has(this.uri);}
  get name(){return this.uri.split('/').at(-1);}
  get size(){return files.get(this.uri)?.bytes.length??0;}
  get modificationTime(){return files.get(this.uri)?.modified??null;}
  create(){files.set(this.uri,{bytes:new Uint8Array(),open:0,modified:Date.now()});}
  delete(){if(files.get(this.uri)?.open)throw new Error('Cannot delete open file');files.delete(this.uri);}
  copy(destination){files.set(destination.uri,{bytes:files.get(this.uri).bytes.slice(),open:0,modified:Date.now()});}
  async digest(){return createHash('sha256').update(files.get(this.uri).bytes).digest('hex');}
  open(mode){
    const entry=files.get(this.uri);if(!entry)throw new Error('Missing file');entry.open++;
    let offset=0,closed=false;
    return {
      readBytes(size){if(closed)throw new Error('Closed');const result=entry.bytes.slice(offset,offset+size);offset+=result.length;return result;},
      writeBytes(bytes){
        if(closed||mode!==FileMode.WriteOnly)throw new Error('Closed or read-only');
        if(fault.write)throw new Error('Injected disk failure');
        const output=new Uint8Array(Math.max(entry.bytes.length,offset+bytes.length));output.set(entry.bytes);output.set(bytes,offset);offset+=bytes.length;entry.bytes=output;
      },
      close(){if(!closed){closed=true;entry.open--;}}
    };
  }
}
export function seed(uri,bytes){files.set(uri,{bytes:new Uint8Array(bytes),open:0,modified:Date.now()});return uri;}
export function reset(){files.clear();fault.write=false;Paths.availableDiskSpace=1e12;}
