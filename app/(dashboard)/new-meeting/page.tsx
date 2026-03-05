import { NewMeetingForm } from '@/components/meetings/NewMeetingForm';

export const metadata = { title: 'Start Notetaker — LinguaMeet' };

export default function NewMeetingPage() {
  return (
    <div className="px-8 py-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Start Notetaker</h1>
        <p className="text-gray-500 mt-1">
          Paste a meeting link and upload the audio to get a multilingual transcript
        </p>
      </div>
      <NewMeetingForm />
    </div>
  );
}
