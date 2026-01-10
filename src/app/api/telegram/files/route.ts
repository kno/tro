import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { listChannelFiles } from '@/lib/telegram';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get('channelId');
  if (!channelId) {
    return NextResponse.json({ error: 'Channel required' }, { status: 400 });
  }

  const files = await listChannelFiles(session.user.id, channelId);
  return NextResponse.json({ files });
}
