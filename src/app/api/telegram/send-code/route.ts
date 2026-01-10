import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { sendLoginCode } from '@/lib/telegram';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const phoneNumber = body.phoneNumber as string | undefined;
  if (!phoneNumber) {
    return NextResponse.json({ error: 'Phone number required' }, { status: 400 });
  }

  await sendLoginCode(session.user.id, phoneNumber);
  return NextResponse.json({ status: 'sent' });
}
