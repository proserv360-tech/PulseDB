/**
 * Export utility functions for downloading data in various formats
 */

/**
 * Format a date for use in filenames (YYYY-MM-DD_HH-mm)
 */
export function formatDateForFilename(date?: Date): string {
  const d = date || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}_${hours}-${minutes}`;
}

/**
 * Escape CSV field values according to RFC 4180
 */
function escapeCSVField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Convert array of objects to CSV string
 */
export function arrayToCSV(data: Record<string, any>[]): string {
  if (!data || data.length === 0) {
    return '';
  }

  // Extract headers from first object
  const headers = Object.keys(data[0]);
  const csvLines: string[] = [];

  // Add header row
  csvLines.push(headers.map(escapeCSVField).join(','));

  // Add data rows
  for (const row of data) {
    const values = headers.map((header) => {
      let value = row[header];

      // Handle null/undefined
      if (value === null || value === undefined) {
        return '';
      }

      // Stringify objects and arrays
      if (typeof value === 'object') {
        value = JSON.stringify(value);
      }

      return escapeCSVField(String(value));
    });

    csvLines.push(values.join(','));
  }

  return csvLines.join('\n');
}

/**
 * Export data as CSV file download
 */
export function exportToCSV(data: Record<string, any>[], filename?: string): void {
  const csv = arrayToCSV(data);
  const finalFilename = filename || `fathom-export-${formatDateForFilename()}.csv`;

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadFile(blob, finalFilename);
}

/**
 * Export data as JSON file download
 */
export function exportToJSON(data: any, filename?: string): void {
  const json = JSON.stringify(data, null, 2);
  const finalFilename = filename || `fathom-export-${formatDateForFilename()}.json`;

  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  downloadFile(blob, finalFilename);
}

/**
 * Export a DOM element as a simple text report (extracts text content)
 */
export function exportAsTextReport(element: HTMLElement, filename?: string): void {
  const text = element.innerText || element.textContent || '';
  const finalFilename = filename || `fathom-report-${formatDateForFilename()}.txt`;

  const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
  downloadFile(blob, finalFilename);
}

/**
 * Helper function to trigger file download
 */
function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the object URL after download
  URL.revokeObjectURL(url);
}