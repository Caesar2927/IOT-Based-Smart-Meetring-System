const puppeteer = require('puppeteer');
const IEXPrice = require('../models/IEXPrice');

/**
 * Normalize time block format to standard "HH:MM-HH:MM"
 */
const normalizeTimeBlock = (timeBlock) => {
  if (!timeBlock) return '';
  
  // Remove extra spaces
  let normalized = timeBlock.trim().replace(/\s+/g, ' ');
  
  // Handle various formats:
  // "12.00 - 12.15" → "12:00-12:15"
  // "12:00 - 12:15" → "12:00-12:15"
  // "1200-1215" → "12:00-12:15"
  
  normalized = normalized
    .replace(/(\d{1,2})\.(\d{2})/g, '$1:$2')    // Replace . with :
    .replace(/\s*-\s*/g, '-')                   // Remove spaces around dash
    .replace(/(\d{2}):?(\d{2})-(\d{2}):?(\d{2})/, '$1:$2-$3:$4');  // Ensure format

  return normalized;
};

/**
 * Helper function to get today's date as YYYY-MM-DD
 */
const getTodayDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Scrape IEX India market data
 * Extract Date, Time Block, and MCP (Rs/MWh) columns
 * Upsert records into IEXPrice collection
 */
const scrapeIEXPrices = async () => {
  let browser;
  try {
    console.log('[IEX Scraper] Starting scrape at', new Date());

    // Launch browser
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Navigate to IEX snapshot page
    await page.goto('https://www.iexindia.com/market-data/real-time-market/market-snapshot', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for table to load
    await page.waitForSelector('table', { timeout: 10000 });

    // Extract table data
    const data = await page.evaluate(() => {
      const rows = document.querySelectorAll('table tbody tr');
      const results = [];

      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 3) {
          // Extract columns: Date, Time Block (or Time), MCP Rs/MWh
          // Adjust selectors based on actual HTML structure
          const dateText = cells[0]?.textContent?.trim() || '';
          const timeText = cells[1]?.textContent?.trim() || '';
          const mcpText = cells[2]?.textContent?.trim() || '';

          // Parse MCP value (remove 'Rs/MWh' if present)
          const mcpValue = parseFloat(mcpText.replace(/[^\d.]/g, ''));

          if (dateText && timeText && !isNaN(mcpValue)) {
            results.push({
              date: dateText,
              timeBlock: timeText,
              mcpValue: mcpValue
            });
          }
        }
      });

      return results;
    });

    console.log(`[IEX Scraper] Scraped ${data.length} records`);

    if (data.length > 0) {
      console.log('[IEX Scraper] Raw fetched data (first 5 records):');
      data.slice(0, 5).forEach((record, idx) => {
        console.log(`  ${idx + 1}. Date: ${record.date}, Time: ${record.timeBlock}, MCP: Rs ${record.mcpValue}/MWh`);
      });
      if (data.length > 5) {
        console.log(`  ... and ${data.length - 5} more records`);
      }
    }

    // Process scraped data with sequential indexing
    const today = getTodayDate();
    let upsertCount = 0;
    const processedRecords = [];

    for (let seqIndex = 0; seqIndex < data.length; seqIndex++) {
      const record = data[seqIndex];
      try {
        // Format date if needed (convert to YYYY-MM-DD)
        let dateStr = record.date;
        // If date is in DD-MM-YYYY or DD/MM/YYYY format, convert to YYYY-MM-DD
        if (dateStr.match(/^\d{2}[/-]\d{2}[/-]\d{4}$/)) {
          const parts = dateStr.replace('/', '-').split('-');
          dateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        // Use today's date if date extraction failed
        if (!dateStr || !dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          dateStr = today;
        }

        // Normalize timeBlock
        const normalizedTimeBlock = normalizeTimeBlock(record.timeBlock);

        const finalRecord = {
          date: dateStr,
          timeBlock: normalizedTimeBlock,
          recordIndex: seqIndex,  // NEW: Sequential index (0, 1, 2, ...)
          mcpRsMWh: record.mcpValue,
          fetchedAt: new Date()
        };

        // Upsert into database using date and sequential index
        await IEXPrice.findOneAndUpdate(
          {
            date: dateStr,
            recordIndex: seqIndex  // Query by sequential index
          },
          finalRecord,
          { upsert: true, new: true }
        );

        processedRecords.push(finalRecord);
        upsertCount++;
      } catch (err) {
        console.error(`[IEX Scraper] Error upserting record at index ${seqIndex}:`, record, err.message);
      }
    }

    console.log(`[IEX Scraper] Successfully upserted ${upsertCount} records`);
    
    if (processedRecords.length > 0) {
      console.log('[IEX Scraper] Processed records (saved to MongoDB with sequential indexing):');
      processedRecords.slice(0, 5).forEach((record, idx) => {
        console.log(`  ${idx + 1}. Index ${record.recordIndex} | ${record.date} | ${record.timeBlock} | Rs ${record.mcpRsMWh}/MWh`);
      });
      if (processedRecords.length > 5) {
        console.log(`  ... and ${processedRecords.length - 5} more`);
      }
      console.log(`[IEX Scraper] Date range: ${processedRecords[0]?.date} to ${processedRecords[processedRecords.length - 1]?.date}`);
    }

    return { success: true, recordsProcessed: upsertCount };
  } catch (err) {
    console.error('[IEX Scraper] Error:', err.message);
    return { success: false, error: err.message };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

module.exports = {
  scrapeIEXPrices
};
