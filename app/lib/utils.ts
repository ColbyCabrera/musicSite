import dayjs from 'dayjs';
import { auth } from '../api/auth/[...nextauth]/auth';
import { CalendarEvent, Revenue } from './definitions';
import { add } from 'date-fns';

export const moneyFormatter = new Intl.NumberFormat('en-ES', {
  currency: 'USD',
  style: 'currency',
});

export const percentFormatter = new Intl.NumberFormat('en-ES', {
  style: 'percent',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/**
 * 
 * @param amount in cents
 * @returns string
 */
export const formatCurrency = (amount: number) => {
  return (amount / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
};

export const formatDateToLocal = (
  dateStr: string,
  locale: string = 'en-US',
) => {
  const date = new Date(dateStr);
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  };
  const formatter = new Intl.DateTimeFormat(locale, options);
  return formatter.format(date);
};

export const generateYAxis = (revenue: Revenue[]) => {
  // Calculate what labels we need to display on the y-axis
  // based on highest record and in 1000s
  const yAxisLabels = [];
  const highestRecord = Math.max(...revenue.map((month) => month.revenue));
  const topLabel = Math.ceil(highestRecord / 1000) * 1000;

  for (let i = topLabel; i >= 0; i -= 1000) {
    yAxisLabels.push(`$${i / 1000}K`);
  }

  return { yAxisLabels, topLabel };
};

export const generatePagination = (currentPage: number, totalPages: number) => {
  // If the total number of pages is 7 or less,
  // display all pages without any ellipsis.
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  // If the current page is among the first 3 pages,
  // show the first 3, an ellipsis, and the last 2 pages.
  if (currentPage <= 3) {
    return [1, 2, 3, '...', totalPages - 1, totalPages];
  }

  // If the current page is among the last 3 pages,
  // show the first 2, an ellipsis, and the last 3 pages.
  if (currentPage >= totalPages - 2) {
    return [1, 2, '...', totalPages - 2, totalPages - 1, totalPages];
  }

  // If the current page is somewhere in the middle,
  // show the first page, an ellipsis, the current page and its neighbors,
  // another ellipsis, and the last page.
  return [
    1,
    '...',
    currentPage - 1,
    currentPage,
    currentPage + 1,
    '...',
    totalPages,
  ];
};

export function calculateJobLength(startTime: string, endTime: string) {
  if (startTime != null || endTime != null) {
    // Helper function to parse time strings into Date objects
    const parseTime = (time: string): Date => {
      const [hours, minutes] = time.split(':').map(Number);
      const date = new Date();
      date.setHours(hours, minutes, 0, 0);
      return date;
    };

    const start = parseTime(startTime);
    const end = parseTime(endTime);

    // Calculate the difference in milliseconds
    const delta = end.getTime() - start.getTime();

    // Convert the difference from milliseconds to hours
    const hours = delta / (1000 * 60 * 60);

    // Round to the nearest whole number or half number
    let jobLength: number;
    if (hours % 1 < 0.25) {
      jobLength = Math.floor(hours);
    } else if (hours % 1 < 0.75) {
      jobLength = Math.floor(hours) + 0.5;
    } else {
      jobLength = Math.ceil(hours);
    }

    return jobLength;
  }

  return null;
}

export function formatEvents(events: CalendarEvent[]) {
  const EVENT_COLOR = '#cfc387';
  const COMPLETED_JOB_COLOR = '#20a5aa';

  let formattedEvents = events.map((event) => {
    const eventLength = calculateJobLength(event.start_time, event.end_time);
    let title, eventType, start, end, color;

    if (event.start_time != null || event.end_time != null) {
      const [startHours, startMinutes] = event.start_time
        .split(':')
        .map(Number);
      const [endHours, endMinutes] = event.end_time.split(':').map(Number);
      start = add(event.start_date, {
        hours: startHours,
        minutes: startMinutes,
      });
      end = add(event.end_date, {
        hours: endHours,
        minutes: endMinutes,
      });
    } else {
      start = event.start_date;
      end = event.end_date;
    }

    if (eventLength != null) title = event.title;
    else title = event.title;

    if (event.job_id) eventType = 'job';
    else eventType = 'event';

    if (eventType === 'job') {
      if (event.job_status === 'complete') color = COMPLETED_JOB_COLOR;
      else color = event.colors[0];
    } else {
      color = EVENT_COLOR;
    }

    return {
      title: title,
      description: event.description,
      start: start,
      end: end,
      eventLength: eventLength,
      allDay: event.all_day,
      color: color,
      display: 'block',
      team: [...event.names],
      resourceId: event.job_id || event.event_id,
      eventType: eventType,
      isCompleted: event.job_status === 'complete',
    };
  });

  return formattedEvents;
}

export async function getPermissions() {
  const session = await auth();
  const isLoggedIn = !!session?.user;
  const isAdmin = session?.user.role === 'ADMIN';
  const isUser = session?.user.role === 'USER';

  if (!isLoggedIn) {
    return '';
  } else if (isUser) {
    return 'USER';
  } else if (isAdmin) {
    return 'ADMIN';
  }
  return 'CLIENT';
}

// Requires 'use client' in file to get client time zone
export function getTimeZone() {
  'use client';
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return timeZone;
}

export function removeFromArray<T>(value: T, arr: Array<T>) {
  return arr.filter((item) => item != value);
}

export function tagsToArray(tagString: string | undefined | null) {
  if (tagString) return tagString.split(',');
  else return [];
}

export function tagsToString(tags: string[]) {
  if (tags.length === 0) return '';
  return tags.reduce((string, currentTag) => (string += ',' + currentTag));
}

export function get24hrTime(date?: string) {
  if (date)
    return new Date(date).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  else
    return new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
}

export function to12hrTimeString(time: string) {
  let h = Number(time.split(':')[0]);
  let m = time.split(':')[1];
  let amOrPm = h < 12 ? 'AM' : 'PM';
  h = h === 0 ? 12 : h;

  const timeString =
    h <= 12 ? `${h}:${m} ${amOrPm}` : `${h - 12}:${m} ${amOrPm}`;

  return timeString;
}

export function trimText(text: string, limit: number) {
  return text.length < limit ? text : text.slice(0, limit) + '...';
}

export function camelToRegularText(str: string) {
  // Add space before each uppercase letter and convert the string to lowercase
  const regularText = str
    .replace(/([A-Z])/g, ' $1') // Add space before each uppercase letter
    .toLowerCase(); // Convert the string to lowercase

  // Capitalize the first letter of the string
  return regularText.charAt(0).toUpperCase() + regularText.slice(1);
}

export function addTimeToDate(date: string, time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return dayjs(date).add(hours, 'hour').add(minutes, 'minute').toDate();
}

export function getTimeDifferenceInMinutes(startTime: Date, endTime: Date) {
  const start = dayjs(startTime);
  const end = dayjs(endTime);
  return end.diff(start, 'minute');
}

type LineItem<T extends object = {}> = T & {
  unit_price: number | string;
  quantity: number;
  is_taxable: boolean;
};

export const priceToCents = (
  price: number | string,
  alreadyInCents: boolean,
): number => {
  if (typeof price === 'string') {
    const priceWithoutCurrency = Number(price.replace(/[^.\d]+/g, ''));
    return alreadyInCents
      ? Math.round(priceWithoutCurrency)
      : Math.round(priceWithoutCurrency * 100);
  } else {
    return Math.round(price * 100);
  }
};

export const calculateSubtotal = (
  lineItems: LineItem[],
  asCents?: boolean,
): string => {
  const subtotalInCents = lineItems.reduce((accumulator, currentItem) => {
    const priceAsCents = priceToCents(currentItem.unit_price, asCents ?? false);
    return accumulator + priceAsCents * currentItem.quantity;
  }, 0);

  return moneyFormatter.format(subtotalInCents / 100);
};

export const calculateTotal = (
  lineItems: LineItem[],
  taxRate: number,
  asCents?: boolean,
): string => {
  const totalInCents = lineItems.reduce((accumulator, currentItem) => {
    const priceAsCents = priceToCents(currentItem.unit_price, asCents ?? false);
    const subtotal = priceAsCents * currentItem.quantity;
    const tax = currentItem.is_taxable ? subtotal * taxRate : 0;
    return accumulator + subtotal + tax;
  }, 0);

  return moneyFormatter.format(totalInCents / 100);
};

export function generateSixDigitCode(): number {
  // Generate a random number between 100000 (inclusive) and 1000000 (exclusive)
  const code = Math.floor(100000 + Math.random() * 900000);
  // Convert the number to a string
  return code;
}
