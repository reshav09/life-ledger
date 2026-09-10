const express = require('express');
const PDFDocument = require('pdfkit');
const router = express.Router();
const pool = require('../db/db');

router.get('/monthly', async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);

    const [[incomeRow]] = await pool.query(
      `SELECT COALESCE(SUM(amount),0) total FROM transactions WHERE type='income' AND DATE_FORMAT(txn_date,"%Y-%m")=?`,
      [month]
    );
    const [[salaryRow]] = await pool.query(
      `SELECT COALESCE(SUM(amount),0) total FROM salaries WHERE DATE_FORMAT(received_on,"%Y-%m")=?`,
      [month]
    );
    const [[expenseRow]] = await pool.query(
      `SELECT COALESCE(SUM(amount),0) total FROM transactions WHERE type='expense' AND DATE_FORMAT(txn_date,"%Y-%m")=?`,
      [month]
    );
    const [byCategory] = await pool.query(
      `SELECT c.name, c.icon, COALESCE(SUM(t.amount),0) total
       FROM categories c
       LEFT JOIN transactions t ON t.category_id = c.id AND t.type = 'expense' AND DATE_FORMAT(t.txn_date,"%Y-%m") = ?
       WHERE c.type = 'expense'
       GROUP BY c.id
       HAVING total > 0
       ORDER BY total DESC`,
      [month]
    );
    const [budgets] = await pool.query(
      `SELECT b.amount, c.name,
        (SELECT COALESCE(SUM(amount),0) FROM transactions WHERE category_id=c.id AND type='expense' AND DATE_FORMAT(txn_date,"%Y-%m")=?) AS spent
       FROM budgets b JOIN categories c ON c.id = b.category_id WHERE b.month = ?`,
      [month, month]
    );

    const totalIncome = Number(incomeRow.total) + Number(salaryRow.total);
    const totalExpense = Number(expenseRow.total);
    const net = totalIncome - totalExpense;
    const monthLabel = new Date(`${month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    const money = (n) => `Rs. ${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="money-tracker-${month}.pdf"`);

    const doc = new PDFDocument({ margin: 54 });
    doc.pipe(res);

    doc.fontSize(20).fillColor('#22262B').text('Ledger — Monthly Report', { align: 'center' });
    doc.fontSize(13).fillColor('#6B6A61').text(monthLabel, { align: 'center' });
    doc.moveDown(1.2);
    doc.moveTo(54, doc.y).lineTo(541, doc.y).strokeColor('#DDD6C5').stroke();
    doc.moveDown(1);

    doc.fontSize(14).fillColor('#22262B').text('Summary');
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor('#333333');
    doc.text(`Total income (salary + other): ${money(totalIncome)}`);
    doc.text(`Total expenses: ${money(totalExpense)}`);
    doc.fillColor(net >= 0 ? '#2F6F4E' : '#B3432B').text(`Net for the month: ${money(net)}`);
    doc.fillColor('#333333');
    doc.moveDown(1);

    doc.fontSize(14).fillColor('#22262B').text('Spend by category');
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor('#333333');
    if (byCategory.length === 0) {
      doc.text('No expenses logged this month.');
    } else {
      byCategory.forEach((c) => doc.text(`${c.name}: ${money(c.total)}`));
    }
    doc.moveDown(1);

    doc.fontSize(14).fillColor('#22262B').text('Budget performance');
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor('#333333');
    if (budgets.length === 0) {
      doc.text('No budgets were set for this month.');
    } else {
      budgets.forEach((b) => {
        const spent = Number(b.spent);
        const amount = Number(b.amount);
        const status = spent > amount ? `OVER by ${money(spent - amount)}` : `${money(amount - spent)} left`;
        doc.text(`${b.name}: ${money(spent)} spent of ${money(amount)} budgeted — ${status}`);
      });
    }

    doc.moveDown(1.5);
    doc.fontSize(9).fillColor('#9B9A8F').text(`Generated ${new Date().toLocaleString('en-IN')} — money tracker running on your own laptop.`, { align: 'center' });

    doc.end();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate report' });
    } else {
      res.end();
    }
  }
});

module.exports = router;
