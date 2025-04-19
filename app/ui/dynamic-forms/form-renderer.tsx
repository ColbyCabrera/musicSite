'use client';

import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../shadcn/components/ui/select';
import { Input } from '../shadcn/components/ui/input';
import { Label } from '../shadcn/components/ui/label';
import { submitFormResponse } from '@/app/lib/actions';
import { FormWithFields } from '@/app/lib/definitions';
import { Textarea } from '../shadcn/components/ui/textarea';
import { Checkbox } from '../shadcn/components/ui/checkbox';
import SubmitButtonWithLoader from '../submit-button-with-loader';

export default function FormRenderer({
  form,
  jobId,
  existingResponses,
  showFormName,
}: {
  form: FormWithFields;
  jobId: number | null;
  existingResponses?: Record<number, any>;
  showFormName?: Boolean;
}) {
  const initial: Record<number, any> = {};
  form.fields.forEach((field) => {
    field.type === 'CHECKBOX'
      ? (initial[field.id] = !!field.defaultValue ?? false)
      : (initial[field.id] =
          existingResponses?.[field.id] ?? field.defaultValue ?? '');
  });
  const [responses, setResponses] = useState<Record<number, any>>(initial);
  const [loading, setLoading] = useState(false);

  const handleChange = (fieldId: number, value: any) => {
    setResponses((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (jobId !== null) {
        await submitFormResponse(form.id, jobId, responses);
        setResponses(initial);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!form) {
    return <div>Loading form...</div>;
  }

  return (
    <form onSubmit={handleSubmit}>
      {showFormName && (
        <h2 className="mb-3 text-xl font-semibold">{form.name}</h2>
      )}

      <div className="mb-4 space-y-3">
        {form.fields.map((field) => {
          switch (field.type) {
            case 'TEXT':
              return (
                <div key={field.id}>
                  <Label htmlFor={`field${field.id}`}>{field.label}</Label>
                  <Input
                    id={`field${field.id}`}
                    className="mt-1"
                    value={responses[field.id] ?? field.defaultValue ?? ''}
                    onChange={(e) => handleChange(field.id, e.target.value)}
                  />
                </div>
              );
            case 'NUMERIC':
              return (
                <div key={field.id}>
                  <Label htmlFor={`field${field.id}`}>{field.label}</Label>
                  <Input
                    id={`field${field.id}`}
                    type="number"
                    className="mt-1"
                    value={responses[field.id] ?? ''}
                    onChange={(e) => handleChange(field.id, e.target.value)}
                  />
                </div>
              );
            case 'TEXTAREA':
              return (
                <div key={field.id}>
                  <Label htmlFor={`field${field.id}`}>{field.label}</Label>
                  <Textarea
                    id={`field${field.id}`}
                    className="mt-1 field-sizing-content"
                    value={responses[field.id] ?? ''}
                    onChange={(e) => handleChange(field.id, e.target.value)}
                  />
                </div>
              );
            case 'CHECKBOX':
              return (
                <div key={field.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`field${field.id}`}
                    checked={responses[field.id] === true}
                    onCheckedChange={(checked) =>
                      handleChange(field.id, checked)
                    }
                  />
                  <Label htmlFor={`field${field.id}`}>{field.label}</Label>
                </div>
              );
            case 'DROPDOWN':
              const options = field.options || [];
              return (
                <div key={field.id}>
                  <Label htmlFor={`field${field.id}`}>{field.label}</Label>
                  <Select
                    value={responses[field.id] ?? ''}
                    onValueChange={(value) => handleChange(field.id, value)}
                  >
                    <SelectTrigger
                      className="mt-1 text-left"
                      id={`field${field.id}`}
                    >
                      <SelectValue placeholder="Select an option" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((o, i) => (
                        <SelectItem
                          key={i}
                          value={o.trim()}
                          className="max-w-80 min-w-full text-pretty"
                        >
                          {o.trim()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            case 'SECTION-HEADER':
              return (
                <div key={field.id}>
                  <h3 className="mt-2 text-lg font-medium">{field.label}</h3>
                </div>
              );
            default:
              return null;
          }
        })}
      </div>
      {jobId && (
        <SubmitButtonWithLoader loading={loading}>
          Submit
        </SubmitButtonWithLoader>
      )}
    </form>
  );
}
