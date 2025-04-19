import { z } from 'zod';

export type UserRole = 'ADMIN' | 'USER' | 'CLIENT';

export type User = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  color: string;
};

export type TeamMember = {
  name: string;
};

export type Client = {
  id: number;
  company_name: string;
  management_company: string;
  contract_information: string | null;
  billing_instructions: string | null;
  maintenance_schedule: string | null;
  last_visit: string | null;
  next_visit: string | null;
  tags: string | null;
  account_manager: string;
  properties: [
    {
      id: number;
      client_id: number;
      zip: string;
      city: string;
      state: string;
      country: string;
      street_1: string;
      street_2: string | null;
      operating_hours: string;
    },
  ];
  contacts: [
    {
      id: number;
      client_id: number;
      name: string;
      phone_numbers: {
        id: number;
        contact_id: number;
        phone_number: string;
        is_main: boolean;
      }[];
      emails: {
        id: number;
        contact_id: number;
        email: string;
        is_main: boolean;
      }[];
      position: string | null;
    },
  ];
  activities: [ClientActivity];
};

export type ClientActivity = {
  id: number;
  client_id: number;
  activity: string;
  date: string;
};

export const clientStatuses = [
  'contracted',
  'notContracted',
  'pending',
  'notApplicable',
  'active',
  'pastDue',
  'creditCardOnly',
  'setStatus',
];

export type ClientStatus = {
  id: number;
  client_id: number;
  status: (typeof clientStatuses)[number];
  type: 'contract' | 'billing';
  note: string | null;
};

export type Bill = {
  id: number;
  client_id: number;
  amount: number;
  description: string;
  date: string;
};

export type Note = {
  id: number;
  entity_id: number | null;
  entity: string;
  visibility: 'public' | 'internal';
  author: string;
  text: string;
  date_created: string;
  files: string;
};

export type Email = {
  id: string;
  entity_id: number;
  entity: string;
  sender: string;
  recipient: string;
  subject: string;
  text: string;
  created_at: string;
};

export const quoteStatuses = [
  'complete',
  'incomplete',
  'in progress',
  'approved',
  'rejected',
  'waiting on MFG',
  'waiting on tech',
  'parts ordered',
  'back-ordered',
  'AM reviewing',
  'parts in',
  'stuck',
  'scheduled',
  'parts NLA',
  'sent',
  'changes requested',
];

export type Quote = {
  id: number;
  client_id: number;
  user_id: number | null;
  tax_id: number | null;
  manager: string | null;
  account_manager: string;
  client_name: string | null;
  company_name: string | null;
  status: (typeof quoteStatuses)[number];
  date_created: string;
  date_sent: string | null;
  total?: number; // Total in cents
  messages_count?: number;
  activity?: EntityActivity[];
};

export type LineItem = {
  id: number;
  quote_id: number;
  name: string;
  description: string;
  quantity: number;
  unit_price: number; // Price in cents
  is_taxable: boolean;
};

export type TemplateLineItem = {
  id: number;
  name: string;
  description: string;
  quantity: number;
  unit_price: number; // Price in cents
  is_taxable: boolean;
};

type LineItemField = {
  name: string;
  description: string;
  quantity: number;
  unit_price: string;
  is_taxable: boolean;
};

export type QuoteFormData = {
  lineItems: LineItemField[];
  taxId: number | null;
};

export type Tax = {
  id: number;
  name: string;
  tax_rate: number;
};

export type Invoice = {
  id: number;
  client_id: number;
  quote_id: number;
  title: string;
  payment_method: string;
  notes: string;
  status: string;
  is_pending: boolean;
  date_created: string;
  date_sent: string | null;
  total?: number; // Total in cents
  activity?: EntityActivity[];
};

export type Inventory = {
  elliptical: number;
  treadmill: number;
  strength: number;
  spinner: number;
  stepper: number;
  bench: number;
  rower: number;
  bike: number;
  miscellaneous: string;
};

export type Equipment = {
  id: number;
  client_id: number;
  install_date: string;
  type: string;
  make: string;
  model: string;
  serial: string;
  cns: string;
};

export type EntityActivity = {
  id: number;
  user_id: number;
  username?: string;
  entity_id: number;
  entity: string;
  activity: string;
  date: string;
};

export type Customer = {
  id: string;
  name: string;
  email: string;
  image_url: string;
};

export type Revenue = {
  month: string;
  revenue: number;
};

export type LatestInvoice = {
  id: string;
  name: string;
  image_url: string;
  email: string;
  amount: string;
};

export type LatestInvoiceRaw = Omit<LatestInvoice, 'amount'> & {
  amount: number;
};

export type InvoicesTable = {
  id: string;
  customer_id: string;
  name: string;
  email: string;
  image_url: string;
  date: string;
  amount: number;
  status: 'pending' | 'paid';
};

export type CustomersTableType = {
  id: string;
  name: string;
  email: string;
  image_url: string;
  total_invoices: number;
  total_pending: number;
  total_paid: number;
};

export type FormattedCustomersTable = {
  id: string;
  name: string;
  email: string;
  image_url: string;
  total_invoices: number;
  total_pending: string;
  total_paid: string;
};

export type CustomerField = {
  id: string;
  name: string;
};

export type InvoiceForm = {
  id: string;
  customer_id: string;
  amount: number;
  status: 'pending' | 'paid';
};

export type Event = {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
};

export type JobData = {
  id: number;
  job_id: number;
  quote_id: number | null;
  client_id: number;
  title: string;
  instructions: string;
  job_type: 'service' | 'install' | 'maintenance' | 'site visit';
  status: 'incomplete' | 'complete';
  jobForms: JobForm[];
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  all_day: boolean;
  color: string | null;
  names: (string | null)[];
  colors: (string | null)[];
  date_created: string | null;
  activity?: EntityActivity[];
};

export type CalendarEvent = {
  id: number;
  job_id: number | null;
  eventType: 'event' | 'job';
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
  event_id: string;
  user_id: string;
  names: string[];
  colors: string[];
  job_status?: 'incomplete' | 'complete';
};

export type JobForm = {
  id: number;
  name: string;
};

export type FieldType =
  | 'TEXT'
  | 'NUMERIC'
  | 'TEXTAREA'
  | 'CHECKBOX'
  | 'DROPDOWN'
  | 'SECTION-HEADER';

export type Field = {
  id: number;
  label: string;
  type: FieldType;
  defaultValue?: string;
  options?: string[];
};

export type FormWithFields = {
  id: number;
  name: string;
  fields: Field[];
};

export type LabeledResponseEntry = {
  fieldId: number;
  fieldType: FieldType;
  label: string;
  value: any;
};

export type LabeledResponse = {
  id: number;
  formId: number;
  formName: string;
  userName: string;
  createdAt: string;
  responses: LabeledResponseEntry[];
};

export type AddEventFormState =
  | {
      updated?: boolean;
      errors?: {
        title?: string[];
        description?: string[];
        datesJson?: string[];
        startTime?: string[];
        endTime?: string[];
        checkbox?: string[];
        allDay?: string[];
        team?: string[];
      };
      message?: string;
    }
  | undefined;

export type CreateJobFormState =
  | {
      updated?: boolean;
      errors?: {
        title?: string[];
        instructions?: string[];
        jobType?: string[];
        datesJson?: string[];
        startTime?: string[];

        endTime?: string[];
        checkbox?: string[];
        allDay?: string[];
        team?: string[];
      };
      message?: string;
    }
  | undefined;

export type CreateClientFormState =
  | {
      errors?: {
        firstName?: string[];
        lastName?: string[];
        companyName?: string[];
        managementCompany?: string[];
        isCompany?: string[];
        phoneNumberType?: string[];
        phone?: string[];
        emailType?: string[];
        email?: string[];
        street1?: string[];
        street2?: string[];
        city?: string[];
        state?: string[];
        zipCode?: string[];
        country?: string[];
        contractInfo?: string[];
        billingInfo?: string[];
        notes?: string[];
        tags?: string[];
      };
      message?: string;
    }
  | undefined;

export type EditClientFormState =
  | {
      errors?: {
        companyName?: string[];
        managementCompany?: string[];
        contractInfo?: string[];
        billingInfo?: string[];
        tags?: string[];
      };
      message?: string;
    }
  | undefined;

export type CreateInvoiceFormState =
  | {
      updated?: boolean;
      errors?: {
        title?: string[];
        paymentMethod?: string[];
        notes?: string[];
      };
      message?: string;
    }
  | undefined;

export type RegisterFormState =
  | {
      errors?: {
        name?: string[];
        email?: string[];
        password?: string[];
      };
      message?: string;
    }
  | undefined;

export type ResetPasswordFormState =
  | {
      errors?: {
        password?: string[];
        code?: string[];
      };
      message?: string;
    }
  | undefined;

// FORM SCHEMAS //

export const RegisterFormSchema = z.object({
  name: z.string().min(1, {
    message: 'Name is required',
  }),
  email: z.string().email({
    message: 'Not a valid email',
  }),
  password: z.string().min(6, {
    message: 'Password must be at least 6 characters.',
  }),
});

export const LoginFormSchema = z.object({
  email: z.string().email({
    message: 'Email must be in correct format',
  }),
  password: z.string().min(6, {
    message: 'Password must be at least 6 characters.',
  }),
});

export const ResetPasswordFormSchema = z.object({
  password: z.string().min(6, {
    message: 'Password must be at least 6 characters.',
  }),
  code: z
    .string()
    .length(6, { message: 'Code must be exactly 6 digits.' })
    .regex(/^[0-9]{6}$/, { message: 'Code must contain only digits.' }),
});

// maybe remove unused checkbox / date
export const AddEventFormSchema = z
  .object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional(),
    dates: z.date().optional(),
    datesJson: z.string(),
    startTime: z.coerce.string().optional(),
    endTime: z.coerce.string().optional(),
    checkbox: z.any().optional(),
    allDay: z.boolean().optional(),
    team: z.string(),
  })
  .refine(
    (data) => {
      return isFormValid(data);
    },
    { message: 'Start time is required', path: ['startTime'] },
  );

export const CreateJobFormSchema = z
  .object({
    title: z.string().min(1, 'Title is required'),
    jobType: z.string(),
    instructions: z.string().optional(),
    dates: z.date().optional(),
    datesJson: z.string(),
    startTime: z.coerce.string().optional(),
    endTime: z.coerce.string().optional(),
    checkbox: z.any().optional(),
    allDay: z.boolean().optional(),
    team: z.string(),
    jobForms: z.array(z.number()),
  })
  .refine(
    (data) => {
      return isFormValid(data);
    },

    { message: 'Start time is required', path: ['startTime'] },
  );

export const CreateClientFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  companyName: z.string().optional(),
  managementCompany: z.string().optional(),
  isCompany: z.boolean().optional(),
  phone: z.string().min(1, 'Phone number is required'),
  email: z.string().email({
    message: 'Email must be in correct format',
  }),
  position: z.string().optional(),
  street1: z.string().min(1, 'Street is required'),
  street2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  zipCode: z.string().min(1, 'Zip code is required'),
  country: z.string(),
  operatingHours: z.string(),
  contractInfo: z.string().optional(),
  billingInfo: z.string().optional(),
  notes: z.string().optional(),
  tags: z.string().optional(),
  accountManager: z.string().optional(),
});

export const EditClientFormSchema = z.object({
  companyName: z.string().optional(),
  managementCompany: z.string().optional(),
  contractInfo: z.string().optional(),
  billingInfo: z.string().optional(),
  tags: z.string().optional(),
  accountManager: z.string().optional(),
});

export const AddPropertyFormSchema = z.object({
  street1: z.string().min(1, 'Street is required'),
  street2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  zipCode: z.string().min(1, 'Zip code is required'),
  country: z.string(),
  operatingHours: z.string(),
});

export const ContactFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  companyName: z.string().optional(),
  managementCompany: z.string().optional(),
  isCompany: z.boolean().optional(),
  phone: z.string().min(1, 'Phone number is required'),
  phone2: z.string().optional(),
  phone3: z.string().optional(),
  phone4: z.string().optional(),
  email: z.string().email({
    message: 'Email must be in correct format',
  }),
  email2: z.union([z.literal(''), z.string().email()]).optional(),
  email3: z.union([z.literal(''), z.string().email()]).optional(),
  email4: z.union([z.literal(''), z.string().email()]).optional(),
  position: z.string().optional(),
});

export const EditVisitsFormSchema = z.object({
  nextVisit: z.string().optional(),
  lastVisit: z.string().optional(),
  specialSchedule: z.string().optional(),
});

export const EditInventoryFormSchema = z.object({
  treadmill: z.coerce.number().optional(),
  elliptical: z.coerce.number().optional(),
  bike: z.coerce.number().optional(),
  stepper: z.coerce.number().optional(),
  strength: z.coerce.number().optional(),
  bench: z.coerce.number().optional(),
  spinner: z.coerce.number().optional(),
  rower: z.coerce.number().optional(),
  miscellaneous: z.string().optional(),
});

export const CreateTaxFormSchema = z.object({
  taxName: z.string(),
  taxRate: z.string(),
});

export const CreateTemplateLineItemFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  unitPrice: z.string(),
  isTaxable: z.boolean().optional(),
});

export const CreateInvoiceFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  paymentMethod: z.string().min(1, 'Payment method is required'),
  notes: z.string().optional(),
});

// HELPER FUNCTIONS //
function isFormValid(
  data: Record<string, Date | string | boolean | string[] | Object | undefined>,
) {
  if (data.allDay === false && (data.startTime == '' || data.endTime == ''))
    return false;
  else return true;
}

// UTILITY TYPES //
export type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;
