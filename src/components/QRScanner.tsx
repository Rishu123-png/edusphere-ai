import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export default function QRScanner({onScan}:{onScan:(text:string)=>void}){
  const id = "qr-reader";
  const ref = useRef<Html5Qrcode|null>(null);
  useEffect(()=>{
    const qr = new Html5Qrcode(id);
    ref.current = qr;
    qr.start({ facingMode:"environment" }, { fps:10, qrbox:220 }, onScan, ()=>{}).catch(()=>{});
    return ()=>{ qr.stop().catch(()=>{}); qr.clear(); };
  },[]);
  return <div id={id} style={{width:'100%'}}></div>;
}
