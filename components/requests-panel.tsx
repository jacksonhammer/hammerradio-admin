'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import {
  collection, query, orderBy, onSnapshot, updateDoc, doc,
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, XCircle, Clock, Music } from 'lucide-react';
import type { SongRequest } from '@/lib/types';

export function RequestsPanel() {
  const [requests, setRequests] = useState<SongRequest[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<SongRequest, 'id'>) })));
    });
    return unsub;
  }, []);

  async function updateStatus(id: string, status: 'played' | 'skipped') {
    await updateDoc(doc(db, 'requests', id), { status });
  }

  const pending = requests.filter(r => r.status === 'pending');
  const history = requests.filter(r => r.status !== 'pending');

  function RequestCard({ req }: { req: SongRequest }) {
    return (
      <div className="bg-[#0D1525] border border-[rgba(232,101,10,0.1)] rounded-lg p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-white text-sm truncate">{req.song}</p>
            {req.artist && <p className="text-xs text-gray-400">{req.artist}</p>}
            {req.message && <p className="text-xs text-gray-500 mt-1 italic">"{req.message}"</p>}
          </div>
          <Badge
            variant="outline"
            className={`shrink-0 text-[10px] ${
              req.status === 'pending' ? 'border-yellow-700 text-yellow-500' :
              req.status === 'played' ? 'border-green-700 text-green-500' :
              'border-gray-700 text-gray-500'
            }`}
          >
            {req.status === 'pending' && <Clock className="w-2.5 h-2.5 mr-1" />}
            {req.status === 'played' && <CheckCircle2 className="w-2.5 h-2.5 mr-1" />}
            {req.status === 'skipped' && <XCircle className="w-2.5 h-2.5 mr-1" />}
            {req.status}
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-600">
          {req.nickname || req.requestedBy || req.uid || req.userId || 'Unknown'} · {req.createdAt ? new Date(req.createdAt.toMillis?.() ?? req.createdAt).toLocaleTimeString() : ''}
          </span>
          {req.status === 'pending' && (
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-green-700 text-green-500 hover:bg-green-950/40"
                onClick={() => updateStatus(req.id, 'played')}
              >
                <CheckCircle2 className="w-3 h-3 mr-1" /> Played
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-gray-700 text-gray-500 hover:bg-gray-900/40"
                onClick={() => updateStatus(req.id, 'skipped')}
              >
                <XCircle className="w-3 h-3 mr-1" /> Skip
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <Music className="w-5 h-5 text-[#E8650A]" />
        <h2 className="text-lg font-semibold">Song Requests</h2>
        {pending.length > 0 && (
          <Badge className="bg-[#E8650A] text-white text-xs">{pending.length} pending</Badge>
        )}
      </div>

      <Tabs defaultValue="pending" className="flex-1 flex flex-col">
        <TabsList className="bg-[#0D1525] border border-[rgba(232,101,10,0.2)] mb-4 w-fit">
          <TabsTrigger value="pending" className="data-[state=active]:bg-[#E8650A] data-[state=active]:text-white text-xs">
            Pending ({pending.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-[#E8650A] data-[state=active]:text-white text-xs">
            History ({history.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="flex-1 m-0">
          {pending.length === 0
            ? <p className="text-sm text-gray-600 text-center py-8">No pending requests</p>
            : (
              <ScrollArea className="h-full">
                <div className="space-y-2">
                  {pending.map(r => <RequestCard key={r.id} req={r} />)}
                </div>
              </ScrollArea>
            )}
        </TabsContent>

        <TabsContent value="history" className="flex-1 m-0">
          {history.length === 0
            ? <p className="text-sm text-gray-600 text-center py-8">No history yet</p>
            : (
              <ScrollArea className="h-full">
                <div className="space-y-2">
                  {history.map(r => <RequestCard key={r.id} req={r} />)}
                </div>
              </ScrollArea>
            )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
