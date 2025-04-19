'use server';

import {
  getClientStatus,
  getCurrentUser,
  getInventory,
  getUsersByEmail,
  getUsersByName,
} from './data';
import {
  AddEventFormSchema,
  AddEventFormState,
  CreateClientFormSchema,
  CreateClientFormState,
  CreateJobFormSchema,
  CreateJobFormState,
  EditClientFormSchema,
  EditClientFormState,
  RegisterFormState,
  LoginFormSchema,
  RegisterFormSchema,
  User,
  ContactFormSchema,
  AddPropertyFormSchema,
  EditInventoryFormSchema,
  EditVisitsFormSchema,
  ClientStatus,
  Field,
  Optional,
  JobData,
  CreateTaxFormSchema,
  Quote,
  QuoteFormData,
  CreateInvoiceFormSchema,
  CreateInvoiceFormState,
  UserRole,
  ResetPasswordFormSchema,
  ResetPasswordFormState,
  CreateTemplateLineItemFormSchema,
} from './definitions';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { AuthError } from 'next-auth';
import { sql } from '@vercel/postgres';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { signIn, signOut } from '@/app/api/auth/[...nextauth]/auth';
import { priceToCents } from './utils';

export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  const validatedFields = LoginFormSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  // If any form fields are invalid, return early with errors for form
  try {
    if (!validatedFields.success) {
      throw new Error();
    }
  } catch (error) {
    const errors = JSON.stringify(validatedFields.error?.flatten().fieldErrors);
    return errors;
  }

  try {
    await signIn('credentials', formData);
  } catch (error) {
    if (error instanceof AuthError) {
      return error.cause?.err?.message;
    }
    throw error;
  }
}

export async function register(state: RegisterFormState, formData: FormData) {
  const validatedFields = RegisterFormSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  });

  // If any form fields are invalid, return early
  if (!validatedFields.success) {
    const errors = validatedFields.error.flatten().fieldErrors;
    console.log(errors);
    return {
      errors: errors,
    };
  } else {
    try {
      const { name, email, password } = validatedFields.data;
      const userExists = !!(await getUsersByEmail(email));

      if (userExists) {
        return {
          errors: {
            email: ['A user with that email already exists.'],
          },
        };
      }
      const hashedPassword = await hashPassword(password);
      const defaultColor = '#00bdc3';

      const response = await sql`
        INSERT INTO users (name, email, password, color, role)
        VALUES (${name}, ${email}, ${hashedPassword}, ${defaultColor}, 'USER')
      `;
    } catch (error) {
      console.error('Registration failed: ', error);
    }
    redirect('/login');
  }
}

export async function resetPassword(
  email: string,
  generatedCode: string | null,
  prevState: ResetPasswordFormState,
  formData: FormData,
) {
  const validatedFields = ResetPasswordFormSchema.safeParse({
    password: formData.get('password'),
    code: formData.get('code'),
  });

  // If any form fields are invalid, return early
  if (!validatedFields.success) {
    const errors = validatedFields.error.flatten().fieldErrors;
    console.log(errors);

    return {
      errors: errors,
    };
  } else {
    try {
      const { password, code } = validatedFields.data;

      if (code !== generatedCode) {
        return {
          errors: {
            code: ['Invalid code.'],
          },
        };
      }

      const userExists = !!(await getUsersByEmail(email));

      if (!userExists) {
        return {
          errors: {
            code: ['A user with that email does not exist.'],
          },
        };
      }

      const hashedPassword = await hashPassword(password);

      const response = await sql`
        UPDATE users
        SET password = ${hashedPassword}
        WHERE email = ${email}
      `;
    } catch (error) {
      console.error('Registration failed: ', error);
    }
    redirect('/login');
  }
}

export async function updateUserRole(userId: string, newRole: UserRole) {
  const currentUser = await getCurrentUser();
  if (
    !currentUser ||
    (currentUser.id !== userId && currentUser.role !== 'ADMIN')
  ) {
    throw new Error("Permission denied: Cannot update user's color.");
  }

  try {
    await sql`
      UPDATE users
      SET role = ${newRole} 
      WHERE id = ${userId}
    `;

    revalidatePath('/dashboard/settings', 'page');
  } catch (error) {
    console.error('User deletion failed: ', error);
  }
}

export async function deleteUser(userId: string) {
  const currentUser = await getCurrentUser();
  if (
    !currentUser ||
    (currentUser.id !== userId && currentUser.role !== 'ADMIN')
  ) {
    throw new Error("Permission denied: Cannot update user's color.");
  }

  try {
    await sql`
      DELETE FROM users
      WHERE id = ${userId}
    `;

    revalidatePath('/dashboard/settings', 'page');
  } catch (error) {
    console.error('User deletion failed: ', error);
  }
  redirect('/dashboard/settings');
}

export async function updateUserColor(userId: string, newColor: string) {
  const currentUser = await getCurrentUser();
  if (
    !currentUser ||
    (currentUser.id !== userId && currentUser.role !== 'ADMIN')
  ) {
    throw new Error("Permission denied: Cannot update user's color.");
  }

  // Validate hex code format
  if (!/^#[0-9A-F]{6}$/i.test(newColor)) {
    throw new Error('Invalid hex color format.');
  }

  try {
    await sql`
      UPDATE users
      SET color = ${newColor}
      WHERE id = ${userId};
    `;

    revalidatePath('/dashboard/settings', 'page');
  } catch (error) {
    console.error('Database Error: Failed to update user color.', error);
    throw new Error('Failed to update user color.');
  }
}

export async function clientSignOut() {
  await signOut();
}

export async function comparePasswords(password: string, userPassword: string) {
  const match: Boolean = await bcrypt.compare(password, userPassword);
  return match;
}

export async function hashPassword(password: string) {
  const hashedPassword = await bcrypt.hash(password, 10);
  return hashedPassword;
}

export async function addEvent(
  prevState: AddEventFormState,
  formData: FormData,
): Promise<AddEventFormState> {
  const validatedFields = AddEventFormSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description'),
    datesJson: formData.get('datesJson'),
    startTime: formData.get('startTime'),
    endTime: formData.get('endTime'),
    checkbox: formData.get('checkbox'),
    allDay: Boolean(formData.get('allDay')),
    team: formData.get('team'),
  });

  // If any form fields are invalid, return early
  if (!validatedFields.success) {
    const errors = validatedFields.error.flatten().fieldErrors;
    console.log(errors);
    return {
      errors: errors,
    };
  } else {
    const { title, description, datesJson } = validatedFields.data;
    const team = validatedFields.data.team;
    const allDay = Boolean(validatedFields.data.allDay); // update to use !!
    let startTime: string | null | undefined = validatedFields.data.startTime;
    let endTime: string | null | undefined = validatedFields.data.endTime;
    let { from, to } = JSON.parse(datesJson);
    if (!to) to = from;
    if (startTime == 'null') startTime = null;
    if (endTime == 'null') endTime = null;

    try {
      const eventResult = await sql`
        INSERT INTO events (
          title, 
          description
        )
        VALUES (
          ${title}, 
          ${description}
        )
        RETURNING id;
      `;

      const eventId = eventResult.rows[0].id;

      const calendarResult = await sql`
        INSERT INTO calendar_items (
          event_id, 
          start_date, 
          end_date, 
          start_time, 
          end_time, 
          all_day
        )
        VALUES (
          ${eventId},
          ${from}, 
          ${to}, 
          ${startTime}, 
          ${endTime}, 
          ${allDay}
        )
      `;

      let users = (await getUsersByName(team)) as User[];

      if (users[0] != undefined) {
        await Promise.all(
          users.map(async (user: User) => {
            const eventUsersResult = await sql`
              INSERT INTO event_users (user_id, event_id)
              VALUES (${user.id}, ${eventId})
            `;
          }),
        );
      } else {
        const teamResult = await sql`
          INSERT INTO event_users (user_id, event_id)
          VALUES (${null}, ${eventId})
        `;
      }

      return { updated: true };
    } catch (error) {
      console.error('Add event failed: ', error);
    } finally {
      revalidatePath('/dashboard');
      redirect('dashboard');
    }
  }
}

export async function updateEvent(
  id: number,
  prevState: AddEventFormState,
  formData: FormData,
): Promise<AddEventFormState> {
  const validatedFields = AddEventFormSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description'),
    datesJson: formData.get('datesJson'),
    startTime: formData.get('startTime'),
    endTime: formData.get('endTime'),
    checkbox: formData.get('checkbox'),
    allDay: Boolean(formData.get('allDay')),
    team: formData.get('team'),
  });

  // If any form fields are invalid, return early
  if (!validatedFields.success) {
    const errors = validatedFields.error.flatten().fieldErrors;
    console.log(errors);
    return {
      errors: errors,
    };
  } else {
    const { title, description, datesJson } = validatedFields.data;
    const team = validatedFields.data.team;
    const allDay = !!validatedFields.data.allDay;
    let startTime: string | null | undefined = validatedFields.data.startTime;
    let endTime: string | null | undefined = validatedFields.data.endTime;
    let { from, to } = JSON.parse(datesJson);
    if (!to) to = from;
    if (startTime == 'null') startTime = null;
    if (endTime == 'null') endTime = null;

    try {
      const eventResult = await sql`
        UPDATE events 
        SET title = ${title}, description = ${description}
        WHERE id = ${id}
      `;

      const calendarResult = await sql`
        UPDATE calendar_items 
        SET start_date = ${from},
          end_date = ${to},
          start_time = ${startTime},
          end_time = ${endTime},
          all_day = ${allDay}
        WHERE event_id = ${id}
      `;

      const deletePrevUserEvents = await sql`
        DELETE FROM event_users
        WHERE event_id = ${id}
      `;

      let users = (await getUsersByName(team)) as User[];

      if (users[0] != undefined) {
        await Promise.all(
          users.map(async (user: User) => {
            await sql`
              INSERT INTO event_users (user_id, event_id)
              VALUES (${user.id}, ${id})
            `;
          }),
        );
      }

      revalidatePath('/dashboard');
    } catch (error) {
      console.error('Event update failed: ', error);
    }
    redirect('/dashboard');
  }
}

export async function deleteEvent(id: number) {
  try {
    const result = await sql`
      DELETE FROM events WHERE id = ${id}
    `;

    revalidatePath('/dashboard');
  } catch (error) {
    console.error('Event deletion failed: ', error);
    throw error;
  }
  redirect('/dashboard');
}

export async function createJob(
  clientId: number | null,
  quoteId: number | null,
  quoteData: QuoteFormData | null,
  prevState: CreateJobFormState,
  formData: FormData,
): Promise<CreateJobFormState> {
  const validatedFields = CreateJobFormSchema.safeParse({
    title: formData.get('title'),
    jobType: formData.get('jobType'),
    instructions: formData.get('instructions'),
    datesJson: formData.get('datesJson'),
    startTime: formData.get('startTime'),
    endTime: formData.get('endTime'),
    checkbox: formData.get('checkbox'),
    allDay: Boolean(formData.get('allDay')),
    team: formData.get('team'),
    jobForms: JSON.parse(
      (formData.get('jobForms') as string) ?? '[]',
    ) as string[],
  });

  if (!validatedFields.success) {
    const errors = validatedFields.error.flatten().fieldErrors;
    console.log(errors);
    return {
      errors: errors,
    };
  } else {
    const { title, jobType, instructions, datesJson, jobForms } =
      validatedFields.data;
    const team = validatedFields.data.team;
    const allDay = !!validatedFields.data.allDay;
    let startTime: string | null | undefined = validatedFields.data.startTime;
    let endTime: string | null | undefined = validatedFields.data.endTime;
    let { from, to } = JSON.parse(datesJson);
    if (!to) to = from;
    if (startTime == 'null') startTime = null;
    if (endTime == 'null') endTime = null;
    const DEFAULT_STATUS = 'incomplete' as JobData['status'];

    try {
      const currentDateTime = new Date().toISOString();

      if (quoteData) {
        let errors: string[] = [];

        if (!clientId) {
          errors.push('A client must be selected');
        }

        if (errors.length > 0) {
          return { message: errors.toString() };
        }

        const DEFAULT_STATUS = 'in progress' as Quote['status'];
        const managerId = (await getCurrentUser()).id;

        const quoteResult = await sql`
          INSERT INTO quotes (
            client_id, 
            user_id, 
            tax_id, 
            status, 
            date_created
          )
          VALUES (
            ${clientId}, 
            ${managerId}, 
            ${quoteData.taxId}, 
            ${DEFAULT_STATUS}, 
            ${currentDateTime}
          )
          RETURNING id;
        `;

        quoteId = quoteResult.rows[0].id;

        for (const lineItem of quoteData.lineItems) {
          const unitPriceInCents =
            Number(lineItem.unit_price.replace(/[\$,]/g, '')) * 100;

          await sql`
            INSERT INTO line_items (
              quote_id, 
              name, 
              description, 
              quantity, 
              unit_price, 
              is_taxable
            )
            VALUES (
              ${quoteId},
              ${lineItem.name},
              ${lineItem.description},
              ${lineItem.quantity},
              ${unitPriceInCents},
              ${lineItem.is_taxable}
            );
          `;
        }
      }

      const jobResult = await sql`
        INSERT INTO jobs (
          client_id,
          quote_id,
          title,
          job_type,
          instructions,
          status,
          date_created
        )
        VALUES (
          ${clientId},
          ${quoteId},
          ${title},
          ${jobType},
          ${instructions},
          ${DEFAULT_STATUS},
          ${currentDateTime}
        )
        RETURNING id;
      `;

      const jobId = jobResult.rows[0].id;

      const calendarResult = await sql`
        INSERT INTO calendar_items (
          job_id, 
          start_date, 
          end_date, 
          start_time, 
          end_time, 
          all_day
        )
        VALUES (
          ${jobId},
          ${from}, 
          ${to}, 
          ${startTime}, 
          ${endTime}, 
          ${allDay}
        )
      `;

      let users = (await getUsersByName(team)) as User[];

      if (users[0] != undefined) {
        await Promise.all(
          users.map(async (user: User) => {
            await sql`
              INSERT INTO job_users (user_id, job_id)
              VALUES (${user.id}, ${jobId})
            `;
          }),
        );
      }

      if (jobForms.length > 0) {
        await Promise.all(
          jobForms.map(async (jobForm: number) => {
            await sql`
              INSERT INTO job_forms (job_id, form_id)
              VALUES (${jobId}, ${jobForm})
            `;
          }),
        );
      }

      revalidatePath('/dashboard/jobs', 'page');
    } catch (error) {
      console.error('Job creation failed: ', error);
    }
    redirect('/dashboard/jobs');
  }
}

export async function updateJob(
  id: number,
  clientId: number | null,
  prevState: CreateJobFormState,
  formData: FormData,
): Promise<CreateJobFormState> {
  const validatedFields = CreateJobFormSchema.safeParse({
    title: formData.get('title'),
    jobType: formData.get('jobType'),
    instructions: formData.get('instructions'),
    datesJson: formData.get('datesJson'),
    startTime: formData.get('startTime'),
    endTime: formData.get('endTime'),
    checkbox: formData.get('checkbox'),
    allDay: Boolean(formData.get('allDay')),
    team: formData.get('team'),
    jobForms: JSON.parse(
      (formData.get('jobForms') as string) ?? '[]',
    ) as string[],
  });

  // If any form fields are invalid, return early
  if (!validatedFields.success) {
    const errors = validatedFields.error.flatten().fieldErrors;
    console.log(errors);
    return {
      errors: errors,
    };
  } else {
    const { title, jobType, instructions, datesJson, jobForms } =
      validatedFields.data;
    const team = validatedFields.data.team;
    const allDay = !!validatedFields.data.allDay;
    let startTime: string | null | undefined = validatedFields.data.startTime;
    let endTime: string | null | undefined = validatedFields.data.endTime;
    let { from, to } = JSON.parse(datesJson);
    if (!to) to = from;
    if (startTime == 'null') startTime = null;
    if (endTime == 'null') endTime = null;

    try {
      const jobResult = await sql`
        UPDATE jobs 
        SET client_id = ${clientId}, 
          title = ${title}, 
          instructions = ${instructions}, 
          job_type = ${jobType}
        WHERE id = ${id}
      `;

      const calendarResult = await sql`
        UPDATE calendar_items 
        SET start_date = ${from},
          end_date = ${to},
          start_time = ${startTime},
          end_time = ${endTime},
          all_day = ${allDay}
        WHERE job_id = ${id}
      `;

      const deletePrevJobUsers = await sql`
        DELETE FROM job_users
        WHERE job_id = ${id}
      `;

      const deletePrevJobForms = await sql`
        DELETE FROM job_forms
        WHERE job_id = ${id}
      `;

      let users = (await getUsersByName(team)) as User[];

      if (users[0] != undefined) {
        await Promise.all(
          users.map(async (user: User) => {
            await sql`
              INSERT INTO job_users (user_id, job_id)
              VALUES (${user.id}, ${id})
            `;
          }),
        );
      }

      if (jobForms.length > 0) {
        await Promise.all(
          jobForms.map(async (jobForm: number) => {
            await sql`
              INSERT INTO job_forms (job_id, form_id)
              VALUES (${id}, ${jobForm})
            `;
          }),
        );
      }

      await addEntityActivity(id, 'job', 'Job updated');
    } catch (error) {
      console.error('Job update failed: ', error);
    }
    redirect(`/dashboard/jobs/${id}`);
  }
}

export async function updateJobQuote(quote_id: number, jobId: number) {
  try {
    const jobResult = await sql`
      UPDATE jobs 
      SET quote_id = ${quote_id}
      WHERE id = ${jobId}
    `;

    await addEntityActivity(jobId, 'job', 'Job updated');

    revalidatePath(`/dashboard/jobs/${jobId}`, 'page');
  } catch (error) {
    console.error('Job update failed: ', error);
  }
}

export async function deleteJob(id: number) {
  try {
    const result = await sql`
      DELETE FROM jobs WHERE id = ${id}
    `;

    revalidatePath('/dashboard/jobs', 'page');
  } catch (error) {
    console.error('Job deletion failed: ', error);
    throw error;
  }
  redirect('/dashboard/jobs');
}

export async function createClient(
  prevState: CreateClientFormState,
  formData: z.infer<typeof CreateClientFormSchema>,
): Promise<CreateClientFormState> {
  {
    const {
      firstName,
      lastName,
      companyName,
      managementCompany,
      isCompany,
      phone,
      email,
      position,
      street1,
      street2,
      city,
      state,
      zipCode,
      country,
      operatingHours,
      contractInfo,
      billingInfo,
      notes,
      tags,
      accountManager,
    } = formData;

    const validatedFields = CreateClientFormSchema.safeParse({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      companyName: companyName?.trim(),
      managementCompany: managementCompany?.trim(),
      isCompany,
      phone: phone.trim(),
      email: email.trim(),
      position,
      street1: street1.trim(),
      street2: street2?.trim(),
      city: city.trim(),
      state: state.trim(),
      zipCode: zipCode.trim(),
      country: country.trim(),
      operatingHours: operatingHours?.trim(),
      contractInfo,
      billingInfo,
      notes,
      tags,
      accountManager,
    });

    // If any form fields are invalid, return early
    if (!validatedFields.success) {
      const errors = validatedFields.error.flatten().fieldErrors;
      console.log(errors);
      return {
        errors: errors,
      };
    } else {
      const {
        firstName,
        lastName,
        companyName,
        managementCompany,
        isCompany,
        phone,
        email,
        position,
        street1,
        street2,
        city,
        state,
        zipCode,
        country,
        operatingHours,
        contractInfo,
        billingInfo,
        notes,
        tags,
      } = validatedFields.data;

      console.log(validatedFields.data);

      const fullName = `${firstName} ${lastName}`;
      const currentDateTime = new Date().toISOString();

      try {
        const clientResult = await sql`
          INSERT INTO clients (company_name, tags, is_company, management_company, contract_information, billing_instructions, account_manager)
          VALUES (${companyName}, ${tags}, ${isCompany}, ${managementCompany}, ${contractInfo}, ${billingInfo}, ${accountManager})
          RETURNING id
        `;

        const insertedClientId = clientResult.rows[0].id;

        const contactResult = await sql`
          INSERT INTO contacts (client_id, name, position)
          VALUES (${insertedClientId}, ${fullName}, ${position})
          RETURNING id
        `;

        const phoneResult = await sql`
          INSERT INTO contact_phone_numbers (contact_id, phone_number, is_main)
          VALUES (${contactResult.rows[0].id}, ${phone}, false)
        `;

        const emailResult = await sql`
          INSERT INTO contact_emails (contact_id, email, is_main)
          VALUES (${contactResult.rows[0].id}, ${email}, false)
        `;

        const propertiesResult = await sql`
          INSERT INTO properties (client_id, country, state, city, zip, street_1, street_2, operating_hours)
          VALUES (${insertedClientId}, ${country}, ${state}, ${city}, ${zipCode}, ${street1}, ${street2}, ${operatingHours})
        `;

        if (notes) {
          const notesResult = await sql`
          INSERT INTO notes (client_id, text, date_created)
          VALUES (${insertedClientId}, ${notes}, ${currentDateTime})
        `;
        }

        await addClientActivity(insertedClientId, 'Client created');

        revalidatePath('/dashboard/clients');
      } catch (error) {
        console.error('Event creation failed: ', error);
      }
      redirect('/dashboard/clients');
    }
  }
}

export async function updateJobStatus(
  jobId: number,
  newStatus: JobData['status'],
) {
  try {
    const currentUser = await getCurrentUser();

    await sql`
      UPDATE jobs
      SET status = ${newStatus}
      WHERE id = ${jobId}
    `;

    await addEntityActivity(jobId, 'job', `Job marked as ${newStatus}`);

    revalidatePath('/dashboard/jobs', 'page');
    revalidatePath(`/dashboard/jobs/${jobId}`, 'page');
  } catch (error) {
    console.error(`Failed to update job status for job ${jobId}:`, error);
  }
}

export async function editClient(
  clientId: number,
  prevState: EditClientFormState,
  formData: z.infer<typeof EditClientFormSchema>,
): Promise<EditClientFormState> {
  const {
    companyName,
    managementCompany,
    contractInfo,
    billingInfo,
    tags,
    accountManager,
  } = formData;

  const validatedFields = EditClientFormSchema.safeParse({
    companyName,
    managementCompany,
    contractInfo,
    billingInfo,
    tags,
    accountManager,
  });

  // If any form fields are invalid, return early
  if (!validatedFields.success) {
    const errors = validatedFields.error.flatten().fieldErrors;
    console.log(errors);
    return {
      errors: errors,
    };
  } else {
    const {
      companyName,
      managementCompany,
      contractInfo,
      billingInfo,
      tags,
      accountManager,
    } = validatedFields.data;

    try {
      const clientResult = await sql`
          UPDATE clients
          SET company_name = ${companyName},
            management_company = ${managementCompany},
            contract_information = ${contractInfo},
            billing_instructions = ${billingInfo},
            tags = ${tags},
            account_manager = ${accountManager}
          WHERE id = ${clientId}
        `;

      await addClientActivity(clientId, 'Client edited');

      revalidatePath(`/dashboard/clients/[id]`, 'page');
    } catch (error) {
      console.error('Event creation failed: ', error);
    }
    redirect(`/dashboard/clients/${clientId}`);
  }
}

export async function addProperty(
  clientId: number,
  formData: z.infer<typeof AddPropertyFormSchema>,
) {
  const { street1, street2, city, state, zipCode, country, operatingHours } =
    formData;

  const validatedFields = AddPropertyFormSchema.safeParse({
    street1,
    street2,
    city,
    state,
    zipCode,
    country,
    operatingHours,
  });

  // If any form fields are invalid, return early
  if (!validatedFields.success) {
    const errors = validatedFields.error.flatten().fieldErrors;
    console.log(errors);
    return {
      errors: errors,
    };
  } else {
    const { street1, street2, city, state, zipCode, country, operatingHours } =
      validatedFields.data;

    try {
      const propertiesResult = await sql`
        INSERT INTO properties (client_id, country, state, city, zip, street_1, street_2, operating_hours)
        VALUES (${clientId}, ${country}, ${state}, ${city}, ${zipCode}, ${street1}, ${street2}, ${operatingHours})
      `;

      await addClientActivity(clientId, 'Added new property');

      revalidatePath(`/dashboard/clients/${clientId}`);
    } catch (error) {
      console.error('Event creation failed: ', error);
    }
    redirect(`/dashboard/clients/${clientId}`);
  }
}

export async function editProperty(
  propertyId: number,
  formData: z.infer<typeof AddPropertyFormSchema>,
) {
  const { street1, street2, city, state, zipCode, country, operatingHours } =
    formData;

  const validatedFields = AddPropertyFormSchema.safeParse({
    street1: street1.trim(),
    street2: street2?.trim(),
    city: city.trim(),
    state: state.trim(),
    zipCode: zipCode.trim(),
    country: country.trim(),
    operatingHours: operatingHours.trim(),
  });

  // If any form fields are invalid, return early
  if (!validatedFields.success) {
    const errors = validatedFields.error.flatten().fieldErrors;
    console.log(errors);
    return {
      errors: errors,
    };
  } else {
    const { street1, street2, city, state, zipCode, country, operatingHours } =
      validatedFields.data;

    try {
      const propertiesResult = await sql`
        UPDATE properties
        SET street_1 = ${street1},
          street_2 = ${street2},
          city = ${city},
          state = ${state},
          zip = ${zipCode},
          country = ${country},
          operating_hours = ${operatingHours}
        WHERE id = ${propertyId};
      `;

      revalidatePath(`/dashboard/clients/[id]`, 'page');
    } catch (error) {
      console.error('Event creation failed: ', error);
    }
  }
}

export async function deletePropertyById(propertyId: number) {
  try {
    await sql`
      DELETE FROM properties
      WHERE id = ${propertyId}
    `;

    revalidatePath(`/dashboard/clients/[id]`, 'page');
  } catch (error) {
    console.error('Property deletion failed: ', error);
    throw error;
  }
}

export async function addContact(
  clientId: number,
  formData: z.infer<typeof ContactFormSchema>,
) {
  const {
    firstName,
    lastName,
    phone,
    phone2,
    phone3,
    phone4,
    email,
    email2,
    email3,
    email4,
    position,
  } = formData;

  const validatedFields = ContactFormSchema.safeParse({
    firstName,
    lastName,
    phone,
    phone2,
    phone3,
    phone4,
    email,
    email2,
    email3,
    email4,
    position,
  });

  // If any form fields are invalid, return early
  if (!validatedFields.success) {
    const errors = validatedFields.error.flatten().fieldErrors;
    console.log(errors);
    return {
      errors: errors,
    };
  } else {
    const {
      firstName,
      lastName,
      phone,
      phone2,
      phone3,
      phone4,
      email,
      email2,
      email3,
      email4,
      position,
    } = validatedFields.data;

    try {
      const fullName = `${firstName} ${lastName}`;

      // Insert the contact and retrieve its id
      const contactsResult = await sql`
        INSERT INTO contacts (
          client_id, 
          name, 
          position
        )
        VALUES (
          ${clientId}, 
          ${fullName}, 
          ${position}
        )
        RETURNING id
      `;

      const contactId = contactsResult.rows[0].id;
      const phones = [phone, phone2, phone3, phone4].filter(Boolean);
      const emails = [email, email2, email3, email4].filter(Boolean);

      const insertedNumbers = await Promise.all(
        phones.map(async (phoneNumber) => {
          return sql`
            INSERT INTO contact_phone_numbers (contact_id, phone_number, is_main)
            VALUES (${contactId}, ${phoneNumber}, false)
          `;
        }),
      );

      const insertedEmails = await Promise.all(
        emails.map(async (email) => {
          return sql`
            INSERT INTO contact_emails (contact_id, email, is_main)
            VALUES (${contactId}, ${email}, false)
          `;
        }),
      );

      revalidatePath(`/dashboard/clients/[id]`, 'page');
    } catch (error) {
      console.error('Contact creation failed: ', error);
    }
  }
}

export async function editContact(
  contactId: number,
  phoneIds: number[],
  emailIds: number[],
  formData: z.infer<typeof ContactFormSchema>,
) {
  const {
    firstName,
    lastName,
    phone,
    phone2,
    phone3,
    phone4,
    email,
    email2,
    email3,
    email4,
    position,
  } = formData;

  const validatedFields = ContactFormSchema.safeParse({
    firstName,
    lastName,
    phone,
    phone2,
    phone3,
    phone4,
    email,
    email2,
    email3,
    email4,
    position,
  });

  // If any form fields are invalid, return early
  if (!validatedFields.success) {
    const errors = validatedFields.error.flatten().fieldErrors;
    console.log(errors);
    return {
      errors: errors,
    };
  } else {
    const {
      firstName,
      lastName,
      phone,
      phone2,
      phone3,
      phone4,
      email,
      email2,
      email3,
      email4,
      position,
    } = validatedFields.data;

    try {
      const fullName = `${firstName} ${lastName}`;

      const contactsResult = await sql`
        UPDATE contacts
        SET name = ${fullName}, position = ${position}
        WHERE id = ${contactId}
      `;

      const phones = [phone, phone2, phone3, phone4];
      const emails = [email, email2, email3, email4];

      const updatedNumbers = await Promise.all(
        phones.map(async (phoneNumber, index) => {
          const phoneId = phoneIds[index];
          const emptyNumber = phoneNumber === undefined || phoneNumber === '';

          // Return if phone and ID dont exist
          if (emptyNumber && !phoneId) {
            return;
          }

          if (emptyNumber && phoneId) {
            // If phone number was deleted then delete from db
            return sql`
              DELETE FROM contact_phone_numbers
              WHERE id = ${phoneId};
            `;
          } else if (phoneId) {
            // If phone number already existed in db then update
            return sql`
              UPDATE contact_phone_numbers
              SET phone_number = ${phoneNumber}
              WHERE id = ${phoneId}
            `;
          } else {
            // If phone did not exist in db then insert new phone number
            return sql`
              INSERT INTO contact_phone_numbers (contact_id, phone_number, is_main)
              VALUES (${contactId}, ${phoneNumber}, false)
            `;
          }
        }),
      );

      const updatedEmails = await Promise.all(
        emails.map(async (email, index) => {
          const emailId = emailIds[index];
          const emptyNumber = email === undefined || email === '';

          // Return if phone and ID dont exist
          if (emptyNumber && !emailId) {
            return;
          }

          if (emptyNumber && emailId) {
            // If phone number was deleted then delete from db
            return sql`
              DELETE FROM contact_emails
              WHERE id = ${emailId};
            `;
          } else if (emailId) {
            // If phone number already existed in db then update
            return sql`
              UPDATE contact_emails
              SET email = ${email}
              WHERE id = ${emailId}
            `;
          } else {
            // If phone did not exist in db then insert new phone number
            return sql`
              INSERT INTO contact_emails (contact_id, email, is_main)
              VALUES (${contactId}, ${email}, false)
            `;
          }
        }),
      );

      revalidatePath(`/dashboard/clients/[id]`, 'page');
    } catch (error) {
      console.error('Contact editing failed: ', error);
    }
  }
}

export async function deleteContactById(contactId: number) {
  try {
    await sql`
      DELETE FROM contacts
      WHERE id = ${contactId}
    `;

    revalidatePath(`/dashboard/clients/[id]`, 'page');
  } catch (error) {
    console.error('Contact deletion failed: ', error);
    throw error;
  }
}

export async function addClientActivity(clientId: number, activity: string) {
  try {
    const currentDateTime = new Date().toISOString();
    const result = await sql`
      INSERT INTO client_activity (client_id, activity, date)
      VALUES (${clientId}, ${activity}, ${currentDateTime})
    `;
  } catch (error) {
    console.error('Activity creation failed: ', error);
  }
}

export async function addNote(
  entity: string,
  entityId: number,
  visibility: 'public' | 'internal',
  note: string,
  files: string,
) {
  try {
    const currentDateTime = new Date().toISOString();
    const author = (await getCurrentUser()).name;

    const notesResult = await sql`
      INSERT INTO notes (
        entity,
        entity_id,
        visibility,
        author,
        text,
        date_created,
        files
      )
      VALUES (
        ${entity},
        ${entityId},
        ${visibility},
        ${author},
        ${note},
        ${currentDateTime},
        ${files}
      )
    `;

    revalidatePath('/', 'layout');
  } catch (error) {
    console.error('Note creation failed: ', error);
  }
}

export async function deleteNoteById(id: number) {
  try {
    const result = await sql`
      DELETE FROM notes
      WHERE id = ${id}
    `;

    revalidatePath('/', 'layout');
  } catch (error) {
    console.error('Note deletion failed: ', error);
    throw error;
  }
}

export async function deleteClient(clientId: number) {
  try {
    const result = await sql`
      DELETE FROM clients
      WHERE id = ${clientId}
    `;

    revalidatePath('/dashboard/clients');
  } catch (error) {
    console.error('Client deletion failed: ', error);
    throw error;
  }
  redirect('/dashboard/clients');
}

export async function editVisits(
  clientId: number,
  formData: z.infer<typeof EditVisitsFormSchema>,
) {
  const { lastVisit, nextVisit, specialSchedule } = formData;

  const validatedFields = EditVisitsFormSchema.safeParse({
    lastVisit,
    nextVisit,
    specialSchedule,
  });

  // If any form fields are invalid, return early
  if (!validatedFields.success) {
    const errors = validatedFields.error.flatten().fieldErrors;
    console.log(errors);
    return {
      errors: errors,
    };
  } else {
    const { lastVisit, nextVisit, specialSchedule } = validatedFields.data;

    try {
      const result = await sql`
        UPDATE clients
        SET 
          next_visit = ${nextVisit}, 
          last_visit = ${lastVisit}, 
          maintenance_schedule = ${specialSchedule}
        WHERE id = ${clientId}
      `;

      revalidatePath(`/dashboard/clients/[id]`, 'page');
    } catch (error) {
      console.error('Visits edit failed: ', error);
    }
  }
}

export async function editInventory(
  clientId: number,
  formData: z.infer<typeof EditInventoryFormSchema>,
) {
  const {
    treadmill,
    elliptical,
    bike,
    stepper,
    strength,
    bench,
    spinner,
    rower,
    miscellaneous,
  } = formData;

  const validatedFields = EditInventoryFormSchema.safeParse({
    treadmill,
    elliptical,
    bike,
    stepper,
    strength,
    bench,
    spinner,
    rower,
    miscellaneous,
  });

  // If any form fields are invalid, return early
  if (!validatedFields.success) {
    const errors = validatedFields.error.flatten().fieldErrors;
    console.log(errors);
    return {
      errors: errors,
    };
  } else {
    const {
      treadmill,
      elliptical,
      bike,
      stepper,
      strength,
      bench,
      spinner,
      rower,
      miscellaneous,
    } = validatedFields.data;

    try {
      const inventoryExists = await getInventory(clientId);

      if (inventoryExists) {
        await sql`
          UPDATE inventory
          SET treadmill = ${treadmill},
            elliptical = ${elliptical},
            bike = ${bike},
            stepper = ${stepper},
            strength = ${strength},
            bench = ${bench},
            spinner = ${spinner},
            rower = ${rower},
            miscellaneous = ${miscellaneous}
          WHERE client_id = ${clientId}
        `;
      } else {
        await sql`
          INSERT INTO inventory (
            client_id,
            treadmill,
            elliptical,
            bike,
            stepper,
            strength,
            bench,
            spinner,
            rower,
            miscellaneous
          )
          VALUES (
            ${clientId},
            ${treadmill},
            ${elliptical},
            ${bike},
            ${stepper},
            ${strength},
            ${bench},
            ${spinner},
            ${rower},
            ${miscellaneous}
          )
        `;
      }

      revalidatePath(`/dashboard/clients/[id]`, 'page');
    } catch (error) {
      console.error('Inventory edit failed: ', error);
    }
  }
}

export async function updateClientStatus(
  clientId: number,
  status: string,
  type: ClientStatus['type'],
  note: ClientStatus['note'],
) {
  try {
    const statusExists =
      (await getClientStatus(clientId, type)).status != 'setStatus';

    if (statusExists) {
      await sql`
        UPDATE client_status
        SET client_id = ${clientId},
          status = ${status},
          type = ${type},
          note = ${note}
        WHERE client_id = ${clientId} AND type = ${type}
      `;
    } else {
      await sql`
        INSERT INTO client_status (client_id, status, type, note)
        VALUES (${clientId}, ${status}, ${type}, ${note})
      `;
    }

    revalidatePath(`/dashboard/clients/[id]`, 'page');
  } catch (error) {
    console.error('Status update failed: ', error);
  }
}

export async function updateIsMain(
  id: number,
  isMain: boolean,
  infoType: 'phone' | 'email',
) {
  try {
    if (infoType === 'phone') {
      const result = await sql`
        UPDATE contact_phone_numbers
        SET is_main = ${isMain}
        WHERE id = ${id}
      `;
    } else {
      const result = await sql`
      UPDATE contact_emails
      SET is_main = ${isMain}
      WHERE id = ${id}
    `;
    }

    revalidatePath(`/dashboard/clients/[id]`, 'page');
  } catch (error) {
    console.error('Is main contact detail update failed: ', error);
  }
}

export async function createForm(
  formName: string,
  fields: Optional<Field, 'id'>[],
) {
  try {
    const formResult = await sql`
      INSERT INTO forms (name)
      VALUES (${formName})
      RETURNING id
    `;

    const formId = formResult.rows[0].id;

    for (const field of fields) {
      const { label, type, defaultValue, options } = field;
      await sql`
        INSERT INTO form_fields (form_id, label, type, default_value, options)
        VALUES (
          ${formId},
          ${label},
          ${type},
          ${defaultValue || ''},
          ${options?.length ? options.join(',') : null}
        )
      `;
    }

    revalidatePath('/dashboard/forms', 'page');
  } catch (error) {
    console.error('Create form error:', error);
    throw error;
  }
  redirect('/dashboard/forms');
}

export async function editForm(
  formId: number,
  formName: string,
  fields: Optional<Field, 'id'>[],
) {
  try {
    const formResult = await sql`
      UPDATE forms
      SET name = ${formName}
      WHERE id = ${formId}
    `;

    await sql`
      DELETE FROM form_fields
      WHERE form_id = ${formId}
    `;

    for (const field of fields) {
      const { label, type, defaultValue, options } = field;
      await sql`
        INSERT INTO form_fields (form_id, label, type, default_value, options)
        VALUES (
          ${formId},
          ${label},
          ${type},
          ${defaultValue || ''},
          ${options?.length ? options.join(',') : null}
        )
      `;
    }

    revalidatePath('/dashboard/forms', 'page');
  } catch (error) {
    console.error('Create form error:', error);
    throw error;
  }
  redirect('/dashboard/forms');
}

export async function deleteForm(formId: number) {
  try {
    await sql`
      DELETE FROM forms
      WHERE id = ${formId}
    `;

    revalidatePath('/dashboard/forms', 'page');
  } catch (error) {
    console.error('Form deletion failed: ', error);
    throw error;
  }
  redirect('/dashboard/forms');
}

export async function submitFormResponse(
  formId: number,
  jobId: number,
  responseData: Record<string, any>,
) {
  try {
    const jsonString = JSON.stringify(responseData);
    const currentDateTime = new Date().toISOString();
    const user = await getCurrentUser();

    const result = await sql`
      INSERT INTO form_responses (
        form_id, 
        job_id, 
        response, 
        created_at, 
        user_id
      )
      VALUES (
        ${formId},
        ${jobId},
        ${jsonString}::jsonb,
        ${currentDateTime},
        ${user.id}
      )
      RETURNING id
    `;

    revalidatePath('/dashboard/jobs/[id]', 'page');
  } catch (error) {
    console.error('Submit form response error:', error);
    throw error;
  }
}

export async function deleteFormResponse(responseId: number) {
  try {
    await sql`
      DELETE FROM form_responses
      WHERE id = ${responseId}
    `;

    revalidatePath('/dashboard/jobs/[id]', 'page');
  } catch (error) {
    console.error('Form response deletion failed: ', error);
    throw error;
  }
}

export async function createQuote(
  clientId: number | null,
  taxId: number | null,
  lineItems: {
    name: string;
    description: string;
    quantity: number;
    unit_price: string;
    is_taxable: boolean;
  }[],
  noRedirect?: boolean,
) {
  let errors: string[] = [];

  if (!clientId) {
    errors.push('A client must be selected');
  }

  if (!lineItems || lineItems.length === 0) {
    errors.push('There must be a least 1 line item');
  }

  if (errors.length > 0) {
    return errors;
  }

  try {
    const DEFAULT_STATUS = 'in progress' as Quote['status'];
    const currentDateTime = new Date().toISOString();
    const managerId = (await getCurrentUser()).id;

    const quoteResult = await sql`
      INSERT INTO quotes (
        client_id, 
        user_id, 
        tax_id, 
        status, 
        date_created
      )
      VALUES (
        ${clientId}, 
        ${managerId}, 
        ${taxId}, 
        ${DEFAULT_STATUS}, 
        ${currentDateTime}
      )
      RETURNING id;
    `;

    const quoteId = quoteResult.rows[0].id;

    for (const lineItem of lineItems) {
      const unitPriceInCents =
        Number(lineItem.unit_price.replace(/[\$,]/g, '')) * 100;

      await sql`
        INSERT INTO line_items (
          quote_id, 
          name, 
          description, 
          quantity, 
          unit_price, 
          is_taxable
        )
        VALUES (
          ${quoteId},
          ${lineItem.name},
          ${lineItem.description},
          ${lineItem.quantity},
          ${unitPriceInCents},
          ${lineItem.is_taxable}
        );
      `;
    }

    revalidatePath('/dashboard/quotes', 'page');
    revalidatePath('/dashboard/jobs/[id]', 'page');
  } catch (error) {
    console.error('Quote creation failed: ', error);
  }
  if (noRedirect) return;
  redirect('/dashboard/quotes');
}

export async function editQuote(
  quoteId: number,
  clientId: number | null,
  taxId: number | null,
  managerId: number | null,
  lineItems: {
    name: string;
    description: string;
    quantity: number;
    unit_price: string;
    is_taxable: boolean;
  }[],
  noRedirect?: boolean,
) {
  let errors: string[] = [];

  if (!clientId) {
    errors.push('A client must be selected');
  }

  if (!lineItems || lineItems.length === 0) {
    errors.push('There must be a least 1 line item');
  }

  if (errors.length > 0) {
    return errors;
  }

  try {
    await sql`
      UPDATE quotes      
      SET client_id = ${clientId}, 
        tax_id = ${taxId},
        user_id = ${managerId}
      WHERE id = ${quoteId}
    `;

    await sql`
      DELETE FROM line_items
      WHERE quote_id = ${quoteId}
    `;

    for (const lineItem of lineItems) {
      const unitPriceInCents =
        Number(lineItem.unit_price.replace(/[\$,]/g, '')) * 100;

      await sql`
        INSERT INTO line_items (
          quote_id, 
          name, 
          description, 
          quantity, 
          unit_price, 
          is_taxable
        )
        VALUES (
          ${quoteId},
          ${lineItem.name},
          ${lineItem.description},
          ${lineItem.quantity},
          ${unitPriceInCents},
          ${lineItem.is_taxable}
        );
      `;
    }

    revalidatePath('/dashboard/quotes/[id]', 'page');
    revalidatePath('/dashboard/jobs/[id]', 'page');
  } catch (error) {
    console.error('Quote editing failed: ', error);
  }
  if (noRedirect) return;
  redirect(`/dashboard/quotes/${quoteId}`);
}

export async function createTax(values: z.infer<typeof CreateTaxFormSchema>) {
  const { taxName, taxRate } = values;
  const taxRateDecimal = Number(taxRate) / 100;

  try {
    await sql`
      INSERT into taxes (name, tax_rate)
      VALUES (${taxName}, ${taxRateDecimal})
    `;

    revalidatePath('/dashboard/quotes/create');
    revalidatePath('/dashboard/jobs/create');
  } catch (error) {
    console.error('Tax creation failed: ', error);
  }
}

export async function updateQuoteStatus(
  quoteId: number,
  status: Quote['status'],
) {
  try {
    await sql`
      UPDATE quotes
      SET status = ${status}
      WHERE id = ${quoteId}
    `;

    await addEntityActivity(quoteId, 'quote', `Quote marked as ${status}`);

    revalidatePath('/dashboard/quotes/[id]', 'page');
  } catch (error) {
    console.error('Quote status update failed: ', error);
  }
}

export async function updateQuoteSendState(
  quoteId: number,
  sendState: boolean,
) {
  try {
    if (sendState === true) {
      const currentDateTime = new Date().toISOString();

      await sql`
        UPDATE quotes
        SET date_sent = ${currentDateTime}
        WHERE id = ${quoteId}
      `;
    } else {
      await sql`
        UPDATE quotes
        SET date_sent = NULL
        WHERE id = ${quoteId}
      `;
    }

    await addEntityActivity(quoteId, 'quote', `Quote marked as ${status}`);

    revalidatePath('/dashboard/quotes/[id]', 'page');
  } catch (error) {
    console.error('Quote send status update failed: ', error);
  }
}

export async function deleteQuote(quoteId: number) {
  try {
    await sql`
      DELETE FROM quotes
      WHERE id = ${quoteId}
    `;

    revalidatePath('/dashboard/quotes', 'page');
  } catch (error) {
    console.error('Quote deletion failed: ', error);
    throw error;
  }
  redirect('/dashboard/quotes');
}

export async function addQuoteToJob(
  jobId: number,
  clientId: number | null,
  taxId: number | null,
  lineItems: {
    name: string;
    description: string;
    quantity: number;
    unit_price: string;
    is_taxable: boolean;
  }[],
) {
  let errors: string[] = [];

  if (!clientId) {
    errors.push('A client must be selected');
  }

  if (!lineItems || lineItems.length === 0) {
    errors.push('There must be a least 1 line item');
  }

  if (errors.length > 0) {
    return errors;
  }

  try {
    const DEFAULT_STATUS = 'in progress' as Quote['status'];
    const currentDateTime = new Date().toISOString();
    const managerId = (await getCurrentUser()).id;

    const quoteResult = await sql`
      INSERT INTO quotes (
        client_id, 
        user_id, 
        tax_id, 
        status, 
        date_created
      )
      VALUES (
        ${clientId}, 
        ${managerId}, 
        ${taxId}, 
        ${DEFAULT_STATUS}, 
        ${currentDateTime}
      )
      RETURNING id;
    `;

    const quoteId = quoteResult.rows[0].id;

    for (const lineItem of lineItems) {
      const unitPriceInCents =
        Number(lineItem.unit_price.replace(/[\$,]/g, '')) * 100;

      await sql`
        INSERT INTO line_items (
          quote_id, 
          name, 
          description, 
          quantity, 
          unit_price, 
          is_taxable
        )
        VALUES (
          ${quoteId},
          ${lineItem.name},
          ${lineItem.description},
          ${lineItem.quantity},
          ${unitPriceInCents},
          ${lineItem.is_taxable}
        );
      `;
    }

    await sql`
      UPDATE jobs
      SET quote_id = ${quoteId}
      WHERE id = ${jobId}
    `;

    revalidatePath('/dashboard/jobs/[id]', 'page');
  } catch (error) {
    console.error('Job edit failed: ', error);
  }
}

export async function createInvoice(
  noRedirect: boolean = false,
  clientId: number | null,
  quoteId: number | null,
  quoteData: QuoteFormData | null,
  prevState: CreateInvoiceFormState,
  formData: FormData,
): Promise<CreateInvoiceFormState> {
  const validatedFields = CreateInvoiceFormSchema.safeParse({
    title: formData.get('title'),
    paymentMethod: formData.get('paymentMethod'),
    notes: formData.get('notes'),
  });

  if (!validatedFields.success) {
    const errors = validatedFields.error.flatten().fieldErrors;
    console.log(errors);
    return {
      errors: errors,
    };
  } else {
    const { title, paymentMethod, notes } = validatedFields.data;

    try {
      const currentDateTime = new Date().toISOString();
      let errors: string[] = [];

      if (!clientId) {
        errors.push('A client must be selected');
      }

      if (quoteData) {
        if (!quoteData.lineItems || quoteData.lineItems.length === 0) {
          errors.push('There must be a least 1 line item');
        }

        if (errors.length > 0) {
          return { message: errors.toString() };
        }

        const DEFAULT_STATUS = 'in progress' as Quote['status'];
        const managerId = (await getCurrentUser()).id;

        const quoteResult = await sql`
          INSERT INTO quotes (
            client_id, 
            user_id, 
            tax_id, 
            status, 
            date_created
          )
          VALUES (
            ${clientId}, 
            ${managerId}, 
            ${quoteData.taxId}, 
            ${DEFAULT_STATUS}, 
            ${currentDateTime}
          )
          RETURNING id;
        `;

        quoteId = quoteResult.rows[0].id;

        for (const lineItem of quoteData.lineItems) {
          const unitPriceInCents =
            Number(lineItem.unit_price.replace(/[\$,]/g, '')) * 100;

          await sql`
            INSERT INTO line_items (
              quote_id, 
              name, 
              description, 
              quantity, 
              unit_price, 
              is_taxable
            )
            VALUES (
              ${quoteId},
              ${lineItem.name},
              ${lineItem.description},
              ${lineItem.quantity},
              ${unitPriceInCents},
              ${lineItem.is_taxable}
            );
          `;
        }
      }

      if (!quoteId) {
        const DEFAULT_STATUS = 'in progress' as Quote['status'];
        const managerId = (await getCurrentUser()).id;

        const quoteResult = await sql`
        INSERT INTO quotes (
          client_id, 
          user_id, 
          tax_id, 
          status, 
          date_created
        )
        VALUES (
          ${clientId}, 
          ${managerId}, 
          ${null}, 
          ${DEFAULT_STATUS}, 
          ${currentDateTime}
        )
        RETURNING id;
      `;

        quoteId = quoteResult.rows[0].id;

        await sql`
          INSERT INTO line_items (
            quote_id, 
            name, 
            description, 
            quantity, 
            unit_price, 
            is_taxable
          )
          VALUES (
            ${quoteId},
            'Empty line item',
            '',
            0,
            0,
            ${false}
          );
        `;
      } else {
        if (errors.length > 0) {
          return { message: errors.toString() };
        }
      }

      const invoiceResult = await sql`
        INSERT INTO invoices (
          client_id,
          quote_id,
          title,
          payment_method,
          notes,
          date_created
        )
        VALUES (
          ${clientId},
          ${quoteId},
          ${title},
          ${paymentMethod},
          ${notes},
          ${currentDateTime}
        )
      `;

      revalidatePath('/dashboard/invoices', 'page');
    } catch (error) {
      console.error('Invoice creation failed: ', error);
      throw error;
    }
    if (noRedirect) return;
    redirect('/dashboard/invoices');
  }
}

export async function updateInvoice(
  invoiceId: number,
  clientId: number | null,
  quoteId: number,
  quoteData: QuoteFormData | null,
  prevState: CreateInvoiceFormState,
  formData: FormData,
): Promise<CreateInvoiceFormState> {
  const validatedFields = CreateInvoiceFormSchema.safeParse({
    title: formData.get('title'),
    paymentMethod: formData.get('paymentMethod'),
    notes: formData.get('notes'),
  });

  if (!validatedFields.success) {
    const errors = validatedFields.error.flatten().fieldErrors;
    console.log(errors);
    return {
      errors: errors,
    };
  } else {
    const { title, paymentMethod, notes } = validatedFields.data;

    try {
      const currentDateTime = new Date().toISOString();
      let errors: string[] = [];

      if (!clientId) {
        errors.push('A client must be selected');
      }

      if (quoteData) {
        if (!quoteData.lineItems || quoteData.lineItems.length === 0) {
          errors.push('There must be a least 1 line item');
        }

        if (errors.length > 0) {
          return { message: errors.toString() };
        }

        const DEFAULT_STATUS = 'in progress' as Quote['status'];
        const managerId = (await getCurrentUser()).id;

        const quoteResult = await sql`
          UPDATE quotes 
          SET 
            client_id = ${clientId},
            user_id = ${managerId},
            tax_id = ${quoteData.taxId},
            status = ${DEFAULT_STATUS},
            date_created = ${currentDateTime}
          WHERE id = ${quoteId}
        `;

        const deletePrevLineItems = await sql`
          DELETE FROM line_items
          WHERE quote_id = ${quoteId}
        `;

        for (const lineItem of quoteData.lineItems) {
          const unitPriceInCents =
            Number(lineItem.unit_price.replace(/[\$,]/g, '')) * 100;

          await sql`
            INSERT INTO line_items (
              quote_id, 
              name, 
              description, 
              quantity, 
              unit_price, 
              is_taxable
            )
            VALUES (
              ${quoteId},
              ${lineItem.name},
              ${lineItem.description},
              ${lineItem.quantity},
              ${unitPriceInCents},
              ${lineItem.is_taxable}
            );
          `;
        }

        await addEntityActivity(
          invoiceId,
          'invoice',
          'Invoice line items updated',
        );
      } else {
        if (errors.length > 0) {
          return { message: errors.toString() };
        }
      }

      // When invoice is updated set is_pending to false
      // since payment method has been set
      const invoiceResult = await sql`
        UPDATE invoices 
        SET 
          client_id = ${clientId},
          quote_id = ${quoteId},
          title = ${title},
          payment_method = ${paymentMethod},
          notes = ${notes},
          is_pending = ${false},
          date_created = ${currentDateTime}
        WHERE id = ${invoiceId}
      `;

      await addEntityActivity(invoiceId, 'invoice', 'Invoice edited');

      revalidatePath('/dashboard/invoices', 'page');
    } catch (error) {
      console.error('Invoice creation failed: ', error);
    }
    redirect('/dashboard/invoices');
  }
}

export async function updateInvoiceSendState(
  invoiceId: number,
  sendState: boolean,
) {
  try {
    if (sendState === true) {
      const currentDateTime = new Date().toISOString();

      // When invoice is marked as sent, set is_pending to false
      await sql`
        UPDATE invoices
        SET 
          date_sent = ${currentDateTime}, 
          is_pending = ${false}
        WHERE id = ${invoiceId}
      `;

      await addEntityActivity(invoiceId, 'invoice', 'Invoice marked as sent');
    } else {
      await sql`
        UPDATE invoices
        SET date_sent = NULL
        WHERE id = ${invoiceId}
      `;

      await addEntityActivity(invoiceId, 'invoice', 'Invoice marked as unsent');
    }

    revalidatePath('/dashboard/invoices/[id]', 'page');
  } catch (error) {
    console.error('Invoice send status update failed: ', error);
  }
}

export async function deleteInvoice(id: number) {
  try {
    const result = await sql`
      DELETE FROM invoices WHERE id = ${id}
    `;

    revalidatePath('/dashboard/invoices', 'page');
  } catch (error) {
    console.error('Invoice deletion failed: ', error);
    throw error;
  }
  redirect('/dashboard/invoices');
}

export async function createDraftInvoice(
  clientId: number | null,
  quoteId: number | null,
  title: string,
) {
  try {
    const currentDateTime = new Date().toISOString();

    if (!quoteId) {
      const DEFAULT_STATUS = 'in progress' as Quote['status'];
      const managerId = (await getCurrentUser()).id;

      const quoteResult = await sql`
      INSERT INTO quotes (
        client_id, 
        user_id, 
        tax_id, 
        status, 
        date_created
      )
      VALUES (
        ${clientId}, 
        ${managerId}, 
        ${null}, 
        ${DEFAULT_STATUS}, 
        ${currentDateTime}
      )
      RETURNING id;
    `;

      quoteId = quoteResult.rows[0].id;

      await sql`
        INSERT INTO line_items (
          quote_id, 
          name, 
          description, 
          quantity, 
          unit_price, 
          is_taxable
        )
        VALUES (
          ${quoteId},
          'Empty line item',
          '',
          0,
          0,
          ${false}
        );
      `;
    }

    const paymentMethod =
      (
        await sql`
          SELECT status FROM client_status
          WHERE client_id = ${clientId} AND type = 'billing'
        `
      ).rows[0]?.status === 'creditCardOnly'
        ? 'creditCard'
        : '';

    const invoiceResult = await sql`
      INSERT INTO invoices (
        client_id,
        quote_id,
        title,
        payment_method,
        is_pending,
        date_created
      )
      VALUES (
        ${clientId},
        ${quoteId},
        ${title},
        ${paymentMethod},
        ${true},
        ${currentDateTime}
      )
    `;

    revalidatePath('/dashboard/jobs/[id]', 'page');
  } catch (error) {
    console.error('Invoice draft creation failed: ', error);
  }
}

export async function addEmail(
  entity_id: number,
  entity: string,
  uuid: string,
  sender: string,
  recipient: string,
  subject: string,
  text: string,
) {
  const currentDateTime = new Date().toISOString();
  try {
    await sql`
      INSERT INTO emails (
        id, 
        entity_id, 
        entity, 
        sender, 
        recipient,
        subject,
        text,
        created_at
      )
      VALUES (
        ${uuid},
        ${entity_id},
        ${entity},
        ${sender},
        ${recipient},
        ${subject},
        ${text},
        ${currentDateTime}
      )
    `;

    revalidatePath('/dashboard/quotes/messages/[id]', 'page');
  } catch (error) {
    console.error('Email addition to db failed: ', error);
    throw error;
  }
}

export async function addEntityActivity(
  entityId: number,
  entity: string,
  activity: string,
) {
  try {
    const currentUser = await getCurrentUser();
    const currentDateTime = new Date().toISOString();
    const result = await sql`
      INSERT INTO entity_activity (
        entity_id, 
        user_id, 
        entity, 
        activity, 
        date
      )
      VALUES (
        ${entityId}, 
        ${currentUser.id}, 
        ${entity}, 
        ${activity}, 
        ${currentDateTime}
      )
    `;
  } catch (error) {
    console.error('Activity creation failed: ', error);
  }
}

export async function createTemplateLineItem(
  values: z.infer<typeof CreateTemplateLineItemFormSchema>,
) {
  try {
    const { name, description, unitPrice, isTaxable } = values;
    const unitPriceInCents = priceToCents(unitPrice, false);

    await sql`
      INSERT INTO template_line_items (
        name,
        description,
        quantity,
        unit_price,
        is_taxable
      )
      VALUES (
        ${name.trim()},
        ${description?.trim()},
        ${1},
        ${unitPriceInCents},
        ${isTaxable}
      )
    `;
    revalidatePath('/dashboard/quotes/create', 'page');
  } catch (error) {
    console.error('Template line item creation failed: ', error);
  }
}
