import { NextResponse } from 'next/server';

function initAdmin() {
  const { getApps, initializeApp, cert } = require('firebase-admin/app');
  if (getApps().length) return;
  const serviceAccount = JSON.parse(
    Buffer.from(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT!, 'base64').toString('utf8')
  );
  initializeApp({ credential: cert(serviceAccount) });
}

export async function POST(req: Request) {
  const { messages, title, body, targetWebTokens } = await req.json();
  initAdmin();
  const { getFirestore } = require('firebase-admin/firestore');
  const { getMessaging } = require('firebase-admin/messaging');
  const adminDb        = getFirestore();
  const adminMessaging = getMessaging();

  // ── 1. Mobile push via Expo ─────────────────────────────────────────────
  let expoData: any = { data: [] };
  const tickets: Array<{ status: string; id?: string; message?: string; details?: any }> = [];

  if (messages && messages.length > 0) {
    const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body:    JSON.stringify(messages),
    });
    expoData = await expoRes.json();
    const rawTickets = Array.isArray(expoData.data) ? expoData.data : [expoData.data].filter(Boolean);
    tickets.push(...rawTickets);
  }

  let immediateFailCount = 0;
  const receiptRecords: Array<{ ticketId: string; token: string }> = [];

  await Promise.all(tickets.map(async (ticket, i) => {
    const token = messages[i]?.to;
    if (!token) return;

    if (ticket.status === 'error') {
      immediateFailCount++;
      if (ticket.details?.error === 'DeviceNotRegistered') {
        await adminDb.collection('pushTokens').doc(token).delete().catch(() => {});
      }
      return;
    }

    if (ticket.status === 'ok' && ticket.id) {
      receiptRecords.push({ ticketId: ticket.id, token });
    }
  }));

  if (receiptRecords.length > 0) {
    const batch = adminDb.batch();
    receiptRecords.forEach(({ ticketId, token }) => {
      batch.set(adminDb.collection('pushTickets').doc(ticketId), {
        token,
        createdAt: Date.now(),
        checked: false,
      });
    });
    await batch.commit();
  }

  // ── 2. Web push via FCM ─────────────────────────────────────────────────
  let webSuccessCount = 0;
  let webFailCount = 0;
  try {
    let tokenDocs: any[];

    if (targetWebTokens && targetWebTokens.length > 0) {
      tokenDocs = targetWebTokens.map((t: string) => ({
        data: () => ({ token: t }),
        ref: null,
      }));
    } else {
      const snap = await adminDb.collection('webPushTokens').get();
      tokenDocs = snap.docs.filter((d: any) => !!d.data().token);
    }

    for (let i = 0; i < tokenDocs.length; i += 500) {
      const chunk = tokenDocs.slice(i, i + 500);
      const result = await adminMessaging.sendEachForMulticast({
        tokens: chunk.map((d: any) => d.data().token as string),
        data: {
          title,
          body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          link: 'https://hammerradio.live',
        },
        webpush: {
          fcmOptions: { link: 'https://hammerradio.live' },
        },
      });

      webSuccessCount += result.successCount;
      webFailCount += result.failureCount;

      if (!targetWebTokens) {
        const staleDocs = chunk.filter((_: any, idx: number) => !result.responses[idx]?.success);
        if (staleDocs.length > 0) {
          const batch = adminDb.batch();
          staleDocs.forEach((d: any) => batch.delete(d.ref));
          await batch.commit();
        }
      }
    }
  } catch (e) {
    console.warn('[WebPush] FCM error:', e);
  }

  // ── 3. Save to Firestore notifications — skip for targeted test sends ──
  if (!targetWebTokens) {
    await fetch(
      `https://firestore.googleapis.com/v1/projects/hammer-radio-395cb/databases/(default)/documents/notifications`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            title: { stringValue: title },
            body:  { stringValue: body },
            ts:    { integerValue: Date.now().toString() },
            type:  { stringValue: 'notification' },
          },
        }),
      }
    );
  }

  return NextResponse.json({
    ...expoData,
    _meta: {
      mobileImmediateFails: immediateFailCount,
      mobilePendingReceiptChecks: receiptRecords.length,
      webSuccessCount,
      webFailCount,
    },
  });
}