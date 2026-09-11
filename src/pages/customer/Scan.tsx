import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { ArrowLeft, User } from 'lucide-react';
import { UserProfile } from '../../types';

export function CustomerScan({ user }: { user: UserProfile }) {
  const [qrSrc, setQrSrc] = useState<string>('');

  useEffect(() => {
    if (user?.id) {
      QRCode.toDataURL(user.id, {
        width: 250,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      })
      .then((url) => setQrSrc(url))
      .catch((err) => console.error(err));
    }
  }, [user]);

  const customerId = user.id?.substring(0, 8) || 'AE-USER';

  return (
    <div className="bg-[#111315] min-h-screen flex flex-col relative font-sans">
      {/* Header - White Top */}
      <div className="bg-white rounded-b-[32px] overflow-hidden z-20 shadow-sm relative">
        <header className="flex items-center justify-between px-5 py-4">
          <Link to="/customer/home" className="text-gray-800"><ArrowLeft size={24} /></Link>
          <h1 className="text-[18px] font-bold text-gray-900">My QR Code</h1>
          <div className="w-6" /> {/* Spacer for centering */}
        </header>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 relative z-10 pb-[100px]">
        
        {/* Viewfinder Area */}
        <div className="relative w-[280px] h-[280px] mb-8">
          {/* Viewfinder Corners */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white" />
          
          {/* QR Code Container */}
          <div className="absolute inset-4 bg-white rounded-xl flex items-center justify-center overflow-hidden">
            {qrSrc ? (
              <img src={qrSrc} alt="Your QR Code" className="w-full h-full object-cover" />
            ) : (
              <div className="animate-pulse bg-gray-200 w-full h-full rounded-xl"></div>
            )}
          </div>
        </div>

        <p className="text-[15px] font-semibold text-white tracking-wide text-center mb-12">
          Show this to the merchant
        </p>

        {/* Bottom Button (Adapted from "Enter Code Manually") */}
        <div className="w-full max-w-[320px]">
          <div className="w-full bg-white rounded-[16px] py-4 px-6 flex items-center justify-center gap-3 active:scale-[0.98] transition-transform shadow-lg cursor-pointer">
            <User size={20} className="text-gray-600" />
            <span className="text-[16px] font-bold text-gray-900">ID: {customerId}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
