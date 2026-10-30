// One CSV cell, quoted. Text that starts like a formula (=, +, -, @, tab, return) gets a leading ' so Excel shows it as
// text: names come from the public booking form, so a name like =HYPERLINK(...) must never run.
export const csvCell = (v) => {
  const s = String(v ?? "");
  return `"${(typeof v === "string" && /^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replaceAll('"', '""')}"`;
};

// Saves text as a file in the browser (used for the CSV exports Excel opens).
export function downloadCsv(filename, csv) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
