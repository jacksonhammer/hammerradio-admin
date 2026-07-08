'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import {
  collection, addDoc, getDocs, query, orderBy, limit, onSnapshot,
  writeBatch, doc,
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, Send, Loader2, CheckCircle2, XCircle, Users, Trash2, Clock, FlaskConical } from 'lucide-react';

interface PushToken {
  token: string;
  userId: string;
  nickname?: string;
  platform?: string;
  updatedAt?: number;
}

interface WebPushToken {
  token: string;
  uid: string;
  nickname?: string;
  platform: 'web';
  updatedAt?: number;
}

interface NotificationLog {
  id: string;
  title: string;
  body: string;
  url?: string;
  sentAt: number;
  successCount: number;
  failCount: number;
  totalTargets?: number;
  mobileImmediateFails?: number;
  mobilePendingReceiptChecks?: number;
  webSuccessCount?: number;
  webFailCount?: number;
}

export function NotificationsPanel() {
  const [title,        setTitle]        = useState('');
  const [body,         setBody]         = useState('');
  const [url,          setUrl]          = useState('');
  const [sending,      setSending]      = useState(false);
  const [clearing,     setClearing]     = useState(false);
  const [result,       setResult]       = useState<{ ok: boolean; msg: string; detail?: string } | null>(null);
  const [tokens,       setTokens]       = useState<PushToken[]>([]);
  const [webTokens,    setWebTokens]    = useState<WebPushToken[]>([]);
  const [logs,         setLogs]         = useState<NotificationLog[]>([]);
  const [testNickname, setTestNickname] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'pushTokens'));
    const unsub = onSnapshot(q, snap => {
      setTokens(snap.docs.map(d => ({ ...(d.data() as Omit<PushToken, 'token'>), token: d.id })));
    });
    return unsub;
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'webPushTokens'));
    const unsub = onSnapshot(q, snap => {
      setWebTokens(snap.docs.map(d => ({ ...(d.data() as Omit<WebPushToken, 'token'>), token: d.id })));
    });
    return unsub;
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'notificationLog'), orderBy('sentAt', 'desc'), limit(20));
    const unsub = onSnapshot(q, snap => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<NotificationLog, 'id'>) })));
    });
    return unsub;
  }, []);

  const allDevices = [
    ...tokens.map(t => ({ token: t.token, nickname: t.nickname, userId: t.userId, platform: t.platform || 'app' })),
    ...webTokens.map(t => ({ token: t.token, nickname: t.nickname, userId: t.uid, platform: 'web' })),
  ];

  async function handleSend() {
    if (!title.trim() || !body.trim()) return;
    if (allDevices.length === 0) {
      setResult({ ok: false, msg: 'No registered devices found.' });
      return;
    }

    setSending(true);
    setResult(null);

    try {
      const messages = tokens
        .filter(t => t.token && t.token.startsWith('ExponentPushToken'))
        .map(t => ({
          to: t.token,
          title: title.trim(),
          body: body.trim(),
          ...(url.trim() ? { data: { url: url.trim() } } : {}),
          sound: 'default',
          channelId: 'default',
        }));

      const res = await fetch('/api/send-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify({ messages, title: title.trim(), body: body.trim() }),
      });

      const data = await res.json();
      const results: Array<{ status: string; message?: string }> = Array.isArray(data.data)
        ? data.data
        : [data];

      const successCount = results.filter((r) => r.status === 'ok').length;
      const failCount    = results.filter((r) => r.status !== 'ok').length;
      const meta = data._meta || {};

      await addDoc(collection(db, 'notificationLog'), {
        title: title.trim(),
        body: body.trim(),
        url: url.trim() || null,
        sentAt: Date.now(),
        successCount,
        failCount,
        totalTargets: messages.length,
        mobileImmediateFails: meta.mobileImmediateFails ?? 0,
        mobilePendingReceiptChecks: meta.mobilePendingReceiptChecks ?? 0,
        webSuccessCount: meta.webSuccessCount ?? 0,
        webFailCount: meta.webFailCount ?? 0,
      });

      const detailParts: string[] = [];
      if (meta.mobilePendingReceiptChecks > 0) {
        detailParts.push(`${meta.mobilePendingReceiptChecks} mobile deliveries confirming over the next ~10 min`);
      }
      if (meta.mobileImmediateFails > 0) {
        detailParts.push(`${meta.mobileImmediateFails} mobile token(s) rejected immediately (likely uninstalled — auto-removed)`);
      }
      if (typeof meta.webSuccessCount === 'number') {
        detailParts.push(`Web push: ${meta.webSuccessCount} delivered, ${meta.webFailCount} failed`);
      }

      setResult({
        ok: true,
        msg: `Sent to ${successCount} device${successCount !== 1 ? 's' : ''}${failCount > 0 ? ` (${failCount} rejected)` : ''}.`,
        detail: detailParts.length > 0 ? detailParts.join(' · ') : undefined,
      });
      setTitle('');
      setBody('');
      setUrl('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setResult({ ok: false, msg: `Send failed: ${msg}` });
    }

    setSending(false);
  }

  async function handleSendTest() {
    if (!title.trim() || !body.trim() || !testNickname.trim()) return;

    const myMobile = tokens.filter(
      t => t.nickname?.toLowerCase() === testNickname.trim().toLowerCase()
    );
    const myWeb = webTokens.filter(
      t => t.nickname?.toLowerCase() === testNickname.trim().toLowerCase()
    );

    if (myMobile.length === 0 && myWeb.length === 0) {
      setResult({ ok: false, msg: `No registered device found with nickname "${testNickname}".` });
      return;
    }

    setSending(true);
    setResult(null);

    try {
      const messages = myMobile
        .filter(t => t.token && t.token.startsWith('ExponentPushToken'))
        .map(t => ({
          to: t.token,
          title: title.trim(),
          body: body.trim(),
          sound: 'default',
          channelId: 'default',
        }));

      const res = await fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          title: title.trim(),
          body: body.trim(),
          targetWebTokens: myWeb.map(t => t.token),
        }),
      });
      await res.json();

      setResult({
        ok: true,
        msg: `Test sent to "${testNickname}" (${myMobile.length + myWeb.length} device${(myMobile.length + myWeb.length) !== 1 ? 's' : ''}).`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setResult({ ok: false, msg: `Test send failed: ${msg}` });
    }

    setSending(false);
  }

  async function handleClearAllNotifications() {
    if (!confirm('Delete ALL notifications? This removes them for every user on web and mobile and cannot be undone.')) return;
    setClearing(true);
    try {
      const snap = await getDocs(collection(db, 'notifications'));
      if (!snap.empty) {
        const allDocs = snap.docs;
        for (let i = 0; i < allDocs.length; i += 500) {
          const batch = writeBatch(db);
          allDocs.slice(i, i + 500).forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
      }
      setResult({ ok: true, msg: 'All notifications cleared for all users.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setResult({ ok: false, msg: `Clear failed: ${msg}` });
    }
    setClearing(false);
  }

  async function handleClearLogs() {
    if (!confirm('Clear all notification history? This cannot be undone.')) return;
    try {
      const batch = writeBatch(db);
      logs.forEach(log => batch.delete(doc(db, 'notificationLog', log.id)));
      await batch.commit();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[Notifications] clear logs error:', msg);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4">
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-[#E8650A]" />
          <h2 className="text-lg font-semibold">Send Push Notification</h2>
          <Badge variant="outline" className="ml-auto border-[rgba(232,101,10,0.4)] text-[#E8650A]">
            <Users className="w-3 h-3 mr-1" />
            {allDevices.length} device{allDevices.length !== 1 ? 's' : ''}
          </Badge>
        </div>

        <div className="space-y-2">
          <Label className="text-gray-300">Title *</Label>
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Hammer Radio"
            maxLength={100}
            className="bg-[#080D1A] border-[rgba(232,101,10,0.25)] text-white placeholder:text-gray-600 focus:border-[#E8650A]"
          />
          <p className="text-xs text-gray-600">{title.length}/100</p>
        </div>

        <div className="space-y-2">
          <Label className="text-gray-300">Message *</Label>
          <Textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Tune in now — something big is happening..."
            rows={4}
            maxLength={300}
            className="bg-[#080D1A] border-[rgba(232,101,10,0.25)] text-white placeholder:text-gray-600 focus:border-[#E8650A] resize-none"
          />
          <p className="text-xs text-gray-600">{body.length}/300</p>
        </div>

        <div className="space-y-2">
          <Label className="text-gray-300">Deep Link URL <span className="text-gray-500">(optional)</span></Label>
          <Input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="hammerradio://listen  or  https://hammerradio.live"
            className="bg-[#080D1A] border-[rgba(232,101,10,0.25)] text-white placeholder:text-gray-600 focus:border-[#E8650A]"
          />
        </div>

        {result && (
          <div className={`flex flex-col gap-1 p-3 rounded-lg text-sm ${result.ok ? 'bg-green-950/40 border border-green-800 text-green-400' : 'bg-red-950/40 border border-red-800 text-red-400'}`}>
            <div className="flex items-start gap-2">
              {result.ok
                ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                : <XCircle className="w-4 h-4 mt-0.5 shrink-0" />}
              {result.msg}
            </div>
            {result.detail && (
              <p className="text-xs text-gray-400 pl-6">{result.detail}</p>
            )}
          </div>
        )}

        <Button
          onClick={handleSend}
          disabled={sending || !title.trim() || !body.trim()}
          className="w-full bg-[#E8650A] hover:bg-[#E8650A]/90 text-white font-bold"
        >
          {sending
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending…</>
            : <><Send className="w-4 h-4 mr-2" /> Send to All Listeners</>}
        </Button>

        <div className="flex gap-2 items-center pt-2 border-t border-white/5">
          <Input
            value={testNickname}
            onChange={e => setTestNickname(e.target.value)}
            placeholder="Your nickname (test target)"
            className="bg-[#080D1A] border-[rgba(232,101,10,0.25)] text-white placeholder:text-gray-600 text-xs flex-1"
          />
          <Button
            onClick={handleSendTest}
            disabled={sending || !title.trim() || !body.trim() || !testNickname.trim()}
            size="sm"
            variant="outline"
            className="border-blue-700 text-blue-400 hover:bg-blue-950/40 whitespace-nowrap"
          >
            <FlaskConical className="w-3.5 h-3.5 mr-1.5" />
            Send Test Only
          </Button>
        </div>

        <Button
          onClick={handleClearAllNotifications}
          disabled={clearing}
          variant="outline"
          className="w-full border-red-800/50 text-red-400 hover:bg-red-950/40 hover:text-red-300 hover:border-red-700 font-semibold"
        >
          {clearing
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Clearing…</>
            : <><Trash2 className="w-4 h-4 mr-2" /> Delete All Notifications</>}
        </Button>

        {allDevices.length > 0 && (
          <div className="border border-[rgba(232,101,10,0.15)] rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Registered Devices</p>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {allDevices.map(t => (
                <div key={t.token} className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">{t.nickname || t.userId?.slice(0, 8) + '…' || 'Unknown'}</span>
                  <Badge variant="outline" className="text-[10px] border-gray-700 text-gray-500 capitalize">
                    {t.platform || 'app'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-300">Recent Notifications</h2>
          {logs.length > 0 && (
            <button
              onClick={handleClearLogs}
              className="text-xs text-red-400 hover:text-red-300 transition-colors font-medium"
            >
              Clear History
            </button>
          )}
        </div>
        {logs.length === 0 ? (
          <p className="text-sm text-gray-600 py-8 text-center">No notifications sent yet.</p>
        ) : (
          <ScrollArea className="h-[520px] pr-2">
            <div className="space-y-3">
              {logs.map(log => (
                <div key={log.id} className="bg-[#0D1525] border border-[rgba(232,101,10,0.15)] rounded-lg p-3 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-white text-sm">{log.title}</p>
                    <span className="text-[10px] text-gray-600 shrink-0">
                      {new Date(log.sentAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">{log.body}</p>
                  <div className="flex items-center gap-3 pt-1 flex-wrap">
                    <span className="text-xs text-green-500 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> {log.successCount} delivered
                    </span>
                    {log.failCount > 0 && (
                      <span className="text-xs text-red-500 flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> {log.failCount} rejected
                      </span>
                    )}
                    {!!log.mobilePendingReceiptChecks && (
                      <span className="text-xs text-yellow-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {log.mobilePendingReceiptChecks} confirming
                      </span>
                    )}
                  </div>
                  {(typeof log.webSuccessCount === 'number' || typeof log.webFailCount === 'number') && (
                    <p className="text-[10px] text-gray-600">
                      Web: {log.webSuccessCount ?? 0} delivered, {log.webFailCount ?? 0} failed
                    </p>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}