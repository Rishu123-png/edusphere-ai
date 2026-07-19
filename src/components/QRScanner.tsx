import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

let qrInstanceCounter = 0;

export default function QRScanner({onScan, onClose, facingMode = 'environment'}:{onScan:(text:string)=>void, onClose?:()=>void, facingMode?: 'user' | 'environment'}){
  // Unique DOM id per mounted scanner — two scanners (QR tab + AI camera
  // hybrid overlay) can now coexist without an id clash.
  const idRef = useRef<string>('');
  if (!idRef.current) {
    qrInstanceCounter += 1;
    idRef.current = `qr-reader-mobile-${qrInstanceCounter}`;
  }
  const id = idRef.current;

  const ref = useRef<Html5Qrcode|null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);

  // CRITICAL BUG FIX: `onScan` was in the effect dependency array. Parents
  // re-render on EVERY AI scan tick (~850 ms), so the camera was torn down
  // and restarted constantly, making QR impossible to use live. We hold the
  // newest callback in a ref and start the camera exactly once per mount.
  const onScanRef = useRef(onScan);
  useEffect(() => { onScanRef.current = onScan; }, [onScan]);

  useEffect(()=>{
    let mounted = true;
    const start = async () => {
      try {
        const qr = new Html5Qrcode(id);
        ref.current = qr;
        await qr.start(
          { facingMode },
          { fps:10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
          (text) => {
            if(!mounted) return;
            setScanning(false);
            onScanRef.current(text);
            try { navigator.vibrate?.(100) } catch {
              // Best-effort haptics; safe to ignore.
            }
          },
          () => {
            // Per-frame "no QR found" callback; safe to ignore.
          }
        );
      } catch(e:any){
        if(mounted) setError(e?.message || 'Camera failed. Check permission.');
      }
    }
    start();
    return ()=>{
      mounted = false;
      const qr = ref.current;
      ref.current = null;
      if(qr){
        const clear = () => {
          try { qr.clear() } catch {
            // Best-effort cleanup; safe to ignore.
          }
        };
        if (qr.isScanning) {
          qr.stop().catch((e) => { console.debug('QR stop failed', e); }).finally(clear);
        } else {
          clear();
        }
      }
    };
    // Start once per mount; the freshest onScan is delivered via onScanRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[id, facingMode]);

  return (
    <div className="relative w-full rounded-[24px] overflow-hidden bg-black">
      <div id={id} className="w-full aspect-square" />
      {/* Overlay corners */}
      {scanning && !error && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="relative w-[68%] aspect-square">
            <span className="qr-corner top-0 left-0 border-t-[4px] border-l-[4px] rounded-tl-2xl" />
            <span className="qr-corner top-0 right-0 border-t-[4px] border-r-[4px] rounded-tr-2xl" />
            <span className="qr-corner bottom-0 left-0 border-b-[4px] border-l-[4px] rounded-bl-2xl" />
            <span className="qr-corner bottom-0 right-0 border-b-[4px] border-r-[4px] rounded-br-2xl" />
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/30 animate-pulse" />
          </div>
          <div className="absolute bottom-6 left-0 right-0 text-center text-white/90 text-sm font-medium">
            Align QR inside frame
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-6 text-center">
          <div className="text-white text-sm mb-3">{error}</div>
          <button onClick={onClose} className="px-5 py-2 rounded-full bg-white text-black text-sm font-semibold">Close Scanner</button>
        </div>
      )}
    </div>
  );
}
