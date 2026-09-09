import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode } from 'lucide-react';
import { UserProfile } from '../../types';

export function CustomerScan({ user }: { user: UserProfile }) {
  const [qrSrc, setQrSrc] = useState<string>('');

  useEffect(() => {
    if (user?.id) {
      QRCode.toDataURL(user.id, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      })
      .then((url) => setQrSrc(url))
      .catch((err) => console.error(err));
    }
  }, [user]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-gray-900 p-6 relative">
      <div className="text-center mb-8 z-10">
        <h2 className="text-3xl font-bold mb-2">Your QR Code</h2>
        <p className="text-gray-500">Show this code to the merchant to earn or redeem points</p>
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-gray-100 mb-8 z-10">
        {qrSrc ? (
          <img src={qrSrc} alt="Your QR Code" className="w-64 h-64" />
        ) : (
          <div className="w-64 h-64 flex items-center justify-center bg-gray-50 rounded-2xl">
            <QrCode size={48} className="text-gray-300 animate-pulse" />
          </div>
        )}
      </div>

      <div className="text-center z-10">
        <p className="text-sm font-medium text-gray-400 mb-2">Your Customer ID</p>
        <p className="text-lg font-mono font-semibold tracking-wider text-gray-800 bg-white py-3 px-8 rounded-full border border-gray-100 shadow-sm">
          {user.id}
        </p>
      </div>

      {/* Decorative background gradients */}
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-[#0d9254]/10 to-transparent z-0 pointer-events-none"></div>
    </div>
  );
}
