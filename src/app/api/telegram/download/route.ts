import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { downloadMessageFile } from '@/lib/telegram';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get('channelId');
  const messageId = searchParams.get('messageId');
  if (!channelId || !messageId) {
    return NextResponse.json({ error: 'Channel and message required' }, { status: 400 });
  }

  const { buffer, fileName } = await downloadMessageFile(
    session.user.id,
    channelId,
    Number(messageId),
  );

  return new NextResponse(buffer as Buffer, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  });
}
