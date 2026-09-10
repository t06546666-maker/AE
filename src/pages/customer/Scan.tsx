import { Link } from 'react-router-dom';
import { ArrowLeft, Keyboard } from 'lucide-react';
import { UserProfile } from '../../types';

export function CustomerScan({ user }: { user: UserProfile }) {
  return (
    <div className="bg-zinc-900 min-h-screen flex flex-col relative pb-[100px]">
      {/* Header */}
      <header className="flex items-center px-5 py-4 sticky top-0 z-20">
        <div className="flex items-center gap-4 text-white">
          <Link to="/customer/home"><ArrowLeft size={24} /></Link>
          <h1 className="text-lg font-bold">Scan & Earn</h1>
        </div>
      </header>

      {/* Simulated Camera View Overlay */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-6 -mt-10">
        {/* Scanning Frame */}
        <div className="relative w-64 h-64 mb-8">
          {/* Corner borders */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg"></div>
          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg"></div>
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg"></div>
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg"></div>
          
          {/* Simulated QR Code (Placeholder for camera feed) */}
          <div className="absolute inset-2 bg-white/10 rounded-lg backdrop-blur-sm flex items-center justify-center overflow-hidden">
             <div className="w-full h-1 bg-green-400 absolute top-1/2 left-0 animate-bounce shadow-[0_0_10px_#4ade80]"></div>
          </div>
        </div>

        <p className="text-white text-center font-medium text-lg mb-12">
          Scan the merchant's<br/>AE QR code
        </p>

        {/* Enter Code Manually Button */}
        <button className="bg-white text-gray-900 font-bold py-3.5 px-6 w-full max-w-sm rounded-full flex items-center justify-center gap-2 shadow-lg hover:bg-gray-50 active:scale-[0.98] transition-transform">
          <Keyboard size={20} className="text-gray-500" />
          Enter Code Manually
        </button>
      </div>
      
      {/* Dark overlay gradients for camera realism */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/80 z-0 pointer-events-none"></div>
    </div>
  );
}
