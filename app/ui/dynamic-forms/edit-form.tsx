'use client';

import {
  Field,
  FieldType,
  FormWithFields,
  Optional,
} from '@/app/lib/definitions';
import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../shadcn/components/ui/select';
import { deleteForm, editForm } from '@/app/lib/actions';
import { Label } from '../shadcn/components/ui/label';
import { Input } from '../shadcn/components/ui/input';
import { Button } from '../shadcn/components/ui/button';
import { Textarea } from '../shadcn/components/ui/textarea';
import { Checkbox } from '../shadcn/components/ui/checkbox';
import SubmitButtonWithLoader from '../submit-button-with-loader';
import DeleteButton from '../delete-button';

type FieldKey = 'label' | 'type' | 'defaultValue' | 'options';
type FieldConfig = Optional<Field, 'id'>;

const fieldTypes: FieldType[] = [
  'TEXT',
  'NUMERIC',
  'TEXTAREA',
  'CHECKBOX',
  'DROPDOWN',
  'SECTION-HEADER',
];

export default function EditForm({ form }: { form: FormWithFields }) {
  const [loading, setLoading] = useState(false);
  const [formName, setFormName] = useState(form.name);
  const [fields, setFields] = useState<FieldConfig[]>(form.fields);

  const addField = () => {
    setFields((prev) => [
      ...prev,
      { label: '', type: 'TEXT', defaultValue: '' },
    ]);
  };

  const handleFieldChange = (index: number, key: FieldKey, value: any) => {
    const newFields = [...fields];
    newFields[index][key] = value;
    setFields(newFields);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const saveForm = async () => {
    try {
      setLoading(true);
      const result = await editForm(form.id, formName, fields);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex-wrap items-stretch gap-6 md:flex">
        <div className="mb-6 min-w-52 flex-1 md:mb-0">
          <div className="mb-4 min-h-16 space-y-4">
            <Input
              placeholder="Form Name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />

            {fields.map((field, index) => (
              <div
                key={index}
                className="flex flex-col gap-4 rounded-lg border p-4"
              >
                <FieldLabelInput
                  index={index}
                  field={field}
                  handleFieldChange={handleFieldChange}
                />
                <FieldTypeSelect
                  index={index}
                  field={field}
                  handleFieldChange={handleFieldChange}
                />

                {field.type === 'DROPDOWN' && (
                  <DropdownOptionsInput
                    index={index}
                    field={field}
                    handleFieldChange={handleFieldChange}
                  />
                )}

                {field.type !== 'SECTION-HEADER' && (
                  <DefaultValueInput
                    index={index}
                    field={field}
                    handleFieldChange={handleFieldChange}
                  />
                )}

                <Button
                  variant="destructive"
                  onClick={() => removeField(index)}
                  className="w-fit"
                >
                  Remove field
                </Button>
              </div>
            ))}
          </div>
          <div>
            <Button variant={'outline'} onClick={addField} className="mb-4">
              Add field
            </Button>
            <div className="flex items-center justify-between">
              <SubmitButtonWithLoader onClick={saveForm} loading={loading}>
                Save form
              </SubmitButtonWithLoader>
              <DeleteButton
                entity={'form'}
                deleteFunction={() => deleteForm(form.id)}
              />
            </div>
          </div>
        </div>

        {/* Preview Section */}
        <div className="min-w-64 flex-1">
          <h2 className="mb-3 text-xl font-semibold">Preview</h2>
          <div className="space-y-3 rounded-lg border p-4">
            <h3 className="text-lg font-semibold">
              {formName || 'Form Name (unspecified)'}
            </h3>
            <div className="space-y-4">
              {fields.map((field, i) => (
                <PreviewField key={i} field={field} index={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const PreviewField = ({
  field,
  index,
}: {
  field: FieldConfig;
  index: number;
}) => {
  const typesWithLabels = ['TEXT', 'NUMERIC', 'TEXTAREA', 'DROPDOWN'];

  return (
    <div key={index} className="space-y-2">
      {typesWithLabels.includes(field.type) && (
        <Label htmlFor={`field${index}`} className="block">
          {field.label || 'Untitled Field'}
        </Label>
      )}
      {field.type === 'TEXT' && (
        <Input
          readOnly
          value={field.defaultValue || ''}
          placeholder={field.label}
          id={`field${index}`}
        />
      )}
      {field.type === 'NUMERIC' && (
        <Input
          readOnly
          type="number"
          value={field.defaultValue || ''}
          placeholder={field.label}
          id={`field${index}`}
        />
      )}
      {field.type === 'TEXTAREA' && (
        <Textarea
          readOnly
          value={field.defaultValue || ''}
          placeholder={field.label}
          id={`field${index}`}
        />
      )}
      {field.type === 'CHECKBOX' && (
        <div className="mt-4 flex items-center space-x-2">
          <Checkbox checked={field.defaultValue === 'true'} />
          <Label htmlFor={`field${index}`}>{field.label}</Label>
        </div>
      )}
      {field.type === 'DROPDOWN' && (
        <Select value={field.defaultValue || ''} name={`field${index}`}>
          <SelectTrigger>
            <SelectValue placeholder={field.label} />
          </SelectTrigger>
          <SelectContent>
            {field.options &&
              field.options.map((o, idx) => (
                <SelectItem
                  key={idx}
                  value={o.trim() == '' ? 'empty' : o.trim()}
                >
                  {o.trim()}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      )}
      {field.type === 'SECTION-HEADER' && (
        <h3 className="mt-2 text-lg font-medium">{field.label}</h3>
      )}
    </div>
  );
};

interface PreviewFieldProps {
  index: number;
  field: FieldConfig;
  handleFieldChange: (index: number, key: FieldKey, value: any) => void;
}

function FieldLabelInput({
  index,
  field,
  handleFieldChange,
}: PreviewFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={`fieldLabel${index}`} className="block">
        Field label
      </Label>
      <Input
        placeholder="Field Label"
        id={`fieldLabel${index}`}
        value={field.label}
        onChange={(e) => handleFieldChange(index, 'label', e.target.value)}
      />
    </div>
  );
}

function FieldTypeSelect({
  index,
  field,
  handleFieldChange,
}: PreviewFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={`fieldType${index}`} className="block">
        Field type
      </Label>
      <Select
        value={field.type}
        onValueChange={(type) =>
          handleFieldChange(index, 'type', type as FieldType)
        }
      >
        <SelectTrigger id={`fieldType${index}`}>
          <SelectValue placeholder="Select a field type" />
        </SelectTrigger>
        <SelectContent>
          {fieldTypes.map((t) => (
            <SelectItem key={t} value={t}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function DropdownOptionsInput({
  index,
  field,
  handleFieldChange,
}: PreviewFieldProps) {
  return (
    <Textarea
      className="field-sizing-content"
      placeholder="Options (comma-separated)"
      value={field.options ? field.options.join(',') : ''}
      onChange={(e) =>
        handleFieldChange(index, 'options', e.target.value.split(','))
      }
    />
  );
}

function DefaultValueInput({
  index,
  field,
  handleFieldChange,
}: PreviewFieldProps) {
  const isCheckbox = field.type === 'CHECKBOX';

  return (
    <div className="space-y-2">
      <Label htmlFor={`defaultValue${index}`} className="block">
        {isCheckbox ? 'Default checked' : 'Default value'}
      </Label>
      {isCheckbox ? (
        <Select
          value={field.defaultValue || 'false'}
          onValueChange={(checked) =>
            handleFieldChange(index, 'defaultValue', checked)
          }
        >
          <SelectTrigger id={`defaultValue${index}`}>
            <SelectValue placeholder="Default value" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={'true'}>True</SelectItem>
            <SelectItem value={'false'}>False</SelectItem>
          </SelectContent>
        </Select>
      ) : (
        <Input
          id={`defaultValue${index}`}
          placeholder="Default value"
          value={field.defaultValue || ''}
          onChange={(e) =>
            handleFieldChange(index, 'defaultValue', e.target.value)
          }
        />
      )}
    </div>
  );
}
