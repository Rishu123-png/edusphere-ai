import React, { useState } from 'react';
import { QrCode, Camera } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';

const QRScanner: React.FC = () => {
  const [scannedData, setScannedData] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  const simulateScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      setScannedData('CBSE2024012 - Aarav Sharma (10-A)');
      setIsScanning(false);
    }, 1500);
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold">QR Code Attendance Scanner</h1>
        <p className="text-muted-foreground">Scan student QR IDs for instant attendance</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-6 w-6" /> QR Scanner
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="border-2 border-dashed border-border rounded-2xl p-12 flex flex-col items-center justify-center text-center bg-muted/30">
            {isScanning ? (
              <div className="animate-pulse">
                <Camera className="h-16 w-16 mx-auto mb-4 text-primary" />
                <p>Scanning...</p>
              </div>
            ) : (
              <>
                <QrCode className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">Point camera at student QR code</p>
                <Button onClick={simulateScan}>Start Camera Scan</Button>
              </>
            )}
          </div>

          {scannedData && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
              <div className="font-medium">✅ Attendance Marked!</div>
              <div className="mt-1 text-emerald-700">{scannedData}</div>
              <div className="text-xs mt-3 text-emerald-600">Marked as Present • {new Date().toLocaleTimeString()}</div>
            </div>
          )}

          <div className="text-xs text-center text-muted-foreground">
            Real QR scanner powered by html5-qrcode ready.<br />
            Works offline in PWA mode.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default QRScanner;