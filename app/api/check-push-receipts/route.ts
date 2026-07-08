import { NextResponse } from 'next/server';

function initAdmin() {
  const { getApps, initializeApp, cert } = require('firebase-admin/app');
  if (getApps().length) return;
  const serviceAccount = JSON.parse(
    Buffer.from(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT!, 'base64').toString('utf8')
  );
  initializeApp({ credential: cert(serviceAccount) });
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  initAdmin();
  const { getFirestore } = require('firebase-admin/firestore');
  const adminDb = getFirestore();

  // Only check tickets created >15s ago (Expo needs time to process) and not yet checked
  const cutoff = Date.now() - 15_000;
  const pending = await adminDb
    .collection('pushTickets')
    .where('checked', '==', false)
    .where('createdAt', '<=', cutoff)
    .limit(500)
    .get();

  if (pending.empty) return NextResponse.json({ checked: 0, deadTokens: 0 });

  const ticketIds = pending.docs.map((d: any) => d.id);
  const receiptRes = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ ids: ticketIds }),
  });
  const receiptData = await receiptRes.json();
  const receipts = receiptData.data || {};

  const batch = adminDb.batch();
  let deadTokenCount = 0;

  pending.docs.forEach((d: any) => {
    const receipt = receipts[d.id];
    const token = d.data().token;
    batch.update(d.ref, { checked: true, receiptStatus: receipt?.status || 'unknown' });

    if (receipt?.status === 'error' && receipt.details?.error === 'DeviceNotRegistered') {
      deadTokenCount++;
      batch.delete(adminDb.collection('pushTokens').doc(token));
    }
  });

  await batch.commit();
  return NextResponse.json({ checked: pending.size, deadTokens: deadTokenCount });
}