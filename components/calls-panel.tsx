'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { PhoneCall, PhoneOff, Loader2, ExternalLink } from 'lucide-react';

export function CallsPanel() {
  const [callUrl, setCallUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(false);

  async function startCall() {
    setLoading(true);
    try {
      const res = await fetch('/api/daily-token');
      const data = await res.json();
      setCallUrl(data.url);
      setActive(true);
    } catch (_) {
      setCallUrl('https://hammerradio.daily.co/hammer-radio-call-in');
      setActive(true);
    }
    setLoading(false);
  }

  function endCall() {
    setActive(false);
    setCallUrl(null);
  }

  return (
    <div className="p-4 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <PhoneCall className="w-5 h-5 text-[#E8650A]" />
        <h2 className="text-lg font-semibold">Call-In Studio</h2>
      </div>

      {!active ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
          <div className="w-20 h-20 rounded-full bg-[#0D1525] border-2 border-[rgba(232,101,10,0.3)] flex items-center justify-center">
            <PhoneCall className="w-8 h-8 text-[#E8650A]" />
          </div>
          <div>
            <p className="text-white font-semibold text-lg">Ready for Call-Ins</p>
            <p className="text-gray-500 text-sm mt-1">Start the room when you're on air and ready to take calls.</p>
          </div>
          <Button
            onClick={startCall}
            disabled={loading}
            className="bg-[#E8650A] hover:bg-[#E8650A]/90 text-white font-bold px-8 py-3"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Connecting…</>
              : <><PhoneCall className="w-4 h-4 mr-2" /> Open Call Room</>}
          </Button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm text-green-400 font-medium">Room Active</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-gray-700 text-gray-400 hover:text-white"
                onClick={() => callUrl && window.open(callUrl, '_blank')}
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1" /> Open in Tab
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-red-800 text-red-400 hover:bg-red-950/40"
                onClick={endCall}
              >
                <PhoneOff className="w-3.5 h-3.5 mr-1" /> End Room
              </Button>
            </div>
          </div>
          {callUrl && (
            <iframe
              src={callUrl}
              allow="camera; microphone; fullscreen; speaker; display-capture"
              className="flex-1 rounded-lg border border-[rgba(232,101,10,0.2)] w-full min-h-[400px]"
            />
          )}
        </div>
      )}
    </div>
  );
}
