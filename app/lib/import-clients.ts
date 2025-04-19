/*
'use server';

import { sql } from '@vercel/postgres';
import { addClientActivity } from './actions'; // Assuming this function also respects rate limits or is handled appropriately.

// --- Interfaces remain the same ---
interface PhoneNumber {
  id: number;
  contact_id: number;
  phone_number: string | number; // Allow number type
  is_main: boolean;
}

interface Email {
  id: number;
  contact_id: number;
  email: string;
  is_main: boolean;
}

interface Contact {
  id: number;
  client_id: number;
  name: string;
  phone_numbers: PhoneNumber[];
  emails: Email[];
  position: string;
}

interface Property {
  id: number;
  client_id: number;
  zip: number | string; // Allow for string ZIP codes
  city: string;
  state: string;
  country: string;
  street_1: string;
  street_2: string;
  operating_hours: string;
}

interface Activity {
  //Added Activity interface
  id: number;
  client_id: number;
  activity: string;
  date: string;
}

interface Client {
  id: number; // Internal temporary ID for structuring
  company_name: string;
  management_company?: string; // Made optional, as not all entries have it.
  contract_information: string;
  billing_instructions: string;
  maintenance_schedule: string;
  last_visit: string;
  next_visit: string;
  tags: string;
  account_manager: string;
  properties: Property[];
  contacts: Contact[];
  activities: Activity[]; // Keep structure if needed downstream, though not directly inserted here
  notes?: string; // Add notes to the client structure
}

// --- Helper function remains the same ---
const safeSplitAndTrim = (value: any): string[] => {
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s !== '');
  } else if (Array.isArray(value)) {
    //in case the field has already been made into a list
    return value.map((s) => String(s).trim()).filter((s) => s !== '');
  } else if (typeof value === 'number') {
    return [String(value)]; //Converts number to string.
  }
  return []; // Return empty array for other types or null/undefined
};

export default async function importClients(jsonData: any) {
  // Counters are no longer strictly necessary for the temporary client object IDs,
  // as we get real IDs back from the DB. Let's remove them to avoid confusion.
  // They weren't being used correctly for relationships anyway.

  // We won't build a large clients array in memory anymore,
  // as we process and insert one by one.
  // let clients: Client[] = [];

  // Use a for...of loop for sequential processing
  for (const item of jsonData) {
    try {
      // --- 1. Prepare Client Data (without IDs initially) ---
      const clientData = {
        company_name: item['Company Name'] ?? '', // Use nullish coalescing for safety
        management_company: item['management_company'], // Optional, so undefined is fine
        contract_information: item['CFT[Contract Information ]'] ?? '',
        billing_instructions:
          `${item['PFT[Billing Instruction]'] || ''} ${item['Billing Street 1'] || ''} ${item['Billing Street 2'] || ''} ${item['Billing City'] || ''} ${item['Billing State'] || ''} ${item['Billing ZIP code'] || ''}`.trim(),
        maintenance_schedule: item['PFT[Special Maintenance Schedule ]'] ?? '', // Store schedule info if needed elsewhere
        last_visit: item['CFT[Last Visit Date]'], // Store visit info if needed elsewhere
        next_visit: item['CFT[Next Maintenance Visit ]'], // Store visit info if needed elsewhere
        tags: item['Tags'] ?? '',
        account_manager: item['PFS[Account Manager ]'] ?? '',
        notes: `Important client notes: ${item['Important Client Notes'] || 'None'}\n\nLocation specific instructions: ${item['Location Specific Detailed Instructions'] || 'None'}\n\nImportant contact name and number: ${item['CFT[Important Contact Name & Number ]'] || 'None'}\n\nText message enabled #: ${item['Text Message Enabled Phone #'] || 'None'}\n\nAccount number: ${item['PFT[Account Number ]'] || 'None'}\n\nCurrent Parts/Tasks Status: ${item['PFT[Current Parts/Tasks Status]'] || 'None'}\n\nCurrent Equipment Inventory: ${item['PFT[Current Equipment Inventory]'] || 'None'}\n\n Equipment Sold: ${item['PFT[Equipment Sold]'] || 'None'}`, // Prepare notes
      };

      // --- 2. Insert Client ---
      // Note: Removed unused maintenance/visit fields from insert, add if needed in DB schema
      const clientResult = await sql`
        INSERT INTO clients (company_name, tags, is_company, management_company, contract_information, billing_instructions, account_manager)
        VALUES (
          ${clientData.company_name},
          ${clientData.tags},
          ${false},
          ${clientData.management_company},
          ${clientData.contract_information},
          ${clientData.billing_instructions},
          ${clientData.account_manager}
        )
        RETURNING id;
      `;

      // Ensure we got an ID back
      if (!clientResult.rows || clientResult.rows.length === 0) {
        console.error(
          'Failed to insert client or retrieve ID for:',
          clientData.company_name,
        );
        continue; // Skip to the next item
      }
      const insertedClientId = clientResult.rows[0].id;

      // --- 3. Insert Notes (if any) ---
      if (clientData.notes) {
        const currentDateTime = new Date().toISOString();
        await sql`
           INSERT INTO notes (entity_id, entity, text, visibility, date_created)
           VALUES (${insertedClientId}, 'client', ${clientData.notes}, 'public', ${currentDateTime});
         `;
      }

      // --- 4. Insert Client Status ---
      await sql`
         INSERT INTO client_status (client_id, status, type)
         VALUES (${insertedClientId}, 'active', 'billing');
       `;

      // --- 5. Prepare and Insert Property ---
      // Assuming one property per row in the source data
      const propertyData = {
        zip: item['Service ZIP code'] || '',
        city: item['Service City'] || '',
        state: item['Service State'] || '',
        country: item['Service Country'] || '',
        street_1: item['Service Street 1'] || '',
        street_2: item['Service Street 2'] || '',
        operating_hours: item['PFT[Hours of Operation ]'] || '',
      };

      await sql`
         INSERT INTO properties (client_id, country, state, city, zip, street_1, street_2, operating_hours)
         VALUES (
            ${insertedClientId},
            ${propertyData.country},
            ${propertyData.state},
            ${propertyData.city},
            ${String(propertyData.zip)}, 
            ${propertyData.street_1},
            ${propertyData.street_2},
            ${propertyData.operating_hours}
          );
       `;

      // --- 6. Prepare and Insert Contacts ---
      const contactNames = safeSplitAndTrim(item['Last Name']);
      const phoneNumbers = safeSplitAndTrim(item['Main Phone #s']);
      const emails = safeSplitAndTrim(item['E-mails']);
      const positions = safeSplitAndTrim(item['Title']);

      // Use the length of the primary identifier (e.g., names) or loop through available data robustly
      const numContacts = Math.max(
        contactNames.length,
        phoneNumbers.length, // Consider if structure guarantees alignment
        emails.length, // Consider if structure guarantees alignment
        positions.length,
      );

      // If no contact details exist at all, skip contact creation
      if (numContacts > 0) {
        // If there are details but no name, create a placeholder contact
        if (contactNames.length === 0 && numContacts > 0) {
          contactNames.push('(No Name Provided)'); // Or handle as needed
        }

        for (let i = 0; i < numContacts; i++) {
          const contactName = contactNames[i] || '(No Name Provided)'; // Use placeholder if name missing but other details exist
          const contactPosition = positions[i] || ''; // Default to empty string

          // Insert Contact
          const contactResult = await sql`
            INSERT INTO contacts (client_id, name, position)
            VALUES (${insertedClientId}, ${contactName}, ${contactPosition})
            RETURNING id;
          `;

          if (!contactResult.rows || contactResult.rows.length === 0) {
            console.error(
              'Failed to insert contact or retrieve ID for:',
              contactName,
              'Client ID:',
              insertedClientId,
            );
            continue; // Skip to next contact iteration
          }
          const insertedContactId = contactResult.rows[0].id;

          // Insert Phone Number (if exists for this index)
          if (phoneNumbers[i]) {
            await sql`
              INSERT INTO contact_phone_numbers (contact_id, phone_number, is_main)
              VALUES (${insertedContactId}, ${String(phoneNumbers[i])} , ${true});
            `;
          }

          // Insert Email (if exists for this index)
          if (emails[i]) {
            await sql`
               INSERT INTO contact_emails (contact_id, email, is_main)
               VALUES (${insertedContactId}, ${emails[i]}, ${true} );
             `;
          }
        } // End contacts loop
      } // End if(numContacts > 0)

      // --- 7. Add Client Activity Log ---
      // Place this after all other operations for this client succeed
      await addClientActivity(insertedClientId, 'Client imported');

      // Optional: Add a small delay if needed, though sequential processing might be enough
      // await new Promise(resolve => setTimeout(resolve, 10)); // e.g., wait 10ms
    } catch (error) {
      console.error(
        `Failed to import client item: ${item?.['Company Name'] || JSON.stringify(item)}. Error:`,
        error,
      );
      // Continue to the next item in jsonData
    }
  }

  console.log('Client import process finished.');

  return { success: true, message: 'Import process completed.' };
}

/* ADD THIS TO import-data.ts 
export const jsonData = [{}]
export default jsonData;

*/

/* ADD THIS TO import-clients-form.tsx
'use client';

import importClients from '@/app/lib/import-clients';
import { Button } from '../shadcn/components/ui/button';
import jsonData from '@/app/lib/import-data';

export default function ImportClientsForm() {
  const handleSubmit = async (e: any) => {
    await importClients(jsonData);
    console.log('submitted');
  };

  return (
    <form action={handleSubmit}>
      <Button type="submit">Import Clients</Button>
    </form>
  );
}

*/
