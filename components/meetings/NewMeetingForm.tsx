'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';

type Step = 'form' | 'uploading' | 'processing';

export function NewMeetingForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('form');
  const [meetingLink, setMeetingLink] = useState('');
  const [title, setTitle] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!audioFile) {
      setError('Please upload an audio file to process');
      return;
    }

    setStep('uploading');

    try {
      // Step 1: Create meeting record
      setProgress('Creating meeting...');
      const createRes = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingLink: meetingLink || 'manual-upload',
          title: title || 'Untitled Meeting',
        }),
      });

      if (!createRes.ok) throw new Error('Failed to create meeting');
      const { meeting } = await createRes.json();

      // Step 2: Upload audio
      setProgress('Uploading audio...');
      const formData = new FormData();
      formData.append('audio', audioFile);

      const uploadRes = await fetch(`/api/meetings/${meeting.id}/audio`, {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error ?? 'Audio upload failed');
      }

      // Step 3: Trigger AI processing
      setStep('processing');
      setProgress('Transcribing and translating... This may take a few minutes.');

      const processRes = await fetch(`/api/meetings/${meeting.id}/process`, {
        method: 'POST',
      });

      if (!processRes.ok) {
        const err = await processRes.json();
        throw new Error(err.error ?? 'Processing failed');
      }

      // Redirect to meeting details
      router.push(`/meetings/${meeting.id}`);
    } catch (err) {
      setError(String(err));
      setStep('form');
    }
  }

  if (step === 'processing') {
    return (
      <Card>
        <CardBody className="py-12 text-center">
          <div className="text-4xl mb-4 animate-pulse">🧠</div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Processing your meeting</h2>
          <p className="text-gray-500 text-sm">{progress}</p>
          <div className="mt-6 flex justify-center">
            <div className="w-48 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full animate-pulse w-3/4" />
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }

  if (step === 'uploading') {
    return (
      <Card>
        <CardBody className="py-12 text-center">
          <div className="text-4xl mb-4 animate-bounce">⬆️</div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Uploading audio</h2>
          <p className="text-gray-500 text-sm">{progress}</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-gray-900">Meeting details</h2>
        </CardHeader>
        <CardBody className="space-y-5">
          <Input
            label="Meeting title"
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Q2 Planning - Marketing Team"
          />

          <Input
            label="Meeting link (optional)"
            id="meetingLink"
            type="url"
            value={meetingLink}
            onChange={(e) => setMeetingLink(e.target.value)}
            placeholder="https://meet.google.com/abc-defg-hij"
          />

          {/* Audio upload */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              Audio file <span className="text-red-500">*</span>
            </label>
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                audioFile ? 'border-indigo-300 bg-indigo-50' : 'border-gray-300 hover:border-indigo-300'
              }`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f) setAudioFile(f);
              }}
            >
              {audioFile ? (
                <div>
                  <p className="text-2xl mb-2">🎵</p>
                  <p className="font-medium text-gray-900">{audioFile.name}</p>
                  <p className="text-sm text-gray-400 mt-1">
                    {(audioFile.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                  <button
                    type="button"
                    onClick={() => setAudioFile(null)}
                    className="text-sm text-red-500 mt-2 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-3xl mb-3">🎙️</p>
                  <p className="font-medium text-gray-700 mb-1">Drag & drop audio here</p>
                  <p className="text-sm text-gray-400 mb-4">WAV, MP3, OGG, WebM · Max 200MB</p>
                  <label className="cursor-pointer inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                    Browse file
                    <input
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>
              )}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="pt-2">
            <Button type="submit" size="lg" className="w-full">
              Process Meeting
            </Button>
            <p className="text-center text-xs text-gray-400 mt-3">
              Audio will be transcribed and translated using Sarvam AI
            </p>
          </div>
        </CardBody>
      </Card>
    </form>
  );
}
