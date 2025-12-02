const amountFormatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
});

const toSafeNumber = (value) => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0;
    }

    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
};

const escapeHtml = (value = '') =>
    String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const formatAmount = (value) => amountFormatter.format(toSafeNumber(value));

const formatDisplayDate = (value) => {
    if (typeof value !== 'string') {
        return value ?? '';
    }

    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
        return value;
    }

    const [, year, month, day] = match;
    return `${day}-${month}-${year}`;
};

const buildSummaryHtml = ({
    transactions,
    summaryTotals,
    balance,
    counts,
    projectBreakdown,
    generatedAt,
}) => {
    const transactionRows = transactions
        .map((transaction) => {
            const displayDate = formatDisplayDate(transaction.date || '');
            return `
                <tr>
                    <td>${escapeHtml(displayDate)}</td>
                    <td>${escapeHtml(transaction.projectName || transaction.projectId || '')}</td>
                    <td>${escapeHtml(transaction.type)}</td>
                    <td>${escapeHtml(transaction.subcategory || '')}</td>
                    <td class="numeric">${escapeHtml(formatAmount(transaction.amount))}</td>
                    <td>${escapeHtml(transaction.description || '')}</td>
                </tr>
            `;
        })
        .join('');

    const projectRows = projectBreakdown
        .map(
            (project) => `
                <tr>
                    <td>${escapeHtml(project.projectName || project.projectId || '')}</td>
                    <td class="numeric">${escapeHtml(formatAmount(project.income))}</td>
                    <td class="numeric">${escapeHtml(formatAmount(project.expense))}</td>
                    <td class="numeric">${escapeHtml(formatAmount(project.balance))}</td>
                    <td class="numeric">${escapeHtml(project.transactionCount)}</td>
                </tr>
            `,
        )
        .join('');

    const generatedLabel = generatedAt ? dateTimeFormatter.format(generatedAt) : '';

    return `
        <!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <title>Summary Report</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        margin: 24px;
                        color: #0f172a;
                    }
                    h1, h2 {
                        margin-bottom: 8px;
                    }
                    table {
                        border-collapse: collapse;
                        width: 100%;
                        margin-bottom: 24px;
                    }
                    th, td {
                        border: 1px solid #cbd5f5;
                        padding: 8px;
                        font-size: 12px;
                    }
                    th {
                        background-color: #e2e8f0;
                        text-align: left;
                    }
                    td.numeric, th.numeric {
                        text-align: right;
                    }
                    .meta {
                        font-size: 12px;
                        color: #475569;
                        margin-bottom: 16px;
                    }
                </style>
            </head>
            <body>
                <h1>Transaction Summary</h1>
                <div class="meta">Generated ${escapeHtml(generatedLabel)}</div>
                <section>
                    <h2>Totals</h2>
                    <table>
                        <tbody>
                            <tr><th>Total Income</th><td class="numeric">${escapeHtml(formatAmount(summaryTotals.income))}</td></tr>
                            <tr><th>Total Expense</th><td class="numeric">${escapeHtml(formatAmount(summaryTotals.expense))}</td></tr>
                            <tr><th>Balance</th><td class="numeric">${escapeHtml(formatAmount(balance))}</td></tr>
                        </tbody>
                    </table>
                </section>
                <section>
                    <h2>Counts</h2>
                    <table>
                        <tbody>
                            <tr><th>Income Transactions</th><td class="numeric">${escapeHtml(counts.income)}</td></tr>
                            <tr><th>Expense Transactions</th><td class="numeric">${escapeHtml(counts.expense)}</td></tr>
                            <tr><th>Total Transactions</th><td class="numeric">${escapeHtml(counts.total)}</td></tr>
                        </tbody>
                    </table>
                </section>
                <section>
                    <h2>By Project</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Project</th>
                                <th class="numeric">Income</th>
                                <th class="numeric">Expense</th>
                                <th class="numeric">Balance</th>
                                <th class="numeric">Transactions</th>
                            </tr>
                        </thead>
                        <tbody>${projectRows}</tbody>
                    </table>
                </section>
                <section>
                    <h2>Transactions</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Project</th>
                                <th>Type</th>
                                <th>Subcategory</th>
                                <th class="numeric">Amount</th>
                                <th>Description</th>
                            </tr>
                        </thead>
                        <tbody>${transactionRows}</tbody>
                    </table>
                </section>
            </body>
        </html>
    `;
};

module.exports = {
    buildSummaryHtml,
    escapeHtml,
    formatAmount,
    formatDisplayDate,
    toSafeNumber,
};
