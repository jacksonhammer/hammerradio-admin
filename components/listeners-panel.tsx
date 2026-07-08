'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import {
  collection, onSnapshot, deleteDoc, doc,
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Wifi, Ban, Trash2 } from 'lucide-react';
import type { BannedUser } from '@/lib/types';

interface Presence {
  userId: string;
  nickname: string;
  active: boolean;
  lastSeen: any;
}

export function ListenersPanel() {
  const [listenerCount, setListenerCount] = useState<number | null>(null);
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  const [listeners, setListeners] = useState<Presence[]>([]);

  useEffect(() => {
    async function fetchListeners() {
      try {
        const res = await fetch('/api/listeners');
        const data = await res.json();
        setListenerCount(data?.listeners ?? null);
      } catch (_) {
        setListenerCount(null);
      }
    }
    fetchListeners();
    const iv = setInterval(fetchListeners, 15_000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'bannedUsers'), snap => {
      setBannedUsers(snap.docs.map(d => ({ ...(d.data() as BannedUser) })));
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'presence'), snap => {
      const now = Date.now();
      const active = snap.docs
        .map(d => d.data() as Presence)
        .filter(p => {
          if (!p.active) return false;
          if (!p.lastSeen) return true;
          const lastSeenMs = typeof p.lastSeen === 'number'
            ? p.lastSeen
            : p.lastSeen?.toMillis?.() ?? 0;
          return (now - lastSeenMs) < 5 * 60 * 1000;
        });
      setListeners(active);
    });
    return unsub;
  }, []);

  async function unbanUser(userId: string) {
    await deleteDoc(doc(db, 'bannedUsers', userId));
  }

  return (
    <div className="p-4 h-full flex flex-col gap-6">
      {/* Live count */}
      <div className="bg-[#0D1525] border border-[rgba(232,101,10,0.2)] rounded-xl p-6 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-[rgba(232,101,10,0.15)] flex items-center justify-center">
          <Wifi className="w-6 h-6 text-[#E8650A]" />
        </div>
        <div>
          <p className="text-4xl font-bold text-white">
            {listenerCount === null ? '—' : listenerCount}
          </p>
          <p className="text-sm text-gray-500 mt-1">Live Listeners</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-green-400">Live</span>
        </div>
      </div>

      {/* Currently Listening */}
      <div className="border border-[rgba(232,101,10,0.15)] rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Currently Listening</p>
          <span className="text-xs text-green-400 font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block animate-pulse" />
            {listeners.length} active
          </span>
        </div>
        {listeners.length === 0 ? (
          <p className="text-xs text-gray-600 text-center py-2">No one active right now</p>
        ) : (
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {listeners.map(l => (
              <div key={l.userId} className="flex items-center justify-between text-xs">
                <span className="text-gray-300">{l.nickname || 'Listener'}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Banned users */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <Ban className="w-4 h-4 text-red-500" />
          <h3 className="font-semibold text-gray-300">Banned Users</h3>
          {bannedUsers.length > 0 && (
            <Badge variant="outline" className="border-red-800 text-red-500 text-xs">
              {bannedUsers.length}
            </Badge>
          )}
        </div>

        {bannedUsers.length === 0 ? (
          <p className="text-sm text-gray-600 text-center py-8">No banned users</p>
        ) : (
          <ScrollArea className="flex-1">
            <div className="space-y-2">
              {bannedUsers.map(u => (
                <div
                  key={u.userId}
                  className="flex items-center justify-between bg-[#0D1525] border border-red-900/30 rounded-lg px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{u.nickname || 'Unknown'}</p>
                    <p className="text-xs text-gray-600">{u.userId.slice(0, 12)}…</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-600">
                      {new Date(u.bannedAt).toLocaleDateString()}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-gray-700 text-gray-400 hover:text-white hover:border-gray-500"
                      onClick={() => unbanUser(u.userId)}
                    >
                      <Trash2 className="w-3 h-3 mr-1" /> Unban
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}