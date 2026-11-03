/**
 * GEN-FREE survey feed (Google Apps Script bound to the Google Sheet that stores the Google Form responses).
 *
 * Why use this version: it returns only COUNTS, never the raw rows, so names, emails or free-text answers
 * from the form are never published on the internet. The website (js/main.js) accepts this format and the
 * older { success, responses } format.
 *
 * How to use:
 *  1. Open the response sheet > Extensions > Apps Script and paste this file (replace the old doGet).
 *  2. Adjust QUESTION_* below only if your question numbers differ.
 *  3. Deploy > Manage deployments > Edit (pencil) > Version: New version > Deploy.
 *     Keep: Execute as = Me, Who has access = Anyone. The /exec URL stays the same.
 */
var QUESTION_AWARENESS = 3;   // "How would you rate your knowledge?"  (4 or 5 = strong awareness)
var QUESTION_RISK = 14;       // consequences question               ("All of the above" = multiple areas)
var QUESTION_SUPPORT = 20;    // "Do you know where to seek help?"   ("Yes")

function doGet() {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    var values = sheet.getDataRange().getValues();
    var headers = (values.shift() || []).map(function (h) { return String(h).trim(); });

    var col = function (n) {
      var re = new RegExp('^Q\\s*0*' + n + '\\s*\\.', 'i');
      for (var i = 0; i < headers.length; i++) if (re.test(headers[i])) return i;
      return -1;
    };
    var cAwareness = col(QUESTION_AWARENESS), cRisk = col(QUESTION_RISK), cSupport = col(QUESTION_SUPPORT);

    var summary = { total: values.length, awareness: 0, risk: 0, support: 0 };
    values.forEach(function (row) {
      if (cAwareness > -1 && Number(row[cAwareness]) >= 4) summary.awareness++;
      if (cRisk > -1 && String(row[cRisk]).toLowerCase().indexOf('all of the above') > -1) summary.risk++;
      if (cSupport > -1 && String(row[cSupport]).trim().toLowerCase() === 'yes') summary.support++;
    });

    return ContentService.createTextOutput(JSON.stringify({ success: true, summary: summary }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
