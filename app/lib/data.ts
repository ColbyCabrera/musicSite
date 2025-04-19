'use server';

import {
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
  LatestInvoiceRaw,
  User,
  Revenue,
  CalendarEvent,
  TeamMember,
  Client,
  ClientActivity,
  Note,
  Bill,
  Inventory,
  Equipment,
  ClientStatus,
  JobData,
  LabeledResponseEntry,
  LabeledResponse,
  FormWithFields,
  JobForm,
  FieldType,
  Quote,
  Tax,
  LineItem,
  Email,
  Invoice,
  EntityActivity,
  TemplateLineItem,
} from './definitions';
import { sql } from '@vercel/postgres';
import { formatCurrency } from './utils';
import { auth } from '../api/auth/[...nextauth]/auth';
import { unstable_noStore as noStore } from 'next/cache';

export async function fetchRevenue() {
  noStore();

  try {
    const data = await sql<Revenue>`SELECT * FROM revenue`;

    return data.rows;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch revenue data.');
  }
}

export async function fetchLatestInvoices() {
  noStore();
  try {
    const data = await sql<LatestInvoiceRaw>`
      SELECT invoices.amount, customers.name, customers.image_url, customers.email, invoices.id
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      ORDER BY invoices.date DESC
      LIMIT 5`;

    const latestInvoices = data.rows.map((invoice) => ({
      ...invoice,
      amount: formatCurrency(invoice.amount),
    }));
    return latestInvoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch the latest invoices.');
  }
}

export async function fetchCardData() {
  noStore();
  try {
    // You can probably combine these into a single SQL query
    // However, we are intentionally splitting them to demonstrate
    // how to initialize multiple queries in parallel with JS.
    const invoiceCountPromise = sql`SELECT COUNT(*) FROM invoices`;
    const customerCountPromise = sql`SELECT COUNT(*) FROM customers`;
    const invoiceStatusPromise = sql`SELECT
         SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS "paid",
         SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS "pending"
         FROM invoices`;

    const data = await Promise.all([
      invoiceCountPromise,
      customerCountPromise,
      invoiceStatusPromise,
    ]);

    const numberOfInvoices = Number(data[0].rows[0].count ?? '0');
    const numberOfCustomers = Number(data[1].rows[0].count ?? '0');
    const totalPaidInvoices = formatCurrency(data[2].rows[0].paid ?? '0');
    const totalPendingInvoices = formatCurrency(data[2].rows[0].pending ?? '0');

    return {
      numberOfCustomers,
      numberOfInvoices,
      totalPaidInvoices,
      totalPendingInvoices,
    };
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch card data.');
  }
}

const ITEMS_PER_PAGE = 6;
export async function fetchFilteredInvoices(
  query: string,
  currentPage: number,
) {
  noStore();
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  try {
    const invoices = await sql<InvoicesTable>`
      SELECT
        invoices.id,
        invoices.amount,
        invoices.date,
        invoices.status,
        customers.name,
        customers.email,
        customers.image_url
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      WHERE
        customers.name ILIKE ${`%${query}%`} OR
        customers.email ILIKE ${`%${query}%`} OR
        invoices.amount::text ILIKE ${`%${query}%`} OR
        invoices.date::text ILIKE ${`%${query}%`} OR
        invoices.status ILIKE ${`%${query}%`}
      ORDER BY invoices.date DESC
      LIMIT ${ITEMS_PER_PAGE} OFFSET ${offset}
    `;

    return invoices.rows;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoices.');
  }
}

export async function fetchInvoicesPages(query: string) {
  noStore();
  try {
    const count = await sql`SELECT COUNT(*)
    FROM invoices
    JOIN customers ON invoices.customer_id = customers.id 
    WHERE
      customers.name ILIKE ${`%${query}%`} OR
      customers.email ILIKE ${`%${query}%`} OR
      invoices.amount::text ILIKE ${`%${query}%`} OR
      invoices.date::text ILIKE ${`%${query}%`} OR
      invoices.status ILIKE ${`%${query}%`}
  `;

    const totalPages = Math.ceil(Number(count.rows[0].count) / ITEMS_PER_PAGE);
    return totalPages;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch total number of invoices.');
  }
}

export async function fetchInvoiceById(id: string) {
  noStore();
  try {
    const data = await sql<InvoiceForm>`
      SELECT
        invoices.id,
        invoices.customer_id,
        invoices.amount,
        invoices.status
      FROM invoices
      WHERE invoices.id = ${id};
    `;

    const invoice = data.rows.map((invoice) => ({
      ...invoice,
      // Convert amount from cents to dollars
      amount: invoice.amount / 100,
    }));

    return invoice[0];
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoice.');
  }
}

export async function fetchCustomers() {
  noStore();
  try {
    const data = await sql<CustomerField>`
      SELECT
        id,
        name
      FROM customers
      ORDER BY name ASC
    `;

    const customers = data.rows;
    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch all customers.');
  }
}

export async function fetchFilteredCustomers(query: string) {
  noStore();
  try {
    const data = await sql<CustomersTableType>`
		SELECT
		  customers.id,
		  customers.name,
		  customers.email,
		  customers.image_url,
		  COUNT(invoices.id) AS total_invoices,
		  SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending,
		  SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid
		FROM customers
		LEFT JOIN invoices ON customers.id = invoices.customer_id
		WHERE
		  customers.name ILIKE ${`%${query}%`} OR
        customers.email ILIKE ${`%${query}%`}
		GROUP BY customers.id, customers.name, customers.email, customers.image_url
		ORDER BY customers.name ASC
	  `;

    const customers = data.rows.map((customer) => ({
      ...customer,
      total_pending: formatCurrency(customer.total_pending),
      total_paid: formatCurrency(customer.total_paid),
    }));

    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch customer table.');
  }
}

export async function getUsers() {
  noStore();

  try {
    const result = await sql<User>`
      SELECT * FROM users
    `;
    return result.rows;
  } catch (error) {
    console.error('Failed to fetch users:', error);
    throw new Error('Failed to fetch users.');
  }
}

export async function getUsersByEmail(email: string) {
  try {
    if (email.charAt(0) === '[') {
      let parsedEmails = JSON.parse(email);
      let users: User[] = [];

      await Promise.all(
        parsedEmails.map(async (email: string) => {
          const result = await sql`SELECT * FROM users WHERE email = ${email}`;
          if (result.rows[0] != undefined) {
            users.push(result.rows[0] as User);
          }
        }),
      );

      return users;
    } else {
      const user = await sql`SELECT * FROM users WHERE email=${email}`;
      return user.rows[0] as User;
    }
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw new Error('Failed to fetch user.');
  }
}

export async function getUsersByName(name: string) {
  try {
    if (name.charAt(0) === '[') {
      let parsedNames = JSON.parse(name);
      let users: User[] = [];

      await Promise.all(
        parsedNames.map(async (name: string) => {
          const result = await sql`SELECT * FROM users WHERE name = ${name}`;
          if (result.rows[0] != undefined) {
            users.push(result.rows[0] as User);
          }
        }),
      );

      return users;
    } else {
      const user = await sql`SELECT * FROM users WHERE name=${name}`;
      return user.rows[0] as User;
    }
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw new Error('Failed to fetch user.');
  }
}

export async function getUserById(id: string) {
  noStore();

  try {
    const user = await sql`SELECT * FROM users WHERE id = ${id};`;
    return user.rows[0] as User;
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw new Error('Failed to fetch user.');
  }
}

export async function getCurrentUser() {
  const session = await auth();
  let userId = '-1';
  if (session?.user?.id) userId = session.user.id;
  try {
    const user = await getUserById(userId);
    return user;
  } catch (error) {
    console.error('Failed to fetch current user:', error);
    throw new Error('Failed to fetch current user');
  }
}

export async function getCalendarItems() {
  noStore();
  try {
    const currentUser = await getCurrentUser();
    const isAdmin = currentUser.role === 'ADMIN';
    let data;

    if (isAdmin) {
      data = await sql<CalendarEvent>`
        SELECT
          calendar_items.*,
          jobs.id AS job_id,
          jobs.status as job_status,
          COALESCE(jobs.title, events.title) AS title,
          COALESCE(jobs.instructions, events.description) AS description,
          array_agg(users.name) AS names,
          array_agg(users.color) AS colors
        FROM
          calendar_items
        LEFT JOIN jobs ON calendar_items.job_id = jobs.id
        LEFT JOIN events ON calendar_items.event_id = events.id
        LEFT JOIN job_users ON calendar_items.job_id = job_users.job_id
        LEFT JOIN event_users ON calendar_items.event_id = event_users.event_id
        LEFT JOIN users ON users.id = COALESCE(job_users.user_id, event_users.user_id)
        GROUP BY
          calendar_items.id,
          jobs.id,
          events.id
      `;
    } else {
      // Get only jobs tech is associated with and get all events
      data = await sql<CalendarEvent>`
        SELECT
          calendar_items.*,
          jobs.id AS job_id,
          jobs.status as job_status,
          COALESCE(jobs.title, events.title) AS title,
          COALESCE(jobs.instructions, events.description) AS description,
          array_agg(users.name) AS names,
          array_agg(users.color) AS colors
        FROM
          calendar_items
        LEFT JOIN jobs ON calendar_items.job_id = jobs.id
        LEFT JOIN events ON calendar_items.event_id = events.id
        LEFT JOIN job_users ON calendar_items.job_id = job_users.job_id
        LEFT JOIN event_users ON calendar_items.event_id = event_users.event_id
        LEFT JOIN users ON users.id = COALESCE(job_users.user_id, event_users.user_id)
        WHERE events.id IS NOT NULL
          OR job_users.user_id = ${currentUser.id}
        GROUP BY
          calendar_items.id,
          jobs.id,
          events.id
      `;
    }

    return data.rows;
  } catch (error) {
    console.error('Failed to fetch calendar items:', error);
    throw new Error('Failed to fetch calendar items');
  }
}

export async function getJobData(jobId: number) {
  noStore();
  try {
    const jobResult = await sql`
      SELECT 
        calendar_items.*,
        jobs.*,
        array_agg(users.name) AS names,
        array_agg(users.color) AS colors
      FROM
        calendar_items
      LEFT JOIN jobs ON calendar_items.job_id = jobs.id
      LEFT JOIN job_users ON calendar_items.job_id = job_users.job_id
      LEFT JOIN users ON users.id = job_users.user_id
      WHERE calendar_items.job_id = ${jobId}
      GROUP BY calendar_items.id, jobs.id
    `;

    const jobFormsResult = await sql<JobForm>`
      SELECT id, name FROM forms
      WHERE id IN (
        SELECT form_id FROM job_forms
        WHERE job_id = ${jobId}
      )
    `;

    const jobData = jobResult.rows[0];
    jobData.jobForms = jobFormsResult.rows;

    return jobData as JobData;
  } catch (error) {
    console.error('Get job data failed: ', error);
    throw error;
  }
}

const JOBS_PER_PAGE = 20;
export async function getFilteredJobs(
  query: string,
  currentPage: number,
  jobTypes: string,
) {
  noStore();
  const offset = (currentPage - 1) * JOBS_PER_PAGE;

  // Replace space with % for wildcard search
  query = query.replace(' ', '%');

  // Convert into a Postgres array literal: Ex. {service,site visit}
  const jobTypesLiteral = `{${jobTypes}}`;

  try {
    const result = await sql<JobData>`
      SELECT
        calendar_items.*,
        jobs.*,
        array_agg(users.name) AS names,
        array_agg(users.color) AS colors
      FROM
        calendar_items
      LEFT JOIN jobs ON calendar_items.job_id = jobs.id
      LEFT JOIN job_users ON calendar_items.job_id = job_users.job_id
      LEFT JOIN users ON users.id = job_users.user_id
      WHERE calendar_items.job_id IS NOT NULL
        AND jobs.title ILIKE ${`%${query}%`}
        AND (
          ${jobTypesLiteral} = '{}'
          OR jobs.job_type = ANY(${jobTypesLiteral}::text[])
        )
      GROUP BY calendar_items.id, jobs.id
      ORDER BY 
        calendar_items.start_date DESC,
        date_created DESC
      LIMIT ${JOBS_PER_PAGE} OFFSET ${offset};
    `;

    return result.rows;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch jobs.');
  }
}

export async function getJobPages(query: string, jobTypes: string) {
  noStore();
  query = query.replace(' ', '%');
  const jobTypesLiteral = `{${jobTypes}}`;

  try {
    const count = await sql`
      SELECT COUNT(DISTINCT jobs.id) FROM jobs
      WHERE jobs.title ILIKE ${`%${query}%`}
        AND (
          ${jobTypesLiteral} = '{}'
          OR jobs.job_type = ANY(${jobTypesLiteral}::text[])
        )
    `;

    const totalPages = Math.ceil(Number(count.rows[0].count) / JOBS_PER_PAGE);

    return totalPages;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch total number of jobs.');
  }
}

export async function getJobsByClientId(clientId: number) {
  noStore();

  try {
    const result = await sql<JobData>`
      SELECT
        calendar_items.*,
        jobs.*,
        array_agg(u.name) AS names,
        array_agg(u.color) AS colors,
        COALESCE(
          (
            SELECT
              json_agg(
                activity_data ORDER BY (activity_data->>'date') DESC
              )
            FROM (
              SELECT DISTINCT
                jsonb_build_object(
                  'id', ea.id,
                  'user_id', ea.user_id,
                  'username', u_ea.name,
                  'entity_id', ea.entity_id,
                  'entity', ea.entity,
                  'activity', ea.activity,
                  'date', ea.date
                ) AS activity_data
              FROM entity_activity ea
              LEFT JOIN users u_ea ON ea.user_id = u_ea.id
              WHERE ea.entity_id = jobs.id
                AND ea.entity = 'job'
            ) AS distinct_activities
          ),
          '[]'
        ) AS activity
      FROM calendar_items
      LEFT JOIN jobs ON calendar_items.job_id = jobs.id
      LEFT JOIN job_users ON calendar_items.job_id = job_users.job_id
      LEFT JOIN users u ON u.id = job_users.user_id
      LEFT JOIN entity_activity ea
          ON ea.entity_id = jobs.id
          AND ea.entity = 'job'
      LEFT JOIN users u_ea ON ea.user_id = u_ea.id
      WHERE jobs.client_id = ${clientId}
        AND calendar_items.job_id IS NOT NULL
      GROUP BY calendar_items.id, jobs.id
      ORDER BY calendar_items.start_date DESC
    `;

    return result.rows;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch jobs.');
  }
}

export async function getEventData(id: number) {
  noStore();
  try {
    const data = await sql<CalendarEvent>`
      SELECT
        calendar_items.*,
        events.*,
        array_agg(users.name) AS names,
        array_agg(users.color) AS colors
      FROM
        calendar_items
      LEFT JOIN events ON calendar_items.event_id = events.id
      LEFT JOIN event_users ON calendar_items.event_id = event_users.event_id
      LEFT JOIN users ON users.id = event_users.user_id
      WHERE calendar_items.event_id = ${id}
      GROUP BY calendar_items.id, events.id
    `;

    return data.rows[0];
  } catch (error) {
    console.error('Failed to fetch event:', error);
    throw new Error('Failed to fetch event');
  }
}

export async function getTeamMembers() {
  noStore();
  try {
    const data = await sql<TeamMember>`
    SELECT name
    FROM users;  
  `;
    return data.rows;
  } catch (error) {
    console.error('Failed to fetch team members:', error);
    throw new Error('Failed to fetch team members');
  }
}

export async function getClients() {
  noStore();
  let result = await sql<Client>`
    SELECT 
      clients.*,
      COALESCE(
          json_agg(
            jsonb_build_object(
              'id', p.id,
              'client_id', p.client_id,
              'country', p.country,
              'state', p.state,
              'city', p.city,
              'zip', p.zip,
              'street_1', p.street_1,
              'street_2', p.street_2,
              'operating_hours', p.operating_hours
            )
          ) FILTER (WHERE p.id IS NOT NULL), 
        '[]'
      ) AS properties,
      COALESCE(
        json_agg(
          jsonb_build_object(
            'id', c.id,
            'client_id', c.client_id,
            'name', c.name,            
            'phone', c.phone,
            'email', c.email
          )
        ) FILTER (WHERE c.id IS NOT NULL),
        '[]'
      ) AS contacts
    FROM clients
    LEFT JOIN properties p ON clients.id = p.client_id
    LEFT JOIN contacts c ON clients.id = c.client_id
    GROUP BY clients.id
  `;
  return result.rows;
}

export async function getClientById(id: number) {
  noStore();
  try {
    const result = await sql<Client>`
    SELECT clients.*,
      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object(
            'id', p.id,
            'client_id', p.client_id,
            'country', p.country,
            'state', p.state,
            'city', p.city,
            'zip', p.zip,
            'street_1', p.street_1,
            'street_2', p.street_2,
            'operating_hours', p.operating_hours
          )
        ) FILTER (WHERE p.id IS NOT NULL), 
      '[]'
      ) AS properties,
      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object(
            'id', c.id,
            'client_id', c.client_id,
            'name', c.name,            
            'position', c.position,
            'emails', (
              SELECT json_agg(jsonb_build_object(
                'id', ce.id,
                'email', ce.email,
                'is_main', ce.is_main
              ) ORDER BY ce.is_main DESC, ce.id)
              FROM contact_emails ce
              WHERE ce.contact_id = c.id
            ),
            'phone_numbers', (
              SELECT json_agg(jsonb_build_object(
                'id', cn.id,
                'phone_number', cn.phone_number,
                'is_main', cn.is_main
              ) ORDER BY cn.is_main DESC, cn.id)
              FROM contact_phone_numbers cn
              WHERE cn.contact_id = c.id
            )
          )
        ) FILTER (WHERE c.id IS NOT NULL),
      '[]'
      ) AS contacts
    FROM clients
    LEFT JOIN properties p ON clients.id = p.client_id
    LEFT JOIN contacts c ON clients.id = c.client_id
    LEFT JOIN contact_phone_numbers cn ON c.id = cn.contact_id
    LEFT JOIN contact_emails ce ON c.id = ce.contact_id
    WHERE clients.id = ${id}      
    GROUP BY clients.id;
  `;

    return result.rows[0];
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch client.');
  }
}

const CLIENTS_PER_PAGE = 20;
export async function getFilteredClients(
  query: string,
  currentPage: number,
  tags: string,
  accountManager: string,
) {
  noStore();
  const offset = (currentPage - 1) * CLIENTS_PER_PAGE;

  query = query.replace(' ', '%');
  tags = tags.replace(',', '%');

  try {
    const result = await sql<Client>`
      WITH LatestActivity AS (
        SELECT client_id, MAX(date) as max_date
        FROM client_activity
        GROUP BY client_id
      ), EmailAgg AS (
        -- 1. Aggregate emails per contact_id FIRST
        SELECT
          contact_id,
            jsonb_agg(
              jsonb_build_object(
                'id', ce.id,
                'email', ce.email,
                'is_main', ce.is_main
              ) ORDER BY ce.is_main DESC, ce.id
          ) AS emails_json
        FROM contact_emails ce
        GROUP BY contact_id
      ), PhoneAgg AS (
        -- 2. Aggregate phone numbers per contact_id FIRST
        SELECT
          contact_id,
          jsonb_agg(
            jsonb_build_object(
              'id', cn.id,
              'phone_number', cn.phone_number,
              'is_main', cn.is_main
            ) ORDER BY cn.is_main DESC, cn.id
          ) AS phones_json
        FROM contact_phone_numbers cn
        GROUP BY contact_id
      ), ContactAgg AS (
        -- 3. Build contact objects (joining pre-aggregated emails/phones) and aggregate per client_id
        SELECT
          c.client_id,
            jsonb_agg(
              jsonb_build_object(
                'id', c.id,
                'client_id', c.client_id,
                'name', c.name,
                'position', c.position,
                'emails', COALESCE(ea.emails_json, '[]'::jsonb), -- Join pre-aggregated emails
                'phone_numbers', COALESCE(pa.phones_json, '[]'::jsonb) -- Join pre-aggregated phones
              )
            ) AS contacts_json
        FROM contacts c
        LEFT JOIN EmailAgg ea ON c.id = ea.contact_id -- Efficient join to aggregated emails
        LEFT JOIN PhoneAgg pa ON c.id = pa.contact_id -- Efficient join to aggregated phones
        GROUP BY c.client_id
      ), PropertyAgg AS (
        -- 4. Aggregate properties per client_id
        SELECT
          p.client_id,
            jsonb_agg(
                jsonb_build_object(
                    'id', p.id,
                    'client_id', p.client_id,
                    'country', p.country,
                    'state', p.state,
                    'city', p.city,
                    'zip', p.zip,
                    'street_1', p.street_1,
                    'street_2', p.street_2,
                    'operating_hours', p.operating_hours
                )
                -- Optional: ORDER BY p.id
            ) AS properties_json
        FROM properties p
        GROUP BY p.client_id
      ), ActivityAgg AS (
        -- 5. Aggregate activities per client_id
        SELECT
          a.client_id,
          jsonb_agg(
            jsonb_build_object(
                'activity', a.activity,
                'date', a.date
            )
            ORDER BY a.date DESC 
        ) AS activities_json
        FROM client_activity a
        GROUP BY a.client_id
      ), FilteredClients AS (
        -- 6. Identify distinct client IDs matching the WHERE clause conditions early
        -- Only join tables needed for filtering conditions
        SELECT DISTINCT clients.id
        FROM clients
        LEFT JOIN properties p_filter ON clients.id = p_filter.client_id -- Alias for filtering join
        LEFT JOIN contacts c_filter ON clients.id = c_filter.client_id   -- Alias for filtering join
        WHERE (clients.company_name ILIKE ${`%${query}%`}
                OR p_filter.street_1 ILIKE ${`%${query}%`} -- Use alias
                OR c_filter.name ILIKE ${`%${query}%`})      -- Use alias
          AND clients.tags ILIKE ${`%${tags}%`}
          AND clients.account_manager ILIKE ${`%${accountManager}%`}
      )
      -- Final SELECT: Join clients (filtered) with pre-aggregated data
      SELECT
        clients.*,
        COALESCE(pa.properties_json, '[]'::jsonb) AS properties,
        COALESCE(ca.contacts_json, '[]'::jsonb) AS contacts,
        COALESCE(aa.activities_json, '[]'::jsonb) AS activities,
        la.max_date
      FROM clients
      -- INNER JOIN to only include clients matching the filter criteria
      INNER JOIN FilteredClients fc ON clients.id = fc.id
      -- LEFT JOIN the pre-aggregated data for these filtered clients
      LEFT JOIN PropertyAgg pa ON clients.id = pa.client_id
      LEFT JOIN ContactAgg ca ON clients.id = ca.client_id
      LEFT JOIN ActivityAgg aa ON clients.id = aa.client_id
      LEFT JOIN LatestActivity la ON clients.id = la.client_id
      ORDER BY la.max_date DESC NULLS LAST
      LIMIT ${CLIENTS_PER_PAGE} OFFSET ${offset};
    `;

    return result.rows;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch clients.');
  }
}

export async function getClientsPages(
  query: string,
  tags: string,
  accountManager: string,
) {
  noStore();

  query = query.replace(' ', '%');
  tags = tags.replace(',', '%');

  try {
    const count = await sql`
      SELECT COUNT(*)
      FROM clients
        LEFT JOIN properties p ON clients.id = p.client_id
      WHERE (clients.company_name ILIKE ${`%${query}%`}
        OR p.street_1 ILIKE ${`%${query}%`})
        AND clients.tags ILIKE ${`%${tags}%`}
        AND clients.account_manager ILIKE ${`%${accountManager}%`}
    `;

    const totalPages = Math.ceil(
      Number(count.rows[0].count) / CLIENTS_PER_PAGE,
    );

    return totalPages;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch total number of clients.');
  }
}

export async function getClientTags() {
  noStore();
  try {
    const result = await sql`
      SELECT DISTINCT tags
      FROM clients
    `;

    // Use set to only add unique values
    const tags = new Set();

    result.rows.forEach((row) => {
      if (row.tags != null && row.tags != '') {
        const tagsArray = row.tags.split(',');
        tagsArray.forEach((tag: string) => tags.add(tag));
      }
    });

    return Array.from(tags) as string[];
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch tags.');
  }
}

export async function getAccountManagers() {
  noStore();
  try {
    const result = await sql<{ account_manager: string }>`
      SELECT DISTINCT account_manager
      FROM clients
    `;

    return result.rows.reduce((filtered: string[], row) => {
      if (row.account_manager) filtered.push(row.account_manager);
      return filtered;
    }, []);
  } catch (error) {
    console.error('Account manager fetching failed: ', error);
    throw new Error('Failed to fetch account managers.');
  }
}

export async function getClientActivity(clientId: number, limit = 100) {
  noStore();
  try {
    const result = await sql<ClientActivity>`
      SELECT * FROM client_activity
      WHERE client_id = ${clientId}
      ORDER BY date DESC
      LIMIT ${limit}
    `;
    return result.rows;
  } catch (error) {
    console.error('Activity fetching failed: ', error);
    throw new Error('Failed to fetch activity.');
  }
}

export async function getLastClientActivity(clientId: number) {
  noStore();
  try {
    const result = await sql<ClientActivity>`
      SELECT * FROM client_activity
      WHERE client_id = ${clientId}
      ORDER BY date DESC
      LIMIT 1
    `;

    return result.rows[0];
  } catch (error) {
    console.error('Activity fetching failed: ', error);
    throw new Error('Failed to fetch activity.');
  }
}

export async function getNotes(
  entity: string,
  entityId: number,
  visibility: 'public' | 'internal',
) {
  noStore();
  try {
    const result = await sql<Note>`
      SELECT * FROM notes
      WHERE entity_id = ${entityId}
        AND entity LIKE ${entity}
        AND visibility LIKE ${visibility}
      ORDER BY date_created ASC
    `;

    return result.rows;
  } catch (error) {
    console.error('Notes fetching failed: ', error);
    throw new Error('Failed to fetch notes.');
  }
}

export async function getBillingHistory(clientId: number) {
  noStore();
  try {
    const result = await sql<Bill>`
      SELECT * FROM billing
      WHERE client_id = ${clientId};
    `;

    return result.rows;
  } catch (error) {
    console.error('Billing history fetching failed: ', error);
    throw new Error('Failed to fetch billing history.');
  }
}

export async function getInventory(clientId: number) {
  noStore();
  try {
    const result = await sql<Inventory>`
      SELECT * FROM inventory
      WHERE client_id = ${clientId};
    `;

    return result.rows[0];
  } catch (error) {
    console.error('Inventory fetching failed: ', error);
    throw new Error('Failed to fetch inventory.');
  }
}

export async function getEquipment(clientId: number) {
  noStore();
  try {
    const result = await sql<Equipment>`
      SELECT * FROM equipment
      WHERE client_id = ${clientId};
    `;

    return result.rows;
  } catch (error) {
    console.error('Equipment fetching failed: ', error);
    throw new Error('Failed to fetch equipment.');
  }
}

export async function getClientStatus(
  clientId: number,
  type: ClientStatus['type'],
) {
  noStore();
  try {
    const result = await sql<ClientStatus>`
      SELECT * FROM client_status
      WHERE client_id = ${clientId}
        AND type = ${type}
    `;

    return result.rows[0] == undefined
      ? {
          id: -1,
          client_id: clientId,
          status: 'setStatus',
          type: type,
          note: null,
        }
      : result.rows[0];
  } catch (error) {
    console.error('Status fetching failed: ', error);
    throw new Error('Failed to fetch status.');
  }
}

export async function getFormWithFieldsById(formId: number) {
  noStore();
  try {
    const result = await sql`
      SELECT
        f.id            AS form_id,
        f.name          AS form_name,
        ff.id           AS field_id,
        ff.label        AS label,
        ff.type         AS type,
        ff.default_value AS default_value,
        ff.options      AS options
      FROM forms f
      JOIN form_fields ff ON ff.form_id = f.id
      WHERE form_id = ${formId}
      ORDER BY field_id
    `;

    if (result.rowCount === 0) {
      return null;
    }

    const formName = result.rows[0].form_name as string;
    let fields: FormWithFields['fields'] = [];

    for (const row of result.rows) {
      fields.push({
        id: row.field_id,
        label: row.label,
        type: row.type,
        defaultValue: row.default_value,
        options: row.options ? row.options.split(',') : [],
      });
    }
    return { id: formId, name: formName, fields } as FormWithFields;
  } catch (error: any) {
    console.error('getJobFormWithFields error:', error);
    throw new Error('Failed to fetch form.');
  }
}

export async function getJobForms() {
  noStore();
  try {
    const result = await sql<JobForm>`SELECT id, name FROM forms`;

    return result.rows;
  } catch (error) {
    console.error('getForms error:', error);
    throw new Error('Failed to fetch forms.');
  }
}

export async function getFormsWithFields() {
  noStore();
  try {
    const result = await sql`
      SELECT
        f.id            AS form_id,
        f.name          AS form_name,
        ff.id           AS field_id,
        ff.label        AS label,
        ff.type         AS type,
        ff.default_value AS default_value,
        ff.options      AS options
      FROM forms f
      JOIN form_fields ff ON ff.form_id = f.id
      ORDER BY field_id
    `;

    if (result.rowCount === 0) {
      return [];
    }

    // Group rows by form_id so each form has its own fields array
    const formsMap = new Map<number, FormWithFields>();

    for (const row of result.rows) {
      const formId = row.form_id as number;

      if (!formsMap.has(formId)) {
        formsMap.set(formId, {
          id: formId,
          name: row.form_name,
          fields: [],
        });
      }

      const currentForm = formsMap.get(formId)!;
      currentForm.fields.push({
        id: row.field_id,
        label: row.label,
        type: row.type,
        defaultValue: row.default_value,
        options: row.options ? row.options.split(',') : [],
      });
    }
    return Array.from(formsMap.values());
  } catch (error: any) {
    console.error('getJobFormsWithFields error:', error);
    throw new Error('Failed to fetch forms.');
  }
}

export async function getJobFormsById(
  jobId: number,
): Promise<FormWithFields[]> {
  noStore();

  try {
    const result = await sql`
      SELECT
        jf.id           AS job_form_id,
        jf.job_id       AS job_id,
        f.id            AS form_id,
        f.name          AS form_name,
        ff.id           AS field_id,
        ff.label        AS label,
        ff.type         AS type,
        ff.default_value AS default_value,
        ff.options      AS options
      FROM job_forms jf
      JOIN forms f ON f.id = jf.form_id
      JOIN form_fields ff ON ff.form_id = f.id
      WHERE jf.job_id = ${jobId}
      ORDER BY field_id
    `;

    if (result.rowCount === 0) {
      return [];
    }

    // Group rows by form_id so each form has its own fields array
    const formsMap = new Map<number, FormWithFields>();

    for (const row of result.rows) {
      const formId = row.form_id as number;

      if (!formsMap.has(formId)) {
        formsMap.set(formId, {
          id: formId,
          name: row.form_name,
          fields: [],
        });
      }

      const currentForm = formsMap.get(formId)!;
      currentForm.fields.push({
        id: row.field_id,
        label: row.label,
        type: row.type,
        defaultValue: row.default_value,
        options: row.options ? row.options.split(',') : [],
      });
    }

    return Array.from(formsMap.values());
  } catch (error: any) {
    console.error('getJobForms error:', error);
    throw new Error('Failed to fetch job forms.');
  }
}

export async function getResponseWithLabelsById(
  responseId: number,
): Promise<LabeledResponse | null> {
  noStore();
  try {
    const responseResult = await sql`
      SELECT 
        fr.id, 
        fr.form_id, 
        fr.response, 
        fr.created_at, 
        f.name as form_name,
        u.name AS user_name
      FROM form_responses fr
      LEFT JOIN forms f ON fr.form_id = f.id
      LEFT JOIN users u ON fr.user_id = u.id
      WHERE fr.id = 1;
    `;

    if (responseResult.rowCount === 0) return null;

    const row = responseResult.rows[0];
    const rawResponse = row.response as Record<number, any> | null;
    const formId = row.form_id;

    const fieldsResult = await sql`
      SELECT id, label
      FROM form_fields
      WHERE form_id = ${formId}
    `;

    const labeledResponseEntries: LabeledResponseEntry[] =
      fieldsResult.rows.map((field) => {
        const fieldId = field.id;
        const fieldType = field.type;
        const label = field.label;
        const value = rawResponse?.[fieldId] ?? null;
        return { fieldId, fieldType, label, value };
      });

    return {
      id: row.id,
      formId: row.form_id,
      formName: row.form_name,
      userName: row.user_name,
      createdAt: row.created_at,
      responses: labeledResponseEntries,
    };
  } catch (error: any) {
    console.error('Get response with labels error:', error);
    throw new Error('Failed to fetch form labels and responses');
  }
}

export async function getJobFormResponses(
  jobId: number,
): Promise<LabeledResponse[]> {
  noStore();

  try {
    const result = await sql`
      SELECT
        fr.id           AS response_id,
        fr.form_id      AS form_id,
        f.name          AS form_name,
        fr.response     AS raw_response,
        fr.created_at   AS created_at,
        ff.id           AS field_id,
        ff.label        AS field_label,
        ff.type         AS field_type,
        u.name          AS user_name
      FROM form_responses fr
      JOIN forms f ON f.id = fr.form_id
      LEFT JOIN form_fields ff ON  ff.form_id = fr.form_id
      LEFT JOIN users u ON fr.user_id = u.id
      WHERE fr.job_id = ${jobId}
      ORDER BY ff.id ASC;
    `;

    if (result.rowCount === 0) {
      return [];
    }

    const responsesMap = new Map<number, LabeledResponse>();

    for (const row of result.rows) {
      const id = row.response_id as number;
      const formId = row.form_id as number;
      const formName = row.form_name as string;
      const userName = row.user_name as string;
      const createdAt = row.created_at as string;
      const rawResponse = row.raw_response as Record<string, any>;
      const fieldId = row.field_id as number;
      const fieldLabel = row.field_label as string;
      const fieldType = row.field_type as FieldType;

      if (!responsesMap.has(id)) {
        responsesMap.set(id, {
          id,
          formId,
          formName,
          userName,
          createdAt,
          responses: [],
        });
      }

      // Add the field to the response's responses array
      const value = rawResponse?.[fieldId.toString()] ?? null;
      responsesMap.get(id)!.responses.push({
        fieldId,
        fieldType,
        label: fieldLabel,
        value,
      });
    }

    return Array.from(responsesMap.values());
  } catch (error: any) {
    console.error('getJobFormResponses error:', error);
    throw new Error('Failed to fetch responses');
  }
}

export async function getQuoteById(id: number) {
  noStore();
  try {
    const result = await sql<Quote>`
      SELECT 
        q.*,
        u.name as manager,
        c.account_manager,
        c.company_name,
        co.name,
        t.name as tax_name,
        t.tax_rate as tax_rate,
         SUM(
          CASE WHEN li.is_taxable AND t.id IS NOT NULL 
          THEN li.unit_price * li.quantity * (1 + t.tax_rate) 
          ELSE li.unit_price * li.quantity 
          END
        ) AS total
      FROM quotes q
      LEFT JOIN clients c ON c.id = q.client_id
      LEFT JOIN contacts co ON  co.client_id = c.id
      LEFT JOIN line_items li ON li.quote_id = q.id
      LEFT JOIN taxes t ON t.id = q.tax_id
      LEFT JOIN users u ON u.id = q.user_id
      WHERE q.id = ${id}
        AND co.id IN (
          SELECT MIN(id) FROM contacts 
          WHERE client_id = c.id
        ) 
        OR co.id IS NULL
      GROUP BY 
        q.id,
        u.name,
        c.account_manager, 
        c.company_name, 
        co.name, 
        t.name, 
        t.tax_rate
      ORDER BY date_created DESC
    `;
    return result.rows[0];
  } catch (error: any) {
    console.error('getQuoteById error:', error);
    throw new Error('Failed to fetch quotes');
  }
}

export async function getQuotes() {
  noStore();
  try {
    const result = await sql<Quote>`
      SELECT 
        q.*,
        u.name as manager,
        c.account_manager,
        c.company_name,
        co.name as client_name,
        t.name as tax_name,
        t.tax_rate as tax_rate,
        SUM(
          CASE WHEN li.is_taxable AND t.id IS NOT NULL 
          THEN li.unit_price * li.quantity * (1 + t.tax_rate) 
          ELSE li.unit_price * li.quantity 
          END
        ) AS total
      FROM quotes q
      LEFT JOIN clients c ON c.id = q.client_id
      LEFT JOIN contacts co ON  co.client_id = c.id
      LEFT JOIN line_items li ON li.quote_id = q.id
      LEFT JOIN taxes t ON t.id = q.tax_id
      LEFT JOIN users u ON u.id = q.user_id
      WHERE co.id IN (
        SELECT MIN(id) FROM contacts 
        WHERE client_id = c.id
        ) 
        OR co.id IS NULL
      GROUP BY 
        q.id,
        u.name,
        c.account_manager, 
        c.company_name, 
        co.name, 
        t.name, 
        t.tax_rate
      ORDER BY date_created DESC
    `;
    return result.rows;
  } catch (error: any) {
    console.error('getQuotes error:', error);
    throw new Error('Failed to fetch quotes');
  }
}

const QUOTES_PER_PAGE = 20;
export async function getFilteredQuotes(
  query: string,
  currentPage: number,
  quoteStatuses: string,
) {
  noStore();
  const offset = (currentPage - 1) * QUOTES_PER_PAGE;

  // Replace space with % for wildcard search
  query = query.replace(' ', '%');

  // Convert into a Postgres array literal: Ex. {service,site visit}
  const quoteStatusesLiteral = `{${quoteStatuses}}`;

  try {
    const result = await sql<Quote>`
      SELECT 
        q.*,
        u.name as manager,
        c.account_manager,
        c.company_name,
        co.name as client_name,
        t.name as tax_name,
        t.tax_rate as tax_rate,
        SUM(
          CASE WHEN li.is_taxable AND t.id IS NOT NULL 
          THEN li.unit_price * li.quantity * (1 + t.tax_rate) 
          ELSE li.unit_price * li.quantity 
          END
        ) AS total,
        (
          SELECT COUNT(*) FROM notes n 
          WHERE n.entity_id = q.id
            AND n.entity = 'quote'
        ) + (
          SELECT COUNT(*) FROM emails e 
          WHERE e.entity_id = q.id
            AND e.entity = 'quote'
        ) as messages_count
      FROM quotes q
      LEFT JOIN clients c ON c.id = q.client_id
      LEFT JOIN contacts co ON  co.client_id = c.id
      LEFT JOIN line_items li ON li.quote_id = q.id
      LEFT JOIN taxes t ON t.id = q.tax_id
      LEFT JOIN users u on u.id = q.user_id
      WHERE (co.id IN (
        SELECT MIN(id) FROM contacts 
        WHERE client_id = c.id
        ) 
        OR co.id IS NULL
      )
        AND (c.company_name ILIKE ${`%${query}%`}
          OR co.name ILIKE ${`%${query}%`}
        )
        AND (
          ${quoteStatusesLiteral} = '{}'
          OR q.status = ANY(${quoteStatusesLiteral}::text[])
        )
      GROUP BY 
        q.id,
        u.name,
        c.account_manager, 
        c.company_name, 
        co.name, 
        t.name, 
        t.tax_rate
      ORDER BY date_created DESC
      LIMIT ${CLIENTS_PER_PAGE} OFFSET ${offset};
    `;

    return result.rows;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch quotes.');
  }
}

export async function getQuotesByClientId(clientId: number) {
  noStore();

  try {
    const result = await sql<Quote>`
      SELECT 
        q.*,
        u.name as manager,
        c.account_manager,
        c.company_name,
        co.name as client_name,
        t.name as tax_name,
        t.tax_rate as tax_rate,
        SUM(
          CASE WHEN li.is_taxable AND t.id IS NOT NULL 
          THEN li.unit_price * li.quantity * (1 + t.tax_rate) 
          ELSE li.unit_price * li.quantity 
          END
        ) AS total,
        (
          SELECT COUNT(*) FROM notes n 
          WHERE n.entity_id = q.id
            AND n.entity = 'quote'
        ) + (
          SELECT COUNT(*) FROM emails e 
          WHERE e.entity_id = q.id
            AND e.entity = 'quote'
        ) as messages_count,
        COALESCE(
          (
            SELECT
              json_agg(
                activity_data ORDER BY (activity_data->>'date') DESC
              )
            FROM (
              SELECT DISTINCT
                jsonb_build_object(
                  'id', ea.id,
                  'user_id', ea.user_id,
                  'username', u_ea.name,
                  'entity_id', ea.entity_id,
                  'entity', ea.entity,
                  'activity', ea.activity,
                  'date', ea.date
                ) AS activity_data
              FROM entity_activity ea
              LEFT JOIN users u_ea ON ea.user_id = u_ea.id
              WHERE ea.entity_id = q.id
                AND ea.entity = 'quote'
            ) AS distinct_activities
          ),
          '[]'
        ) AS activity
      FROM quotes q
      LEFT JOIN clients c ON c.id = q.client_id
      LEFT JOIN contacts co ON  co.client_id = c.id
      LEFT JOIN line_items li ON li.quote_id = q.id
      LEFT JOIN taxes t ON t.id = q.tax_id
      LEFT JOIN users u on u.id = q.user_id
      WHERE q.client_id = ${clientId}
        AND (co.id IN (
          SELECT MIN(id) FROM contacts 
          WHERE client_id = c.id
          ) 
          OR co.id IS NULL
        )
      GROUP BY 
        q.id,
        u.name,
        c.account_manager, 
        c.company_name, 
        co.name, 
        t.name, 
        t.tax_rate
      ORDER BY date_created DESC
    `;

    return result.rows;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch quotes.');
  }
}

export async function getQuotePages(query: string, quoteStatuses: string) {
  noStore();
  query = query.replace(' ', '%');
  const quoteStatusesLiteral = `{${quoteStatuses}}`;

  try {
    const count = await sql`
      SELECT COUNT(*)
      FROM quotes q
      LEFT JOIN clients c ON c.id = q.client_id
      LEFT JOIN contacts co ON  co.client_id = c.id
      WHERE (co.id IN (
        SELECT MIN(id) FROM contacts 
        WHERE client_id = c.id
        ) 
        OR co.id IS NULL
      )
        AND (c.company_name ILIKE ${`%${query}%`}
          OR co.name ILIKE ${`%${query}%`}
        )
        AND (
          ${quoteStatusesLiteral} = '{}'
          OR q.status = ANY(${quoteStatusesLiteral}::text[])
        )
    `;

    const totalPages = Math.ceil(Number(count.rows[0].count) / JOBS_PER_PAGE);

    return totalPages;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch total number of quotes.');
  }
}

export async function getLineItemsByQuoteId(quoteId: number) {
  noStore();
  try {
    const result = await sql<LineItem>`
      SELECT * FROM line_items
      WHERE quote_id = ${quoteId}
      ORDER BY id ASC
    `;
    return result.rows;
  } catch (error) {
    console.error('getTaxes error:', error);
    throw new Error('Failed to fetch line items');
  }
}

export async function getTemplateLineItems(query: string) {
  noStore();
  query = query.replace(' ', '%');
  try {
    const result = await sql<TemplateLineItem>`
      SELECT * 
      FROM template_line_items
      WHERE name != ''
        AND name ILIKE ${`%${query}%`}
      ORDER BY name
    `;
    return result.rows;
  } catch (error: any) {
    console.error('getTemplateLineItems error:', error);
    throw new Error('Failed to fetch template line items');
  }
}

export async function getTemplateLineItemByName(name: string) {
  noStore();
  try {
    const result = await sql<TemplateLineItem>`
      SELECT *
      FROM template_line_items
      WHERE name = ${name}
      ORDER BY name ASC
      LIMIT 1
    `;
    return result.rows[0];
  } catch (error: any) {
    console.error('getTemplateLineItemByName error:', error);
    throw new Error('Failed to fetch template line item');
  }
}

export async function getTaxes() {
  noStore();
  try {
    const result = await sql<Tax>`
      SELECT * FROM taxes
      ORDER BY name
    `;
    return result.rows;
  } catch (error: any) {
    console.error('getTaxes error:', error);
    throw new Error('Failed to fetch taxes');
  }
}

export async function getTaxById(id: number | null) {
  noStore();
  if (id === null) return null;
  try {
    const result = await sql<Tax>`
      SELECT * FROM taxes
      WHERE id = ${id}
    `;
    return result.rows[0];
  } catch (error: any) {
    console.error('getTaxById error:', error);
    throw new Error('Failed to fetch tax');
  }
}

const INVOICES_PER_PAGE = 20;
export async function getFilteredInvoices(
  query: string,
  currentPage: number,
  invoiceStatuses: string,
) {
  noStore();
  const offset = (currentPage - 1) * INVOICES_PER_PAGE;

  // Replace space with % for wildcard search
  query = query.replace(' ', '%');

  // Convert into a Postgres array literal: Ex. {service,site visit}
  const invoiceStatusesLiteral = `{${invoiceStatuses}}`;

  try {
    const result = await sql<Invoice>`
      WITH InvoiceData AS (
        SELECT
          i.*,
          q.id AS quote_id,
          t.name AS tax_name,
          t.tax_rate AS tax_rate,
          SUM(
            CASE
              WHEN li.is_taxable AND t.id IS NOT NULL THEN li.unit_price * li.quantity * (1 + t.tax_rate)
              ELSE li.unit_price * li.quantity
            END
          ) AS total,
          (
            SELECT status FROM client_status
            WHERE
              client_id = i.client_id
              AND type = 'billing'
          ) AS status
        FROM
          invoices i
          LEFT JOIN clients c ON c.id = i.client_id
          LEFT JOIN quotes q ON q.id = i.quote_id
          LEFT JOIN line_items li ON li.quote_id = q.id
          LEFT JOIN taxes t ON t.id = q.tax_id
        GROUP BY
          i.id,
          q.id,
          t.name,
          t.tax_rate
      )
      SELECT * FROM InvoiceData
      WHERE title ILIKE ${`%${query}%`}
        AND (
          ${invoiceStatusesLiteral} = '{}'
          OR status = ANY(${invoiceStatusesLiteral}::text[])
        )
      ORDER BY date_created DESC  
      LIMIT ${INVOICES_PER_PAGE} OFFSET ${offset};
    `;

    return result.rows;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoices.');
  }
}

export async function getInvoicePages(query: string, invoiceStatuses: string) {
  noStore();
  query = query.replace(' ', '%');
  const invoiceStatusesLiteral = `{${invoiceStatuses}}`;

  try {
    const count = await sql`
      WITH InvoiceData AS (
        SELECT
          i.*,
          q.id AS quote_id,
          t.name AS tax_name,
          t.tax_rate AS tax_rate,
          SUM(
            CASE
              WHEN li.is_taxable AND t.id IS NOT NULL THEN li.unit_price * li.quantity * (1 + t.tax_rate)
              ELSE li.unit_price * li.quantity
            END
          ) AS total,
          (
            SELECT status FROM client_status
            WHERE
              client_id = i.client_id
              AND type = 'billing'
          ) AS status
        FROM
          invoices i
          LEFT JOIN clients c ON c.id = i.client_id
          LEFT JOIN quotes q ON q.id = i.quote_id
          LEFT JOIN line_items li ON li.quote_id = q.id
          LEFT JOIN taxes t ON t.id = q.tax_id
        GROUP BY
          i.id,
          q.id,
          t.name,
          t.tax_rate
      )
      SELECT COUNT(*) FROM InvoiceData
      WHERE title ILIKE ${`%${query}%`}
        AND (
          ${invoiceStatusesLiteral} = '{}'
          OR status = ANY(${invoiceStatusesLiteral}::text[])
        )
    `;

    const totalPages = Math.ceil(
      Number(count.rows[0].count) / INVOICES_PER_PAGE,
    );

    return totalPages;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch total number of invoices.');
  }
}

export async function getInvoiceById(id: number) {
  noStore();
  try {
    const result = await sql<Invoice>`
      SELECT * FROM invoices
      WHERE id = ${id}
    `;
    return result.rows[0];
  } catch (error: any) {
    console.error('getInvoiceById error:', error);
    throw new Error('Failed to fetch invoice');
  }
}

export async function getInvoicesByClientId(clientId: number) {
  noStore();

  try {
    const result = await sql<Invoice>`
      WITH InvoiceData AS (
        SELECT
          i.*,
          q.id AS quote_id,
          t.name AS tax_name,
          t.tax_rate AS tax_rate,
          SUM(
            CASE
              WHEN li.is_taxable AND t.id IS NOT NULL THEN li.unit_price * li.quantity * (1 + t.tax_rate)
              ELSE li.unit_price * li.quantity
            END
          ) AS total,
          (
            SELECT status FROM client_status
            WHERE
              client_id = i.client_id
              AND type = 'billing'
          ) AS status,
          COALESCE(
            (
              SELECT
                json_agg(
                  activity_data ORDER BY (activity_data->>'date') DESC
                )
              FROM (
                SELECT DISTINCT
                  jsonb_build_object(
                    'id', ea.id,
                    'user_id', ea.user_id,
                    'username', u_ea.name,
                    'entity_id', ea.entity_id,
                    'entity', ea.entity,
                    'activity', ea.activity,
                    'date', ea.date
                  ) AS activity_data
                FROM entity_activity ea
                LEFT JOIN users u_ea ON ea.user_id = u_ea.id
                WHERE ea.entity_id = i.id
                  AND ea.entity = 'invoice'
              ) AS distinct_activities
            ),
            '[]'
          ) AS activity
        FROM
          invoices i
          LEFT JOIN clients c ON c.id = i.client_id
          LEFT JOIN quotes q ON q.id = i.quote_id
          LEFT JOIN line_items li ON li.quote_id = q.id
          LEFT JOIN taxes t ON t.id = q.tax_id
        WHERE i.client_id = ${clientId}
        GROUP BY
          i.id,
          q.id,
          t.name,
          t.tax_rate
      )
      SELECT * FROM InvoiceData
      ORDER BY date_created DESC  
    `;
    return result.rows;
  } catch (error) {
    console.error('getInvoicesByClientId error:', error);
    throw new Error('Failed to fetch invoices');
  }
}

export async function getEmailsByEntity(entityId: number, entity: string) {
  noStore();

  try {
    const result = await sql<Email>`
      SELECT * FROM emails
      WHERE entity_id = ${entityId} AND entity ILIKE ${entity}
      ORDER BY created_at ASC
    `;

    return result.rows;
  } catch (error: any) {
    console.error('getEmails error:', error);
    throw new Error('Failed to fetch emails');
  }
}

export async function getEntityActivityById(entityId: number, entity: string) {
  noStore();

  try {
    const result = await sql<EntityActivity>`
      SELECT * FROM entity_activity
      WHERE entity_id = ${entityId} 
        AND entity LIKE ${entity}
      ORDER BY date DESC
    `;

    return result.rows;
  } catch (error: any) {
    console.error('getEmails error:', error);
    throw new Error('Failed to fetch emails');
  }
}
