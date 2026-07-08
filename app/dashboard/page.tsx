'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ChatPanel                        from '@/components/chat-panel';
import { ListenersPanel }               from '@/components/listeners-panel';
import { NotificationsPanel }           from '@/components/notifications-panel';
import { RequestsPanel }                from '@/components/requests-panel';
import { CallsPanel }                   from '@/components/calls-panel';
import { NewsPanel }                    from '@/components/news-panel';

const TABS = [
  { value: 'chat',          label: 'Chat'          },
  { value: 'listeners',     label: 'Listeners'     },
  { value: 'notifications', label: 'Notifications' },
  { value: 'requests',      label: 'Requests'      },
  { value: 'callin',        label: 'Call-In'       },
  { value: 'news',          label: 'News'          },
];

export default function DashboardPage() {
  const router  = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) router.replace('/login');
      else setReady(true);
    });
    return unsub;
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <span className="text-gray-500 text-sm animate-pulse">Loading…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <Tabs defaultValue="chat" className="flex-1 flex flex-col min-h-0">

        {/* ── Sticky top bar: header + tab strip ────────────────── */}
        <div className="sticky top-0 z-50 bg-gray-950 border-b border-white/10 flex-shrink-0">

          <header className="px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center font-bold text-sm">
                H
              </div>
              <div>
                <p className="text-sm font-bold leading-tight">Hammer Radio</p>
                <p className="text-xs text-gray-500 leading-tight">Admin Dashboard</p>
              </div>
            </div>
            <button
              onClick={() => signOut(auth).then(() => router.replace('/login'))}
              className="text-xs text-gray-500 hover:text-white transition-colors"
            >
              Sign out
            </button>
          </header>

          <div className="px-4 pb-3">
            <TabsList className="bg-gray-900 border border-white/10 w-fit flex-shrink-0">
              {TABS.map(tab => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="text-gray-400 data-[state=active]:bg-orange-600 data-[state=active]:text-white text-xs px-4"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

        </div>

        {/* ── Tab content ────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-h-0 p-4">

          {/* Chat */}
          <TabsContent value="chat" className="flex-1 min-h-0 mt-0">
            <div className="bg-gray-900 border border-white/10 rounded-xl h-full overflow-hidden flex flex-col">
              <ChatPanel />
            </div>
          </TabsContent>

          {/* Listeners */}
          <TabsContent value="listeners" className="mt-0">
            <div className="bg-gray-900 border border-white/10 rounded-xl overflow-hidden">
              <ListenersPanel />
            </div>
          </TabsContent>

          {/* Notifications */}
          <TabsContent value="notifications" className="mt-0">
            <div className="bg-gray-900 border border-white/10 rounded-xl overflow-hidden">
              <NotificationsPanel />
            </div>
          </TabsContent>

          {/* Requests */}
          <TabsContent value="requests" className="mt-0">
            <div className="bg-gray-900 border border-white/10 rounded-xl overflow-hidden">
              <RequestsPanel />
            </div>
          </TabsContent>

          {/* Call-In */}
          <TabsContent value="callin" className="mt-0">
            <div className="bg-gray-900 border border-white/10 rounded-xl overflow-hidden">
              <CallsPanel />
            </div>
          </TabsContent>

          {/* News */}
          <TabsContent value="news" className="mt-0">
            <div className="bg-gray-900 border border-white/10 rounded-xl overflow-hidden">
              <NewsPanel />
            </div>
          </TabsContent>

        </div>
      </Tabs>
    </div>
  );
}