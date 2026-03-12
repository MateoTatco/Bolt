import React, { useEffect, useState, useCallback } from 'react'
import { Card, Button, Tag, Input } from '@/components/ui'
import Chart from '@/components/shared/Chart'
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
    const [qbVendorsState, setQbVendorsState] = useState({
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
                // eslint-disable-next-line no-console
                console.log('[AccountingComparison] Loading Azure summary for project', trimmed)
                const result = await ProcoreService.investigateProjectInAzure(trimmed)
                // eslint-disable-next-line no-console
                console.log('[AccountingComparison] Azure summary result', result)
                setAzureState({ loading: false, data: result, error: null })
            } catch (err) {
                // eslint-disable-next-line no-console
                console.error('[AccountingComparison] Error loading Azure summary', err)
                setAzureState({
                    loading: false,
                    data: null,
                    error: err?.details || err?.message || 'Failed to load Project Profitability summary.',
                })
            }
        },
        [azureState.loading]
    )

    const loadQuickBooksVendorCosts = useCallback(
        async (projNumber) => {
            const trimmed = (projNumber || '').trim()
            if (!trimmed || qbVendorsState.loading) return
            setQbVendorsState({ loading: true, data: null, error: null })
            try {
                const data = await QuickBooksService.getProjectVendorCostsSummary(trimmed)
                setQbVendorsState({ loading: false, data, error: null })
            } catch (err) {
                setQbVendorsState({
                    loading: false,
                    data: null,
                    error: err?.details || err?.message || 'Failed to load QuickBooks vendor costs.',
                })
            }
        },
        [qbVendorsState.loading]
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
                if (!qbVendorsState.loading && !qbVendorsState.data && !qbVendorsState.error) {
                    loadQuickBooksVendorCosts(initialProjectNumber)
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
        qbVendorsState.loading,
        qbVendorsState.data,
        qbVendorsState.error,
        loadQuickBooksVendorCosts,
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
    const jobCostToDate = azurePrimary?.jobCostToDate ?? null
    const remainingCost = azurePrimary?.remainingCost ?? null
    const projectedProfitPercent = azurePrimary?.projectedProfitPercent ?? null
    const totalInvoicedAzure = azurePrimary?.totalInvoiced ?? null
    const balanceLeftOnContract = azurePrimary?.balanceLeftOnContract ?? null
    const percentCompleteCost = azurePrimary?.percentCompleteCost ?? null
    const percentCompleteRevenue = azurePrimary?.percentCompleteRevenue ?? null
    const customerRetainage = azurePrimary?.customerRetainage ?? null
    const vendorRetainage = azurePrimary?.vendorRetainage ?? null

    const revenueVsContract =
        typeof totalRevenue === 'number' && typeof contractAmount === 'number'
            ? totalRevenue - contractAmount
            : null

    const variancePercent =
        typeof revenueVsContract === 'number' && typeof contractAmount === 'number' && contractAmount !== 0
            ? (revenueVsContract / contractAmount) * 100
            : null

    // Reconciliation-focused metrics (revenue vs Azure cost & profit)
    const revenueVsJobCost =
        typeof totalRevenue === 'number' && typeof jobCostToDate === 'number'
            ? totalRevenue - jobCostToDate
            : null

    const marginPercentActual =
        typeof revenueVsJobCost === 'number' && typeof totalRevenue === 'number' && totalRevenue !== 0
            ? (revenueVsJobCost / totalRevenue) * 100
            : null

    const varianceVsProjectedProfit =
        typeof revenueVsJobCost === 'number' && typeof projectedProfit === 'number'
            ? revenueVsJobCost - projectedProfit
            : null

    const handleDownloadReconciliationCsv = useCallback(() => {
        if (!projectNumber || !hasProjectSummary || !azurePrimary) return

        const rows = []
        rows.push(['Project number', projectNumber])
        if (projectNameFromUrl) {
            rows.push(['Project name', projectNameFromUrl])
        }
        rows.push([])
        rows.push(['Metric', 'QuickBooks', 'Project Profitability (Azure)', 'Variance'])

        const currencyOrDash = (val) =>
            typeof val === 'number' ? formatCurrency(val) : '-'
        const percentOrDash = (val) =>
            typeof val === 'number' ? `${val.toFixed(1)}%` : '-'

        rows.push([
            'Revenue vs contract',
            currencyOrDash(totalRevenue),
            currencyOrDash(contractAmount),
            currencyOrDash(revenueVsContract),
        ])

        rows.push([
            'Revenue vs job cost (margin $)',
            currencyOrDash(totalRevenue),
            currencyOrDash(jobCostToDate),
            currencyOrDash(revenueVsJobCost),
        ])

        rows.push([
            'Margin % (actual vs QBO revenue)',
            percentOrDash(marginPercentActual),
            '',
            '',
        ])

        rows.push([
            'Projected profit (Azure)',
            '',
            currencyOrDash(projectedProfit),
            currencyOrDash(varianceVsProjectedProfit),
        ])

        const csv = rows
            .map((row) =>
                row
                    .map((cell) => {
                        const value = cell == null ? '' : String(cell)
                        if (value.includes(',') || value.includes('"')) {
                            return `"${value.replace(/"/g, '""')}"`
                        }
                        return value
                    })
                    .join(',')
            )
            .join('\n')

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        const safeProject = (projectNumber || 'project').toString()
        link.href = url
        link.setAttribute('download', `tatco-accounting-comparison-${safeProject}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }, [
        projectNumber,
        projectNameFromUrl,
        hasProjectSummary,
        azurePrimary,
        totalRevenue,
        contractAmount,
        revenueVsContract,
        jobCostToDate,
        revenueVsJobCost,
        marginPercentActual,
        projectedProfit,
        varianceVsProjectedProfit,
    ])

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

            {/* Project lookup — primary entry point */}
            <Card className="p-4">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Select project</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    Enter a Tatco project number (e.g. <span className="font-mono">1130003</span>) to compare QuickBooks revenue with Project Profitability (Azure SQL). You can also open from Project Profitability via &quot;Open in Accounting&quot;.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                    <Input
                        size="sm"
                        className="w-full sm:w-48"
                        placeholder="Project number"
                        value={projectNumber}
                        onChange={(e) => setProjectNumber(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && projectNumber.trim() && (loadProjectSummary(projectNumber.trim()), loadAzureSummary(projectNumber.trim()))}
                    />
                    <Button
                        size="sm"
                        variant="solid"
                        disabled={!qbStatus.hasToken || !projectNumber.trim() || projectSummary.loading}
                        onClick={() => {
                            if (!projectNumber.trim()) return
                            const trimmed = projectNumber.trim()
                            loadProjectSummary(trimmed)
                            loadAzureSummary(trimmed)
                        }}
                    >
                        Load project
                    </Button>
                    {projectSummary.loading && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">Loading…</span>
                    )}
                </div>
                {projectSummary.error ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        <p className="text-sm text-red-600 dark:text-red-400">{projectSummary.error}</p>
                        {typeof projectSummary.error === 'string' && projectSummary.error.toLowerCase().includes('authorization has expired') ? (
                            <Button size="sm" variant="outline" onClick={handleConnectClick}>
                                Reconnect QuickBooks
                            </Button>
                        ) : null}
                    </div>
                ) : null}
                {projectSummary.data ? (
                    <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                        Loaded: <span className="font-mono">{projectSummary.data.projectNumber}</span>
                        {' · '}{projectSummary.data.quickbooksCustomers?.length || 0} customer(s)
                        {' · '}{projectSummary.data.invoiceCount} invoices
                        {' · '}{typeof projectSummary.data.totalRevenue === 'number' ? formatCurrency(projectSummary.data.totalRevenue) : '—'} total revenue
                    </p>
                ) : null}
            </Card>

            {/* QuickBooks KPI strip */}
            <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                    QuickBooks KPIs
                </h2>
                {hasProjectSummary ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Based on {invoiceCount} invoice{invoiceCount === 1 ? '' : 's'} in QuickBooks.
                    </p>
                ) : null}
            </div>
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

            {/* Azure SQL / Project Profitability KPI strip */}
            <div className="flex items-center justify-between gap-2 mt-2">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                    Project Profitability KPIs (Azure SQL)
                </h2>
                {azureRecords.length > 0 && azureState.data?.mostRecentArchiveDate ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Latest archive: <span className="font-mono">{azureState.data.mostRecentArchiveDate}</span>
                    </p>
                ) : null}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Contract value (Azure SQL)
                    </p>
                    <p className="mt-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
                        {contractAmount !== null ? formatCurrency(contractAmount) : '—'}
                    </p>
                    {azureState.loading ? (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Loading Project Profitability snapshot…
                        </p>
                    ) : azureState.error ? (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                            {azureState.error}
                        </p>
                    ) : azureRecords.length === 0 ? (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            No Project Profitability snapshot found in Azure for this project number.
                        </p>
                    ) : (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            From latest Project Profitability archive snapshot.
                        </p>
                    )}
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
                <div className="flex items-center justify-between gap-2 mb-3">
                    <h2 className="text-sm font-semibold">QuickBooks vs Project Profitability (high-level)</h2>
                    {hasProjectSummary && azurePrimary && (
                        <Button
                            size="xs"
                            variant="outline"
                            className="text-[11px]"
                            onClick={handleDownloadReconciliationCsv}
                        >
                            Export reconciliation CSV
                        </Button>
                    )}
                </div>
                {(!hasProjectSummary && contractAmount === null) ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Select a project and load QuickBooks revenue to see a side-by-side comparison with Project Profitability.
                    </p>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm mb-4">
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

                        {typeof totalRevenue === 'number' && typeof contractAmount === 'number' ? (
                            <div className="mt-2">
                                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                                    Visual comparison
                                </p>
                                <div className="relative h-3 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                                    {/* Azure contract bar */}
                                    <div
                                        className="absolute inset-y-0 left-0 bg-blue-500/70"
                                        style={{
                                            width: '100%',
                                        }}
                                    />
                                    {/* QBO marker */}
                                    <div
                                        className="absolute -top-1 bottom-0 w-0.5 bg-emerald-400"
                                        style={{
                                            left:
                                                contractAmount !== 0
                                                    ? `${Math.min(
                                                          100,
                                                          Math.max(0, (totalRevenue / contractAmount) * 100)
                                                      )}%`
                                                    : '0%',
                                        }}
                                    />
                                </div>
                                <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                                    <span>0</span>
                                    <span>Contract value</span>
                                    <span>QBO revenue marker</span>
                                </div>
                            </div>
                        ) : null}

                        {/* Bar chart: QuickBooks vs Project Profitability */}
                        {(typeof totalRevenue === 'number' || typeof contractAmount === 'number') &&
                         (totalRevenue > 0 || (contractAmount !== null && contractAmount > 0)) ? (
                            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                                    Revenue vs contract (chart)
                                </p>
                                <Chart
                                    type="bar"
                                    height={220}
                                    xAxis={['QBO revenue', 'Contract (Azure)', 'Projected profit']}
                                    series={[
                                        {
                                            name: 'Amount',
                                            data: [
                                                typeof totalRevenue === 'number' ? totalRevenue : 0,
                                                typeof contractAmount === 'number' ? contractAmount : 0,
                                                typeof projectedProfit === 'number' ? projectedProfit : 0,
                                            ],
                                        },
                                    ]}
                                    customOptions={{
                                        plotOptions: {
                                            bar: {
                                                columnWidth: '50%',
                                                distributed: true,
                                            },
                                        },
                                        colors: ['#10b981', '#3b82f6', '#8b5cf6'],
                                        legend: { show: false },
                                        tooltip: {
                                            y: {
                                                formatter: (val) =>
                                                    new Intl.NumberFormat('en-US', {
                                                        style: 'currency',
                                                        currency: 'USD',
                                                        minimumFractionDigits: 0,
                                                        maximumFractionDigits: 0,
                                                    }).format(val),
                                            },
                                        },
                                        dataLabels: {
                                            enabled: true,
                                            formatter: (val) =>
                                                val >= 1e6
                                                    ? `$${(val / 1e6).toFixed(2)}M`
                                                    : val >= 1e3
                                                      ? `$${(val / 1e3).toFixed(1)}K`
                                                      : `$${Math.round(val)}`,
                                        },
                                    }}
                                />
                            </div>
                        ) : null}

                        {/* Reconciliation metrics table (high-level only) */}
                        {(hasProjectSummary && azurePrimary) && (
                            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                                    Reconciliation metrics
                                </p>
                                <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
                                    <table className="min-w-full text-xs">
                                        <thead className="bg-gray-50 dark:bg-gray-800">
                                            <tr>
                                                <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">
                                                    Metric
                                                </th>
                                                <th className="px-3 py-2 text-right font-semibold text-gray-600 dark:text-gray-300">
                                                    QuickBooks
                                                </th>
                                                <th className="px-3 py-2 text-right font-semibold text-gray-600 dark:text-gray-300">
                                                    Project Profitability
                                                </th>
                                                <th className="px-3 py-2 text-right font-semibold text-gray-600 dark:text-gray-300">
                                                    Variance
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="bg-white dark:bg-gray-900">
                                                <td className="px-3 py-2 text-gray-800 dark:text-gray-100">
                                                    Revenue vs contract
                                                </td>
                                                <td className="px-3 py-2 text-right text-gray-800 dark:text-gray-100">
                                                    {typeof totalRevenue === 'number' ? formatCurrency(totalRevenue) : '—'}
                                                </td>
                                                <td className="px-3 py-2 text-right text-gray-800 dark:text-gray-100">
                                                    {contractAmount !== null ? formatCurrency(contractAmount) : '—'}
                                                </td>
                                                <td className="px-3 py-2 text-right text-gray-800 dark:text-gray-100">
                                                    {typeof revenueVsContract === 'number' ? formatCurrency(revenueVsContract) : '—'}
                                                </td>
                                            </tr>
                                            <tr className="bg-gray-50 dark:bg-gray-800">
                                                <td className="px-3 py-2 text-gray-800 dark:text-gray-100">
                                                    Revenue vs job cost (margin $)
                                                </td>
                                                <td className="px-3 py-2 text-right text-gray-800 dark:text-gray-100">
                                                    {typeof totalRevenue === 'number' ? formatCurrency(totalRevenue) : '—'}
                                                </td>
                                                <td className="px-3 py-2 text-right text-gray-800 dark:text-gray-100">
                                                    {typeof jobCostToDate === 'number' ? formatCurrency(jobCostToDate) : '—'}
                                                </td>
                                                <td className="px-3 py-2 text-right text-gray-800 dark:text-gray-100">
                                                    {typeof revenueVsJobCost === 'number' ? formatCurrency(revenueVsJobCost) : '—'}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </Card>

            {/* Reconciliation insights (detail dashboard) */}
            {hasProjectSummary && azurePrimary && (
                <Card className="p-4">
                    <h2 className="text-sm font-semibold mb-3">Reconciliation insights (project-level)</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="space-y-1">
                            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                Margin & projected profit
                            </p>
                            <p>
                                <span className="text-gray-500 dark:text-gray-400">Actual margin (revenue − job cost): </span>
                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                    {typeof revenueVsJobCost === 'number' ? formatCurrency(revenueVsJobCost) : '—'}
                                </span>
                                {typeof marginPercentActual === 'number' && (
                                    <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                                        ({marginPercentActual.toFixed(1)}%)
                                    </span>
                                )}
                            </p>
                            <p>
                                <span className="text-gray-500 dark:text-gray-400">Projected profit (Azure): </span>
                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                    {projectedProfit !== null ? formatCurrency(projectedProfit) : '—'}
                                </span>
                                {typeof projectedProfitPercent === 'number' && (
                                    <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                                        ({projectedProfitPercent.toFixed(1)}%)
                                    </span>
                                )}
                            </p>
                            <p>
                                <span className="text-gray-500 dark:text-gray-400">Variance (actual vs projected): </span>
                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                    {typeof varianceVsProjectedProfit === 'number'
                                        ? formatCurrency(varianceVsProjectedProfit)
                                        : '—'}
                                </span>
                            </p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                Cost to date (Project Profitability)
                            </p>
                            <p>
                                <span className="text-gray-500 dark:text-gray-400">Job cost to date: </span>
                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                    {typeof jobCostToDate === 'number' ? formatCurrency(jobCostToDate) : '—'}
                                </span>
                            </p>
                            <p>
                                <span className="text-gray-500 dark:text-gray-400">Remaining cost: </span>
                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                    {typeof remainingCost === 'number' ? formatCurrency(remainingCost) : '—'}
                                </span>
                            </p>
                            <p>
                                <span className="text-gray-500 dark:text-gray-400">Contract value: </span>
                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                    {contractAmount !== null ? formatCurrency(contractAmount) : '—'}
                                </span>
                            </p>
                        </div>
                    </div>
                </Card>
            )}

            {/* Project Profitability details (Azure SQL) */}
            {azurePrimary && (
                <Card className="p-4">
                    <div className="flex items-center justify-between gap-2 mb-3">
                        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                            Project Profitability details (Azure SQL)
                        </h2>
                        {azureState.data?.mostRecentArchiveDate && (
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                Latest archive:{' '}
                                <span className="font-mono">{azureState.data.mostRecentArchiveDate}</span>
                            </p>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="space-y-1">
                            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                Contract & revenue
                            </p>
                            <p>
                                <span className="text-gray-500 dark:text-gray-400">Contract value: </span>
                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                    {contractAmount !== null ? formatCurrency(contractAmount) : '—'}
                                </span>
                            </p>
                            <p>
                                <span className="text-gray-500 dark:text-gray-400">Total invoiced: </span>
                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                    {typeof totalInvoicedAzure === 'number' ? formatCurrency(totalInvoicedAzure) : '—'}
                                </span>
                            </p>
                            <p>
                                <span className="text-gray-500 dark:text-gray-400">Balance left on contract: </span>
                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                    {typeof balanceLeftOnContract === 'number'
                                        ? formatCurrency(balanceLeftOnContract)
                                        : '—'}
                                </span>
                            </p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                Cost & profit
                            </p>
                            <p>
                                <span className="text-gray-500 dark:text-gray-400">Job cost to date: </span>
                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                    {typeof jobCostToDate === 'number' ? formatCurrency(jobCostToDate) : '—'}
                                </span>
                            </p>
                            <p>
                                <span className="text-gray-500 dark:text-gray-400">Remaining cost: </span>
                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                    {typeof remainingCost === 'number' ? formatCurrency(remainingCost) : '—'}
                                </span>
                            </p>
                            <p>
                                <span className="text-gray-500 dark:text-gray-400">Projected profit: </span>
                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                    {projectedProfit !== null ? formatCurrency(projectedProfit) : '—'}
                                </span>
                                {typeof projectedProfitPercent === 'number' && (
                                    <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                                        ({projectedProfitPercent.toFixed(1)}%)
                                    </span>
                                )}
                            </p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                Percent complete
                            </p>
                            <p>
                                <span className="text-gray-500 dark:text-gray-400">Based on revenue: </span>
                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                    {typeof percentCompleteRevenue === 'number'
                                        ? `${percentCompleteRevenue.toFixed(1)}%`
                                        : '—'}
                                </span>
                            </p>
                            <p>
                                <span className="text-gray-500 dark:text-gray-400">Based on cost: </span>
                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                    {typeof percentCompleteCost === 'number'
                                        ? `${percentCompleteCost.toFixed(1)}%`
                                        : '—'}
                                </span>
                            </p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                Retainage
                            </p>
                            <p>
                                <span className="text-gray-500 dark:text-gray-400">Customer retainage: </span>
                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                    {typeof customerRetainage === 'number'
                                        ? formatCurrency(customerRetainage)
                                        : '—'}
                                </span>
                            </p>
                            <p>
                                <span className="text-gray-500 dark:text-gray-400">Vendor retainage: </span>
                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                    {typeof vendorRetainage === 'number'
                                        ? formatCurrency(vendorRetainage)
                                        : '—'}
                                </span>
                            </p>
                        </div>
                    </div>
                </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="p-4 lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Module status & tools</h2>
                        <span className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
                            Read-only · No sync to QBO or Procore
                        </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                        This module is live for Tatco accounting: project-level revenue from QuickBooks is compared against contract value and projected profit from Project Profitability (Azure SQL). All data is read-only; nothing is pushed to QuickBooks or Procore.
                    </p>
                    <ul className="list-disc list-inside text-xs text-gray-700 dark:text-gray-300 space-y-1">
                        <li><strong>QuickBooks:</strong> OAuth connected per Bolt user; project revenue by customer name prefix; sample invoices for sanity checks.</li>
                        <li><strong>Project Profitability (Azure SQL):</strong> Contract value, est. cost at completion, projected profit from latest archive per project.</li>
                        <li><strong>Comparison:</strong> Variance (QBO vs contract), bar chart, and progress bar shown when a project is loaded.</li>
                    </ul>

                    <div className="mt-4 border-t border-gray-200 dark:border-gray-800 pt-4">
                        <h3 className="text-sm font-semibold mb-1">QuickBooks sample transactions</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                            A rotating sample from QuickBooks, useful for spot-checking that the connection and basic invoice
                            fields look correct.
                        </p>
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

