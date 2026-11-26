// Summary cards for the live wallet ledger — every number comes from GET /finance/actions/wallets.
const rupee = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN')}`

export const buildLiveOverviewCards = (s) => [
    { label: 'Total Held in Wallets', value: rupee(s.totalHeld), sub: `across ${s.walletCount} wallets`, iconTone: 'info' },
    { label: 'Active Wallets', value: String(s.active), sub: `${s.zeroBalance} with zero balance`, subTone: 'success', iconTone: 'success' },
    { label: 'Recharges Today', value: rupee(s.rechargesTodayAmount), sub: `${s.rechargesTodayCount} transactions`, iconTone: 'success' },
    { label: 'Spent Today', value: rupee(s.spentTodayAmount), sub: `${s.spentTodayCount} transactions`, iconTone: 'warning' },
]

export const buildLiveWalletCards = (s) => [
    { label: 'Total Wallets', value: String(s.walletCount), sub: 'this campus', iconTone: 'info' },
    { label: 'Zero Balance', value: String(s.zeroBalance), sub: s.zeroBalance ? 'needs recharge nudge' : 'none', subTone: s.zeroBalance ? 'danger' : undefined, iconTone: s.zeroBalance ? 'danger' : 'info' },
    { label: 'Frozen / Flagged', value: String(s.frozenOrFlagged), sub: s.frozenOrFlagged ? 'under review' : 'none', subTone: s.frozenOrFlagged ? 'danger' : undefined, iconTone: s.frozenOrFlagged ? 'danger' : 'info' },
    { label: 'Avg. Wallet Balance', value: rupee(Math.round(s.avgBalance)), sub: 'per wallet', iconTone: 'info' },
]

export const buildLiveRechargeCards = (s) => [
    { label: 'Total Recharged (This Month)', value: rupee(s.rechargesMonthAmount), sub: `${s.rechargesMonthCount} transactions`, subTone: 'success', iconTone: 'success' },
    { label: 'Avg. Recharge Amount', value: rupee(Math.round(s.avgRecharge)), sub: 'per transaction', iconTone: 'info' },
    { label: 'Failed Recharges', value: String(s.failedRecharges), sub: s.failedRecharges ? 'needs retry / refund' : 'none', subTone: s.failedRecharges ? 'danger' : undefined, iconTone: s.failedRecharges ? 'danger' : 'info' },
]

export const buildLiveSpendCards = (s) => {
    const top = s.spendCategories?.[0]
    return [
        { label: 'Total Spent (This Month)', value: rupee(s.spentMonthAmount), sub: `${s.spentMonthCount} transactions`, iconTone: 'danger' },
        { label: 'Top Spend Category', value: top ? top.label : '—', sub: top ? `${top.percent} of total spend` : 'no spend yet', iconTone: 'info' },
        { label: 'Avg. Spend / Wallet', value: rupee(s.walletCount ? Math.round(s.spentMonthAmount / s.walletCount) : 0), sub: 'this month', iconTone: 'info' },
    ]
}
