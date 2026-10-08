import { CATALOG } from 'inside/catalog';
export const GROUPS=[['all','전체'],['compute','연산'],['memory','메모리'],['storage','저장'],['system','시스템'],['io','입출력'],['network','네트워크']];
const items=[
 ['cpu','CPU','compute'],['gpu','GPU','compute'],['npu','NPU','compute'],['coproc','CHIPSET','compute'],
 ['dram','DDR5','memory'],['sram','SRAM','memory'],['vram','VRAM','memory'],['spirom','SPI FLASH','memory'],
 ['ssd','SSD','storage'],['hdd','HDD','storage'],['mainboard','MAINBOARD','system'],['power','POWER','system'],['cooling','COOLING','system'],['vrm','VRM','system'],['bus','PCIe','system'],
 ['display','DISPLAY','io'],['input','KEYBOARD','io'],['mouse','MOUSE','io'],['audio','SPEAKER','io'],['camera','CAMERA','io'],
 ['nic','ETHERNET','network'],['infra','ROUTER','network'],['datacenter','SERVER','network'],
];
export const HARDWARE=items.map(([id,title,category],i)=>({id,title,category,index:i,...CATALOG[id]}));
export const HARDWARE_BY_ID=Object.fromEntries(HARDWARE.map(p=>[p.id,p]));
export { SCENARIOS as STORIES } from 'inside/scenario-data';
export const FRONT_FACING=new Set(['display','audio','camera','datacenter']);
export const DARK_MODELS=new Set(['cpu','npu','sram','vram','spirom','coproc']);
