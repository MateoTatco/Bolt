import React, { useEffect, useState } from 'react'
import { Card, Button, Tag } from '@/components/ui'
import QuickBooksService from '@/services/QuickBooksService'

const AccountingComparison = () => {
    const [qbStatus, setQbStatus] = useState({ loading: true, hasToken: false, realmId: null, error: null })
    const [txState, setTxState] = useState({ loading: false, rows: [], error: null })

    useEffect(() => {
        let cancelled = false
        const check = async () => {
            try {
                const status = await QuickBooksService.checkToken()
                if (cancelled) return
                setQbStatus({
                    loading: false,
                    hasToken: !!status?.hasToken,
                    realmId: status?.realmId || null,
                    error: null,
                })
            } catch (err) {
                if (cancelled) return
                setQbStatus({
                    loading: false,
                    hasToken: false,
                    realmId: null,
                    error: err?.message || 'Failed to check QuickBooks connection.',
                })
            }
        }
        check()
        return () => { cancelled = true }
    }, [])

    // After QuickBooks is connected, load a small sample of transactions
    useEffect(() => {
        if (qbStatus.loading || !qbStatus.hasToken) {
            return
        }

        let cancelled = false
        const load = async () => {
            setTxState({ loading: true, rows: [], error: null })
            try {
                const data = await QuickBooksService.getSampleTransactions()
                if (cancelled) return
                setTxState({
                    loading: false,
                    rows: data?.transactions || [],
                    error: null,
                })
            } catch (err) {
                if (cancelled) return
                setTxState({
                    loading: false,
                    rows: [],
                    // Firebase callable errors put our backend message in `details`
                    error: err?.details || err?.message || 'Failed to load QuickBooks transactions.',
                })
            }
        }

        load()
        return () => { cancelled = true }
    }, [qbStatus.loading, qbStatus.hasToken])

    const handleConnectClick = () => {
        window.location.href = '/connect-quickbooks'
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold">Accounting Cost Comparison</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Compare Tatco project costs between Procore (Azure SQL) and QuickBooks. This module is currently in
                        early development for the Tatco accounting team.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Tag className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                        Tatco Accounting
                    </Tag>
                    <Tag className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                        Beta
                    </Tag>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="p-4 lg:col-span-2 space-y-4">
                    <h2 className="text-lg font-semibold mb-2">Module Status</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        We&apos;ve connected Bolt to QuickBooks and Procore. The next steps are to pull transaction data from
                        QuickBooks, align it with Tatco project numbers, and surface side-by-side cost and revenue
                        comparisons here.
                    </p>
                    <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 space-y-1">
                        <li>QuickBooks OAuth connection established.</li>
                        <li>Project profitability data already coming from Azure SQL (Procore feed).</li>
                        <li>Initial QuickBooks transaction sample loaded for reconciliation prototype.</li>
                    </ul>

                    <div className="mt-4">
                        <h3 className="text-sm font-semibold mb-2">QuickBooks Transactions (sample)</h3>
                        {txState.loading ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400">Loading transactions…</p>
                        ) : txState.error ? (
                            <p className="text-sm text-red-600 dark:text-red-400">{txState.error}</p>
                        ) : txState.rows.length === 0 ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                No transactions returned from QuickBooks for this sample query.
                            </p>
                        ) : (
                            <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-md">
                                <table className="min-w-full text-xs">
                                    <thead className="bg-gray-50 dark:bg-gray-800">
                                        <tr>
                                            <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">
                                                Doc #
                                            </th>
                                            <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">
                                                Date
                                            </th>
                                            <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">
                                                Type
                                            </th>
                                            <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">
                                                Customer
                                            </th>
                                            <th className="px-3 py-2 text-right font-semibold text-gray-600 dark:text-gray-300">
                                                Total
                                            </th>
                                            <th className="px-3 py-2 text-right font-semibold text-gray-600 dark:text-gray-300">
                                                Balance
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {txState.rows.slice(0, 10).map((row, idx) => (
                                            <tr
                                                key={row.id || idx}
                                                className={idx % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800'}
                                            >
                                                <td className="px-3 py-2 whitespace-nowrap text-gray-800 dark:text-gray-200 font-mono">
                                                    {row.docNumber ?? row.id ?? '-'}
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap text-gray-800 dark:text-gray-200">
                                                    {row.txnDate || '-'}
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap text-gray-800 dark:text-gray-200">
                                                    {row.txnType || '-'}
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap text-gray-800 dark:text-gray-200">
                                                    {row.customerName || '-'}
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap text-right text-gray-800 dark:text-gray-200">
                                                    {typeof row.totalAmt === 'number'
                                                        ? new Intl.NumberFormat('en-US', {
                                                              style: 'currency',
                                                              currency: 'USD',
                                                              minimumFractionDigits: 2,
                                                              maximumFractionDigits: 2,
                                                          }).format(row.totalAmt)
                                                        : '-'}
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap text-right text-gray-800 dark:text-gray-200">
                                                    {typeof row.balance === 'number'
                                                        ? new Intl.NumberFormat('en-US', {
                                                              style: 'currency',
                                                              currency: 'USD',
                                                              minimumFractionDigits: 2,
                                                              maximumFractionDigits: 2,
                                                          }).format(row.balance)
                                                        : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </Card>

                <Card className="p-4">
                    <h3 className="text-sm font-semibold mb-2">QuickBooks Connection</h3>
                    {qbStatus.loading ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">Checking connection…</p>
                    ) : qbStatus.error ? (
                        <p className="text-sm text-red-600 dark:text-red-400">{qbStatus.error}</p>
                    ) : qbStatus.hasToken ? (
                        <>
                            <p className="text-sm text-emerald-600 dark:text-emerald-400 mb-2">
                                Connected to QuickBooks.
                            </p>
                            {qbStatus.realmId && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 break-all">
                                    Realm ID: <span className="font-mono">{qbStatus.realmId}</span>
                                </p>
                            )}
                        </>
                    ) : (
                        <>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                QuickBooks is not connected for your user yet.
                            </p>
                            <Button size="sm" variant="solid" onClick={handleConnectClick}>
                                Connect QuickBooks
                            </Button>
                        </>
                    )}
                </Card>
            </div>
        </div>
    )
}

export default AccountingComparison

