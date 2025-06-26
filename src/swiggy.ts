// import type { Request, Response } from "express";
// import xlsx from "xlsx";

// export const swiggyHandler = async (req: Request, res: Response) => {
//   try {
//     const posFileBuffer = req.files.posFile?.[0]?.buffer;
//     const sourceFiles = req.files.sourceFile;

//     if (!posFileBuffer || !sourceFiles || sourceFiles.length === 0) {
//       return res.status(400).json({ error: "Missing required files" });
//     }

//     const posWorkbook = xlsx.read(posFileBuffer, { type: "buffer" });
//     const posSheet = posWorkbook.Sheets[posWorkbook.SheetNames[0]];
//     const posData = xlsx.utils.sheet_to_json(posSheet, { header: 1 });

//     const posHeaderRow = posData[5];
//     const paymentTypeColIndex = posHeaderRow.findIndex((val) =>
//       val?.toString().toLowerCase().includes("payment type")
//     );
//     const otherAmountColIndex = posHeaderRow.findIndex(
//       (val) => val?.toString().toLowerCase() === "other"
//     );
//     const posDateColIndex = posHeaderRow.findIndex((val) =>
//       val?.toString().toLowerCase().includes("date")
//     );

//     if (
//       paymentTypeColIndex === -1 ||
//       otherAmountColIndex === -1 ||
//       posDateColIndex === -1
//     ) {
//       return res.status(400).json({
//         error: "Missing 'Payment Type', 'Other' or 'Date' column in POS file",
//       });
//     }

//     const posRows = posData
//       .slice(6)
//       .filter((row) => {
//         const val = row[paymentTypeColIndex];
//         return val && String(val).trim().toLowerCase() === "other [dineout]";
//       })
//       .map((row) => {
//         const amount = row[otherAmountColIndex];
//         const dateStr = row[posDateColIndex];
//         const cleanDate = String(dateStr).split(" ")[0];
//         return {
//           amount: String(amount).replace(/,/g, "").trim(),
//           date: cleanDate,
//         };
//       })
//       .filter((row) => row.amount && row.date);

//     let sourceRows: { amount: string; date: string }[] = [];

//     for (const file of sourceFiles) {
//       const buffer = file.buffer;
//       const workbook = xlsx.read(buffer, { type: "buffer" });
//       const sheet = workbook.Sheets["All Orders"];
//       if (!sheet) continue;

//       const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
//       const header = data[1];

//       const billAmountIndex = header.findIndex((val) =>
//         val?.toString().toLowerCase().includes("order total (inclusive of gst) (a)")
//       );
//       const sourceDateIndex = header.findIndex((val) =>
//         val?.toString().toLowerCase().includes("order date")
//       );

//       if (billAmountIndex === -1 || sourceDateIndex === -1) continue;

//       const rows = data
//         .slice(7)
//         .filter((row) =>
//           Array.isArray(row)
//             ? row.some((cell) => cell !== undefined && cell !== null && cell !== "")
//             : true
//         )
//         .map((row) => {
//           const amount = row[billAmountIndex];
//           const dateStr = row[sourceDateIndex];
//           const cleanDate = String(dateStr).split(" ")[0];
//           return {
//             amount: String(amount).replace(/,/g, "").trim(),
//             date: cleanDate,
//           };
//         })
//         .filter((row) => row.amount && row.date);

//       sourceRows.push(...rows);
//     }

//     // === Matching Logic Remains the Same ===

//     const matchedValues: { amount: string; date: string }[] = [];
//     const usedSource = new Set<string>();
//     const usedPOSExact = new Set<number>();

//     posRows.forEach((pos, i) => {
//       const key = `${pos.amount}|${pos.date}`;
//       const found = sourceRows.find(
//         (s) => `${s.amount}|${s.date}` === key && !usedSource.has(key)
//       );
//       if (found) {
//         matchedValues.push(pos);
//         usedSource.add(key);
//         usedPOSExact.add(i);
//       }
//     });

//     const remainingPos = posRows.filter((_, i) => !usedPOSExact.has(i));
//     const remainingSource = sourceRows.filter(
//       (s) => !usedSource.has(`${s.amount}|${s.date}`)
//     );

//     const probableMatches: any[] = [];
//     const usedProbableSourceIdx = new Set<number>();
//     const usedProbablePosIdx = new Set<number>();

//     remainingPos.forEach((pos, pi) => {
//       const posNum = parseFloat(pos.amount);
//       if (isNaN(posNum)) return;

//       let bestMatchIdx = -1;
//       let bestDiff = Infinity;

//       remainingSource.forEach((src, si) => {
//         if (src.date !== pos.date || usedProbableSourceIdx.has(si)) return;
//         const srcNum = parseFloat(src.amount);
//         const diff = Math.abs(posNum - srcNum);
//         if (diff <= 100 && diff < bestDiff) {
//           bestDiff = diff;
//           bestMatchIdx = si;
//         }
//       });

//       if (bestMatchIdx !== -1) {
//         probableMatches.push({
//           posValue: pos.amount,
//           sourceValue: remainingSource[bestMatchIdx].amount,
//           date: pos.date,
//           difference: bestDiff,
//         });
//         usedProbableSourceIdx.add(bestMatchIdx);
//         usedProbablePosIdx.add(pi);
//       }
//     });

//     const posForSumMatch = remainingPos.filter(
//       (_, i) => !usedProbablePosIdx.has(i)
//     );
//     const srcForSumMatch = remainingSource.filter(
//       (_, i) => !usedProbableSourceIdx.has(i)
//     );

//     const combinedProbableMatches: any[] = [];
//     const usedSumPOS = new Set<number>();

//     const sourceMapByDate: Record<string, number[]> = {};
//     srcForSumMatch.forEach((src) => {
//       if (!sourceMapByDate[src.date]) sourceMapByDate[src.date] = [];
//       sourceMapByDate[src.date].push(parseFloat(src.amount));
//     });

//     for (let i = 0; i < posForSumMatch.length; i++) {
//       if (usedSumPOS.has(i)) continue;
//       const date = posForSumMatch[i].date;
//       let sum = 0;
//       for (let j = i; j < posForSumMatch.length; j++) {
//         if (posForSumMatch[j].date !== date || usedSumPOS.has(j)) break;
//         sum += parseFloat(posForSumMatch[j].amount);

//         const matchSrc = (sourceMapByDate[date] || []).find(
//           (srcAmt) => Math.abs(srcAmt - sum) <= 100
//         );

//         if (matchSrc !== undefined) {
//           combinedProbableMatches.push({
//             posValues: posForSumMatch.slice(i, j + 1).map((p) => p.amount),
//             sourceValue: String(matchSrc),
//             date,
//             difference: Math.abs(sum - matchSrc),
//           });
//           for (let k = i; k <= j; k++) usedSumPOS.add(k);
//           break;
//         }
//       }
//     }

//     const finalUnmatchedInPos = posForSumMatch.filter(
//       (_, i) => !usedSumPOS.has(i)
//     );
//     const usedAllSourceKeys = new Set([
//       ...usedSource,
//       ...Array.from(usedProbableSourceIdx).map(
//         (i) => `${remainingSource[i].amount}|${remainingSource[i].date}`
//       ),
//       ...combinedProbableMatches.map((m) => `${m.sourceValue}|${m.date}`),
//     ]);

//     let finalUnmatchedInSource = sourceRows.filter(
//       (s) => !usedAllSourceKeys.has(`${s.amount}|${s.date}`)
//     );

//     const midnightMatches: any[] = [];
//     const finalRemainingInPos = [];

//     finalUnmatchedInPos.forEach((pos) => {
//       const posAmt = parseFloat(pos.amount);
//       const posDate = new Date(pos.date);

//       const foundIdx = finalUnmatchedInSource.findIndex((src) => {
//         const srcAmt = parseFloat(src.amount);
//         const srcDate = new Date(src.date);
//         const dateDiff = Math.abs(
//           (srcDate.getTime() - posDate.getTime()) / (1000 * 3600 * 24)
//         );
//         return Math.abs(posAmt - srcAmt) <= 100 && dateDiff === 1;
//       });

//       if (foundIdx !== -1) {
//         const src = finalUnmatchedInSource[foundIdx];
//         midnightMatches.push({
//           posValue: pos.amount,
//           sourceValue: src.amount,
//           posDate: pos.date,
//           sourceDate: src.date,
//           difference: Math.abs(parseFloat(pos.amount) - parseFloat(src.amount)),
//         });
//         finalUnmatchedInSource.splice(foundIdx, 1);
//       } else {
//         finalRemainingInPos.push(pos);
//       }
//     });

//     res.json({
//       matchCount: matchedValues.length,
//       totalPOSRecords: posRows.length,
//       totalSourceRecords: sourceRows.length,
//       matchedValues,
//       unmatchedInPos: finalRemainingInPos,
//       unmatchedInSource: finalUnmatchedInSource,
//       probableMatches,
//       combinedProbableMatches,
//       midnightMatches,
//     });
//   } catch (err) {
//     console.error("Processing error:", err);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// };
