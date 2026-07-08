import { NextResponse } from 'next/server';

const DAILY_API_KEY = 'e2151fb1cf021a6eefe550ca21439cd106f9ad3027cc82c57fea03ba3f0a25de';
const ROOM_NAME = 'hammer-radio-call-in';
const ROOM_URL = 'https://hammerradio.daily.co/hammer-radio-call-in';

export async function GET() {
  try {
    const res = await fetch('https://api.daily.co/v1/meeting-tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        properties: {
          room_name: ROOM_NAME,
          user_name: 'Jackson Hammer',
          is_owner: true,
          start_audio_off: false,
          start_video_off: true,
          exp: Math.floor(Date.now() / 1000) + 14400,
        },
      }),
    });
    if (!res.ok) throw new Error(`Daily API ${res.status}`);
    const data = await res.json();
    return NextResponse.json({ url: `${ROOM_URL}?t=${data.token}` });
  } catch (e) {
    return NextResponse.json({ url: ROOM_URL });
  }
}
