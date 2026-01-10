'use client';

import { useEffect, useState } from 'react';

type Channel = {
  id: string;
  title: string;
};

type FileItem = {
  id: number;
  name: string;
  size: number;
  messageId: number;
};

export function TelegramPanel() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState('idle');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [files, setFiles] = useState<FileItem[]>([]);

  const loadChannels = async () => {
    const response = await fetch('/api/telegram/channels');
    if (!response.ok) return;
    const data = await response.json();
    setChannels(data.channels ?? []);
  };

  const loadFiles = async (channelId: string) => {
    const response = await fetch(`/api/telegram/files?channelId=${channelId}`);
    if (!response.ok) return;
    const data = await response.json();
    setFiles(data.files ?? []);
  };

  useEffect(() => {
    loadChannels();
  }, []);

  useEffect(() => {
    if (selectedChannel) {
      loadFiles(selectedChannel);
    }
  }, [selectedChannel]);

  const sendCode = async () => {
    setStatus('sending');
    const response = await fetch('/api/telegram/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: phone }),
    });
    setStatus(response.ok ? 'code-sent' : 'idle');
  };

  const verifyCode = async () => {
    setStatus('verifying');
    const response = await fetch('/api/telegram/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: phone, code }),
    });
    if (response.ok) {
      setStatus('connected');
      await loadChannels();
    } else {
      setStatus('idle');
    }
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/30 p-6">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-semibold">Descargas desde Telegram</h2>
          <p className="text-sm text-slate-400">
            Conecta tu cuenta, selecciona un canal y descarga los archivos disponibles.
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Conexión a Telegram
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-[1fr,1fr,auto]">
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+34 600 000 000"
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm"
            />
            <input
              type="text"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Código"
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={sendCode}
                className="rounded-full border border-slate-700 px-4 py-2 text-xs"
              >
                Enviar código
              </button>
              <button
                type="button"
                onClick={verifyCode}
                className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-900"
              >
                Verificar
              </button>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Estado: {status === 'connected' ? 'Conectado' : 'Pendiente'}
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr,2fr]">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Canales</p>
            <ul className="mt-3 space-y-2 text-sm">
              {channels.length === 0 && (
                <li className="text-slate-500">Conecta Telegram para ver canales.</li>
              )}
              {channels.map((channel) => (
                <li key={channel.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedChannel(channel.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                      selectedChannel === channel.id
                        ? 'border-white bg-slate-800 text-white'
                        : 'border-slate-800 text-slate-300'
                    }`}
                  >
                    {channel.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Archivos disponibles
            </p>
            <div className="mt-3 space-y-3">
              {files.length === 0 && (
                <p className="text-sm text-slate-500">
                  Selecciona un canal para mostrar los archivos.
                </p>
              )}
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex flex-col justify-between gap-2 rounded-lg border border-slate-800 p-3 md:flex-row md:items-center"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">{file.name}</p>
                    <p className="text-xs text-slate-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <a
                    href={`/api/telegram/download?channelId=${selectedChannel}&messageId=${file.messageId}`}
                    className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-900"
                  >
                    Descargar
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
