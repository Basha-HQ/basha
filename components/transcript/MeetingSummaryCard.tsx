import { Card, CardBody, CardHeader } from '@/components/ui/Card';

interface Summary {
  topics: string[];
  decisions: string[];
  notes: string[];
}

export function MeetingSummaryCard({ summary }: { summary: Summary }) {
  const sections = [
    { label: 'Topics discussed', items: summary.topics, icon: '💬' },
    { label: 'Key decisions', items: summary.decisions, icon: '✅' },
    { label: 'Action items', items: summary.notes, icon: '📌' },
  ].filter((s) => s.items?.length > 0);

  if (sections.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold text-gray-900">Meeting Summary</h2>
      </CardHeader>
      <CardBody>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {sections.map((section) => (
            <div key={section.label}>
              <p className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-1.5">
                {section.icon} {section.label}
              </p>
              <ul className="space-y-2">
                {section.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-gray-300 mt-0.5">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
