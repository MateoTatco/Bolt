import React, { useEffect, useState, useCallback } from 'react'
import { Card, Button, Tag, Input } from '@/components/ui'
import QuickBooksService from '@/services/QuickBooksService'
import { ProcoreService } from '@/services/ProcoreService'
import { useLocation } from 'react-router'

const AccountingComparison = () => {
    const [qbStatus, setQbStatus] = useState({ loading: true, hasToken: false, realmId: null, error: null })
    const [txState, setTxState] = useState({ loading: false, rows: [], error: null })
    const [projectNumber, setProjectNumber] = useState('')
    const [projectSummary, setProjectSummary] = useState({
        loading: false,
        data: null,
        error: null,
    })
    const [azureState, setAzureState] = useState({
        loading: false,
        data: null,
        error: null,
    })
    const location = useLocation()

    const formatCurrency = (value) => {
        if (typeof value !== 'number') return '-'
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value)
    }

    const formatDate = (value) => {
        if (!value) return '-'
        const d = new Date(value)
        if (isNaN(d.getTime())) return value
        return d.toISOString().slice(0, 10)
    }

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

    const loadProjectSummary = useCallback(
        async (projNumber) => {
            const trimmed = (projNumber || '').trim()
            if (!trimmed || projectSummary.loading) return
            setProjectSummary({ loading: true, data: null, error: null })
            try {
                const data = await QuickBooksService.getProjectInvoicesSummary(trimmed)
                setProjectSummary({ loading: false, data, error: null })
            } catch (err) {
                setProjectSummary({
                    loading: false,
                    data: null,
                    error: err?.details || err?.message || 'Failed to load QuickBooks project summary.',
                })
            }
        },
        [projectSummary.loading]
    )

    const loadAzureSummary = useCallback(
        async (projNumber) => {
            const trimmed = (projNumber || '').trim()
            if (!trimmed || azureState.loading) return
            setAzureState({ loading: true, data: null, error: null })
            try {
                const result = await ProcoreService.investigateProjectInAzure(trimmed)
                setAzureState({ loading: false, data: result, error: null })
            } catch (err) {
                setAzureState({
                    loading: false,
                    data: null,
                    error: err?.details || err?.message || 'Failed to load Project Profitability summary.',
                })
            }
        },
        [azureState.loading]
    )

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

    // If navigated with ?projectNumber=1234, pre-fill and auto-load project summary once QB is connected
    useEffect(() => {
        const params = new URLSearchParams(location.search)
        const initialProjectNumber = params.get('projectNumber')
        if (initialProjectNumber) {
            setProjectNumber(initialProjectNumber)
            if (!qbStatus.loading && qbStatus.hasToken && !projectSummary.loading && !projectSummary.data) {
                loadProjectSummary(initialProjectNumber)
            }
            if (!azureState.loading && !azureState.data && !azureState.error) {
                loadAzureSummary(initialProjectNumber)
            }
        }
    }, [
        location.search,
        qbStatus.loading,
        qbStatus.hasToken,
        projectSummary.loading,
        projectSummary.data,
        azureState.loading,
        azureState.data,
        azureState.error,
        loadProjectSummary,
        loadAzureSummary,
    ])

    const handleConnectClick = () => {
        window.location.href = '/connect-quickbooks'
    }

    const params = new URLSearchParams(location.search)
    const projectNameFromUrl = params.get('projectName')

    // Derive simple KPIs from the loaded project summary
    const hasProjectSummary = !!projectSummary.data
    const totalRevenue = hasProjectSummary ? projectSummary.data.totalRevenue : null
    const invoiceCount = hasProjectSummary ? projectSummary.data.invoiceCount : 0
    const firstCustomer = hasProjectSummary && projectSummary.data.quickbooksCustomers?.length
        ? projectSummary.data.quickbooksCustomers[0]
        : null
    const invoices = hasProjectSummary ? projectSummary.data.invoices || [] : []
    const latestInvoice = invoices.reduce((latest, inv) => {
        if (!inv?.txnDate) return latest
        if (!latest) return inv
        return new Date(inv.txnDate) > new Date(latest.txnDate) ? inv : latest
    }, null)

    // Azure / Procore (Project Profitability) summary
    const azureRecords = azureState.data?.records || []
    const azurePrimary = azureRecords[0] || null
    const contractAmount = azurePrimary?.contractAmount ?? null
    const estCostAtCompletion = azurePrimary?.estCostAtCompletion ?? null
    const projectedProfit = azurePrimary?.projectedProfit ?? null

    const revenueVsContract =
        typeof totalRevenue === 'number' && typeof contractAmount === 'number'
            ? totalRevenue - contractAmount
            : null

    const variancePercent =
        typeof revenueVsContract === 'number' && typeof contractAmount === 'number' && contractAmount !== 0
            ? (revenueVsContract / contractAmount) * 100
            : null

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold">Accounting Cost Comparison</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Compare Tatco project costs and revenue between Procore (Azure SQL) and QuickBooks.
                    </p>
                    {projectNumber && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Project:{' '}
                            <span className="font-mono">{projectNumber}</span>
                            {projectNameFromUrl ? (
                                <span className="ml-1">– {projectNameFromUrl}</span>
                            ) : null}
                        </p>
                    )}
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

            {/* High-level KPIs for the currently selected project */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white">
                    <p className="text-xs uppercase tracking-wide opacity-75">QuickBooks Revenue (project)</p>
                    <p className="mt-2 text-2xl font-semibold">
                        {hasProjectSummary ? formatCurrency(totalRevenue) : '—'}
                    </p>
                    <p className="mt-1 text-xs opacity-75">
                        {hasProjectSummary ? `${invoiceCount} invoices` : 'Load a project to see totals.'}
                    </p>
                    {typeof revenueVsContract === 'number' && (
                        <p className="mt-1 text-xs opacity-75">
                            vs contract: {formatCurrency(revenueVsContract)}{' '}
                            {revenueVsContract >= 0 ? 'above' : 'below'}
                        </p>
                    )}
                </Card>
                <Card className="p-4 bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 border border-emerald-200 dark:border-emerald-800">
                    <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                        Primary QuickBooks customer
                    </p>
                    <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {firstCustomer ? firstCustomer.displayName || firstCustomer.fullyQualifiedName || '—' : '—'}
                    </p>
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                        {firstCustomer ? 'Matched by project number prefix.' : 'No customers matched yet.'}
                    </p>
                </Card>
                <Card className="p-4 bg-gradient-to-r from-blue-500/10 to-blue-500/5 border border-blue-200 dark:border-blue-800">
                    <p className="text-xs uppercase tracking-wide text-blue-700 dark:text-blue-300">
                        Latest QuickBooks invoice
                    </p>
                    <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {latestInvoice ? formatDate(latestInvoice.txnDate) : '—'}
                    </p>
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                        {latestInvoice
                            ? `${formatCurrency(latestInvoice.totalAmt)} • ${latestInvoice.customerName || ''}`
                            : 'Load a project to see recent billing.'}
                    </p>
                </Card>
            </div>

            {/* Azure SQL / Project Profitability KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Contract value (Azure SQL)
                    </p>
                    <p className="mt-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
                        {contractAmount !== null ? formatCurrency(contractAmount) : '—'}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        From latest Project Profitability archive snapshot.
                    </p>
                </Card>
                <Card className="p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Est. cost at completion (Azure SQL)
                    </p>
                    <p className="mt-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
                        {estCostAtCompletion !== null ? formatCurrency(estCostAtCompletion) : '—'}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Matches Project Profitability estimates.
                    </p>
                </Card>
                <Card className="p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Projected profit (Azure SQL)
                    </p>
                    <p className="mt-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
                        {projectedProfit !== null ? formatCurrency(projectedProfit) : '—'}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Used as Procore/Bolt baseline for comparison.
                    </p>
                </Card>
            </div>

            {/* High-level comparison summary */}
            <Card className="p-4">
                <h2 className="text-sm font-semibold mb-3">QuickBooks vs Project Profitability (high-level)</h2>
                {(!hasProjectSummary && contractAmount === null) ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Select a project and load QuickBooks revenue to see a side-by-side comparison with Project Profitability.
                    </p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                        <div>
                            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                QBO revenue
                            </p>
                            <p className="mt-1 font-semibold text-gray-900 dark:text-gray-100">
                                {hasProjectSummary ? formatCurrency(totalRevenue) : '—'}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                Contract value (Azure)
                            </p>
                            <p className="mt-1 font-semibold text-gray-900 dark:text-gray-100">
                                {contractAmount !== null ? formatCurrency(contractAmount) : '—'}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                Variance
                            </p>
                            <p className="mt-1 font-semibold text-gray-900 dark:text-gray-100">
                                {typeof revenueVsContract === 'number' ? formatCurrency(revenueVsContract) : '—'}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                Variance %
                            </p>
                            <p className="mt-1 font-semibold">
                                {typeof variancePercent === 'number'
                                    ? `${variancePercent >= 0 ? '+' : ''}${variancePercent.toFixed(1)}%`
                                    : '—'}
                            </p>
                        </div>
                    </div>
                )}
            </Card>

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
                            <div className="space-y-2">
                                <p className="text-sm text-red-600 dark:text-red-400">{txState.error}</p>
                                {typeof txState.error === 'string' &&
                                txState.error.toLowerCase().includes('authorization has expired') ? (
                                    <Button size="sm" variant="outline" onClick={handleConnectClick}>
                                        Reconnect QuickBooks
                                    </Button>
                                ) : null}
                            </div>
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

                    <div className="mt-6 border-t border-gray-200 dark:border-gray-800 pt-4">
                        <h3 className="text-sm font-semibold mb-2">QuickBooks Project Revenue (by project number)</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                            Enter a Tatco project number (the numeric prefix in the QuickBooks customer name, for example
                            <span className="font-mono"> 2355</span>) to see total invoice revenue for that project in QuickBooks.
                        </p>
                        <div className="flex flex-col md:flex-row md:items-center gap-2 mb-3">
                            <Input
                                size="sm"
                                className="md:w-48"
                                placeholder="Project number"
                                value={projectNumber}
                                onChange={(e) => setProjectNumber(e.target.value)}
                            />
                            <Button
                                size="sm"
                                variant="solid"
                                disabled={!qbStatus.hasToken || !projectNumber.trim() || projectSummary.loading}
                                onClick={async () => {
                                    if (!projectNumber.trim()) return
                                    loadProjectSummary(projectNumber.trim())
                                }}
                            >
                                Load QuickBooks revenue
                            </Button>
                        </div>

                        {projectSummary.loading ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400">Loading project revenue…</p>
                        ) : projectSummary.error ? (
                            <div className="space-y-2">
                                <p className="text-sm text-red-600 dark:text-red-400">{projectSummary.error}</p>
                                {typeof projectSummary.error === 'string' &&
                                projectSummary.error.toLowerCase().includes('authorization has expired') ? (
                                    <Button size="sm" variant="outline" onClick={handleConnectClick}>
                                        Reconnect QuickBooks
                                    </Button>
                                ) : null}
                            </div>
                        ) : projectSummary.data ? (
                            <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                                <p>
                                    <span className="font-semibold">Project number:</span>{' '}
                                    <span className="font-mono">{projectSummary.data.projectNumber}</span>
                                </p>
                                <p>
                                    <span className="font-semibold">Matched QuickBooks customers:</span>{' '}
                                    {projectSummary.data.quickbooksCustomers?.length || 0}
                                </p>
                                <p>
                                    <span className="font-semibold">Invoice count:</span>{' '}
                                    {projectSummary.data.invoiceCount}
                                </p>
                                <p>
                                    <span className="font-semibold">Total QuickBooks revenue:</span>{' '}
                                    {typeof projectSummary.data.totalRevenue === 'number'
                                        ? new Intl.NumberFormat('en-US', {
                                              style: 'currency',
                                              currency: 'USD',
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 2,
                                          }).format(projectSummary.data.totalRevenue)
                                        : '-'}
                                </p>
                            </div>
                        ) : null}
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

