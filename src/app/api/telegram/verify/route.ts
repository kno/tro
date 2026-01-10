import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { verifyLoginCode } from '@/lib/telegram';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const code = body.code as string | undefined;
  if (!code) {
    return NextResponse.json({ error: 'Code required' }, { status: 400 });
  }

  await verifyLoginCode(session.user.id, code);
  return NextResponse.json({ status: 'verified' });
}
