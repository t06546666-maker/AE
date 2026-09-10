import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { ArrowLeft, QrCode } from 'lucide-react';
import { UserProfile } from '../../types';

export function CustomerScan({ user }: { user: UserProfile }) {
  const [qrSrc, setQrSrc] = useState<string>('');

  useEffect(() => {
    if (user?.id) {
      QRCode.toDataURL(user.id, {
        width: 300,
        margin: 2,
        color: {
          dark: '#087a4b', // Primary green color
          light: '#ffffff',
        },
      })
      .then((url) => setQrSrc(url))
      .catch((err) => console.error(err));
    }
  }, [user]);

  return (
    <div className="bg-white min-h-screen flex flex-col relative pb-[100px]">
      {/* Header */}
      <header className="flex items-center px-5 py-4 sticky top-0 z-20 bg-white">
        <div className="flex items-center gap-4 text-gray-800">
          <Link to="/customer/home"><ArrowLeft size={24} /></Link>
          <h1 className="text-lg font-bold">My QR Code</h1>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 -mt-10">
        <div className="text-center mb-8">
          <h2 className="text-[22px] font-bold text-gray-900 mb-2 tracking-tight">Your Unique Code</h2>
          <p className="text-[14px] text-gray-500 font-medium">Show this to the merchant to earn<br/>or redeem AE Points.</p>
        </div>

        {/* QR Code Card */}
        <div className="bg-white p-6 rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-gray-100 mb-10">
          {qrSrc ? (
            <img src={qrSrc} alt="Your QR Code" className="w-64 h-64" />
          ) : (
            <div className="w-64 h-64 flex items-center justify-center bg-gray-50 rounded-2xl">
              <QrCode size={48} className="text-[#087a4b] animate-pulse opacity-50" />
            </div>
          )}
        </div>

        {/* Customer ID Pill */}
        <div className="text-center">
          <p className="text-[12px] font-bold text-gray-400 mb-2 uppercase tracking-widest">Customer ID</p>
          <div className="bg-gray-50 py-3 px-6 rounded-full border border-gray-100 flex items-center gap-2 shadow-sm">
            <span className="text-[16px] font-mono font-bold tracking-wider text-gray-800">
              {user.id?.substring(0, 8) || 'AE-USER'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
