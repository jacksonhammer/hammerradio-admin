export async function GET() {
  try {
    const res = await fetch(
      'https://www.radiomast.io/stream/64e8b7e1-bd1e-405d-9670-5ebca9564559/icecast/status-json.xsl',
      { cache: 'no-store' }
    );
    const data = await res.json();
    const source = data?.icestats?.source;
    const src = Array.isArray(source) ? source[0] : source;
    const listeners = src?.listeners ?? 0;
    return Response.json({ listeners });
  } catch {
    return Response.json({ listeners: null });
  }
}