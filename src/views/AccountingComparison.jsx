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

    const hasLoadedProject = !!projectSummary.data

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                        Accounting Cost Comparison
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Compare QuickBooks and Procore by project. Read-only.
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <Tag className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                        Tatco Accounting
                    </Tag>
                    <Tag className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                        Beta
                    </Tag>
                </div>
            </div>

            {/* Active project bar — when a project is loaded */}
            {hasLoadedProject && projectSummary.data && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            Project <span className="font-mono">{projectSummary.data.projectNumber}</span>
                            {projectNameFromUrl ? ` – ${projectNameFromUrl}` : ''}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                            QuickBooks: {projectSummary.data.invoiceCount} invoice{projectSummary.data.invoiceCount === 1 ? '' : 's'}
                            {typeof projectSummary.data.totalRevenue === 'number'
                                ? ` · ${formatCurrency(projectSummary.data.totalRevenue)} revenue`
                                : ''}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        {hasProjectSummary && azurePrimary && (
                            <Button
                                size="xs"
                                variant="outline"
                                className="text-xs"
                                onClick={handleDownloadReconciliationCsv}
                            >
                                Export CSV
                            </Button>
                        )}
                        {typeof projectSummary.error === 'string' && projectSummary.error.toLowerCase().includes('authorization has expired') ? (
                            <Button size="xs" variant="outline" onClick={handleConnectClick}>
                                Reconnect QuickBooks
                            </Button>
                        ) : null}
                    </div>
                </div>
            )}

            {/* Project selector — compact */}
            <Card className="p-4">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Select project</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    Enter a project number (e.g. <span className="font-mono">1130003</span>) or open from Project Profitability via &quot;Open in Accounting&quot;.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                    <Input
                        size="sm"
                        className="w-full sm:w-48"
                        placeholder="Project number"
                        value={projectNumber}
                        onChange={(e) => setProjectNumber(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && projectNumber.trim()) {
                                const trimmed = projectNumber.trim()
                                loadProjectSummary(trimmed)
                                loadAzureSummary(trimmed)
                                loadQuickBooksVendorCosts(trimmed)
                            }
                        }}
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
                            loadQuickBooksVendorCosts(trimmed)
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

            {/* Hero: QuickBooks vs Procore – this project */}
            <Card className="p-5">
                <div className="flex items-center justify-between gap-2 mb-4">
                    <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">
                        QuickBooks vs Procore – this project
                    </h2>
                    {hasProjectSummary && azurePrimary && (
                        <Button
                            size="xs"
                            variant="outline"
                            onClick={handleDownloadReconciliationCsv}
                        >
                            Export CSV
                        </Button>
                    )}
                </div>
                {(!hasProjectSummary && contractAmount === null) ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Load a project to see QuickBooks and Procore side-by-side.
                    </p>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                            {/* Left: QuickBooks */}
                            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 p-4">
                                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
                                    QuickBooks
                                </p>
                                <ul className="space-y-2 text-sm">
                                    <li className="flex justify-between">
                                        <span className="text-gray-600 dark:text-gray-400">Revenue (project)</span>
                                        <span className="font-medium tabular-nums text-right">
                                            {hasProjectSummary ? formatCurrency(totalRevenue) : '—'}
                                        </span>
                                    </li>
                                    <li className="flex justify-between">
                                        <span className="text-gray-600 dark:text-gray-400">Invoice count</span>
                                        <span className="font-medium tabular-nums text-right">{invoiceCount}</span>
                                    </li>
                                    <li className="flex justify-between">
                                        <span className="text-gray-600 dark:text-gray-400">Primary customer</span>
                                        <span className="font-medium text-right truncate max-w-[12rem]" title={firstCustomer?.displayName || firstCustomer?.fullyQualifiedName}>
                                            {firstCustomer ? (firstCustomer.displayName || firstCustomer.fullyQualifiedName || '—') : '—'}
                                        </span>
                                    </li>
                                    <li className="flex justify-between">
                                        <span className="text-gray-600 dark:text-gray-400">Latest invoice</span>
                                        <span className="font-medium tabular-nums text-right">
                                            {latestInvoice ? `${formatDate(latestInvoice.txnDate)} · ${formatCurrency(latestInvoice.totalAmt)}` : '—'}
                                        </span>
                                    </li>
                                </ul>
                            </div>
                            {/* Right: Procore / Project Profitability */}
                            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 p-4">
                                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
                                    Procore (Project Profitability)
                                </p>
                                <ul className="space-y-2 text-sm">
                                    <li className="flex justify-between">
                                        <span className="text-gray-600 dark:text-gray-400">Contract value</span>
                                        <span className="font-medium tabular-nums text-right">
                                            {contractAmount !== null ? formatCurrency(contractAmount) : '—'}
                                        </span>
                                    </li>
                                    <li className="flex justify-between">
                                        <span className="text-gray-600 dark:text-gray-400">Est. cost at completion</span>
                                        <span className="font-medium tabular-nums text-right">
                                            {estCostAtCompletion !== null ? formatCurrency(estCostAtCompletion) : '—'}
                                        </span>
                                    </li>
                                    <li className="flex justify-between">
                                        <span className="text-gray-600 dark:text-gray-400">Projected profit</span>
                                        <span className="font-medium tabular-nums text-right">
                                            {projectedProfit !== null ? formatCurrency(projectedProfit) : '—'}
                                        </span>
                                    </li>
                                </ul>
                                {azureState.loading && (
                                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Loading…</p>
                                )}
                                {azureState.error && (
                                    <p className="mt-2 text-xs text-red-600 dark:text-red-400">{azureState.error}</p>
                                )}
                            </div>
                        </div>

                        {/* Revenue vs contract – one row */}
                        <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 px-4 py-3 mb-4">
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Revenue vs contract</p>
                            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                                <span className="text-sm tabular-nums">
                                    {typeof revenueVsContract === 'number' ? formatCurrency(revenueVsContract) : '—'}
                                </span>
                                <span className="text-sm tabular-nums text-gray-600 dark:text-gray-400">
                                    {typeof variancePercent === 'number'
                                        ? `(${variancePercent >= 0 ? '+' : ''}${variancePercent.toFixed(1)}%)`
                                        : ''}
                                </span>
                            </div>
                        </div>

                        {/* Small bar: revenue vs contract */}
                        {typeof totalRevenue === 'number' && typeof contractAmount === 'number' && (totalRevenue > 0 || contractAmount > 0) && (
                            <div className="mb-4">
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Revenue vs contract</p>
                                <div className="relative h-2.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                                    <div className="absolute inset-y-0 left-0 bg-blue-500/70" style={{ width: '100%' }} />
                                    <div
                                        className="absolute -top-0.5 bottom-0 w-0.5 bg-emerald-400"
                                        style={{
                                            left: contractAmount !== 0
                                                ? `${Math.min(100, Math.max(0, (totalRevenue / contractAmount) * 100))}%`
                                                : '0%',
                                        }}
                                    />
                                </div>
                                <div className="mt-1 flex justify-between text-[11px] text-gray-500 dark:text-gray-400">
                                    <span>0</span>
                                    <span>Contract</span>
                                    <span>QBO revenue</span>
                                </div>
                            </div>
                        )}

                        {/* Bar chart */}
                        {(typeof totalRevenue === 'number' || typeof contractAmount === 'number') &&
                         (totalRevenue > 0 || (contractAmount !== null && contractAmount > 0)) ? (
                            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                                <Chart
                                    type="bar"
                                    height={200}
                                    xAxis={['QBO revenue', 'Contract (Procore)', 'Projected profit']}
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
                                        plotOptions: { bar: { columnWidth: '50%', distributed: true } },
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
                                                val >= 1e6 ? `$${(val / 1e6).toFixed(2)}M`
                                                    : val >= 1e3 ? `$${(val / 1e3).toFixed(1)}K` : `$${Math.round(val)}`,
                                        },
                                    }}
                                />
                            </div>
                        ) : null}
                    </>
                )}
            </Card>

            {/* Reconciliation table – single table */}
            {(hasProjectSummary && azurePrimary) && (
                <Card className="p-4">
                    <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Reconciliation</h2>
                    <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-800">
                                <tr>
                                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600 dark:text-gray-300">Metric</th>
                                    <th className="px-3 py-2.5 text-right font-semibold text-gray-600 dark:text-gray-300">QuickBooks</th>
                                    <th className="px-3 py-2.5 text-right font-semibold text-gray-600 dark:text-gray-300">Procore</th>
                                    <th className="px-3 py-2.5 text-right font-semibold text-gray-600 dark:text-gray-300">Variance</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                <tr className="bg-white dark:bg-gray-900">
                                    <td className="px-3 py-2.5 text-gray-800 dark:text-gray-100">Revenue vs contract</td>
                                    <td className="px-3 py-2.5 text-right tabular-nums">{typeof totalRevenue === 'number' ? formatCurrency(totalRevenue) : '—'}</td>
                                    <td className="px-3 py-2.5 text-right tabular-nums">{contractAmount !== null ? formatCurrency(contractAmount) : '—'}</td>
                                    <td className="px-3 py-2.5 text-right tabular-nums">{typeof revenueVsContract === 'number' ? formatCurrency(revenueVsContract) : '—'}</td>
                                </tr>
                                <tr className="bg-gray-50 dark:bg-gray-800">
                                    <td className="px-3 py-2.5 text-gray-800 dark:text-gray-100">Revenue vs job cost (margin $)</td>
                                    <td className="px-3 py-2.5 text-right tabular-nums">{typeof totalRevenue === 'number' ? formatCurrency(totalRevenue) : '—'}</td>
                                    <td className="px-3 py-2.5 text-right tabular-nums">{typeof jobCostToDate === 'number' ? formatCurrency(jobCostToDate) : '—'}</td>
                                    <td className="px-3 py-2.5 text-right tabular-nums">{typeof revenueVsJobCost === 'number' ? formatCurrency(revenueVsJobCost) : '—'}</td>
                                </tr>
                                <tr className="bg-white dark:bg-gray-900">
                                    <td className="px-3 py-2.5 text-gray-800 dark:text-gray-100">Margin % (actual vs QBO revenue)</td>
                                    <td className="px-3 py-2.5 text-right tabular-nums">{typeof marginPercentActual === 'number' ? `${marginPercentActual.toFixed(1)}%` : '—'}</td>
                                    <td className="px-3 py-2.5 text-right tabular-nums">—</td>
                                    <td className="px-3 py-2.5 text-right tabular-nums">—</td>
                                </tr>
                                <tr className="bg-gray-50 dark:bg-gray-800">
                                    <td className="px-3 py-2.5 text-gray-800 dark:text-gray-100">Projected profit (Procore)</td>
                                    <td className="px-3 py-2.5 text-right tabular-nums">—</td>
                                    <td className="px-3 py-2.5 text-right tabular-nums">{projectedProfit !== null ? formatCurrency(projectedProfit) : '—'}</td>
                                    <td className="px-3 py-2.5 text-right tabular-nums">{typeof varianceVsProjectedProfit === 'number' ? formatCurrency(varianceVsProjectedProfit) : '—'}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {/* Project Profitability (Azure) – snapshot – merged insights + details */}
            {azurePrimary && (
                <Card className="p-4">
                    <div className="flex items-center justify-between gap-2 mb-3">
                        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                            Project Profitability (Azure) – snapshot
                        </h2>
                        {azureState.data?.mostRecentArchiveDate && (
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                Latest archive: <span className="font-mono">{azureState.data.mostRecentArchiveDate}</span>
                            </p>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                        <div className="space-y-1.5">
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Contract & revenue</p>
                            <p className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Contract value</span><span className="tabular-nums font-medium text-right">{contractAmount !== null ? formatCurrency(contractAmount) : '—'}</span></p>
                            <p className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Total invoiced</span><span className="tabular-nums font-medium text-right">{typeof totalInvoicedAzure === 'number' ? formatCurrency(totalInvoicedAzure) : '—'}</span></p>
                            <p className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Balance left on contract</span><span className="tabular-nums font-medium text-right">{typeof balanceLeftOnContract === 'number' ? formatCurrency(balanceLeftOnContract) : '—'}</span></p>
                        </div>
                        <div className="space-y-1.5">
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Cost & profit</p>
                            <p className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Job cost to date</span><span className="tabular-nums font-medium text-right">{typeof jobCostToDate === 'number' ? formatCurrency(jobCostToDate) : '—'}</span></p>
                            <p className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Remaining cost</span><span className="tabular-nums font-medium text-right">{typeof remainingCost === 'number' ? formatCurrency(remainingCost) : '—'}</span></p>
                            <p className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Projected profit</span><span className="tabular-nums font-medium text-right">{projectedProfit !== null ? formatCurrency(projectedProfit) : '—'}{typeof projectedProfitPercent === 'number' ? ` (${projectedProfitPercent.toFixed(1)}%)` : ''}</span></p>
                        </div>
                        <div className="space-y-1.5">
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Progress & margin</p>
                            <p className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">% complete (revenue)</span><span className="tabular-nums font-medium text-right">{typeof percentCompleteRevenue === 'number' ? `${percentCompleteRevenue.toFixed(1)}%` : '—'}</span></p>
                            <p className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">% complete (cost)</span><span className="tabular-nums font-medium text-right">{typeof percentCompleteCost === 'number' ? `${percentCompleteCost.toFixed(1)}%` : '—'}</span></p>
                            <p className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Margin vs projected</span><span className="tabular-nums font-medium text-right">{typeof varianceVsProjectedProfit === 'number' ? formatCurrency(varianceVsProjectedProfit) : '—'}</span></p>
                        </div>
                        <div className="space-y-1.5 md:col-span-2 lg:col-span-1">
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Retainage</p>
                            <p className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Customer</span><span className="tabular-nums font-medium text-right">{typeof customerRetainage === 'number' ? formatCurrency(customerRetainage) : '—'}</span></p>
                            <p className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Vendor</span><span className="tabular-nums font-medium text-right">{typeof vendorRetainage === 'number' ? formatCurrency(vendorRetainage) : '—'}</span></p>
                        </div>
                    </div>
                </Card>
            )}

            {/* Drill-down: QuickBooks costs by vendor — secondary */}
            {hasProjectSummary && (
                <Card className="p-4 border-gray-200 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-800/20">
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <div>
                            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                                Drill-down: QuickBooks costs by vendor
                            </h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                Bills and expenses for this project in QuickBooks.
                            </p>
                        </div>
                        {qbVendorsState.data?.totalCost != null && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Total: <span className="font-mono tabular-nums">{formatCurrency(qbVendorsState.data.totalCost || 0)}</span>
                            </p>
                        )}
                    </div>
                    {qbVendorsState.loading ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Loading QuickBooks vendor costs…
                        </p>
                    ) : qbVendorsState.error ? (
                        <p className="text-sm text-red-600 dark:text-red-400">
                            {qbVendorsState.error}
                        </p>
                    ) : qbVendorsState.data && qbVendorsState.data.vendors?.length > 0 ? (
                        <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
                            <table className="min-w-full text-xs">
                                <thead className="bg-gray-50 dark:bg-gray-800">
                                    <tr>
                                        <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">
                                            Vendor
                                        </th>
                                        <th className="px-3 py-2 text-right font-semibold text-gray-600 dark:text-gray-300">
                                            Total cost
                                        </th>
                                        <th className="px-3 py-2 text-right font-semibold text-gray-600 dark:text-gray-300">
                                            % of QBO project cost
                                        </th>
                                        <th className="px-3 py-2 text-right font-semibold text-gray-600 dark:text-gray-300">
                                            Transactions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {qbVendorsState.data.vendors.map((v, idx) => {
                                        const totalCost = typeof v.totalCost === 'number' ? v.totalCost : 0
                                        const base = typeof qbVendorsState.data.totalCost === 'number'
                                            ? qbVendorsState.data.totalCost
                                            : 0
                                        const pct = base > 0 ? (totalCost / base) * 100 : null
                                        return (
                                            <tr
                                                key={v.vendorId || v.vendorName || idx}
                                                className={idx % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800'}
                                            >
                                                <td className="px-3 py-2 text-gray-800 dark:text-gray-100">
                                                    {v.vendorName || v.vendorId || 'Unknown vendor'}
                                                </td>
                                                <td className="px-3 py-2 text-right text-gray-800 dark:text-gray-100">
                                                    {formatCurrency(totalCost)}
                                                </td>
                                                <td className="px-3 py-2 text-right text-gray-800 dark:text-gray-100">
                                                    {pct != null ? `${pct.toFixed(1)}%` : '—'}
                                                </td>
                                                <td className="px-3 py-2 text-right text-gray-800 dark:text-gray-100">
                                                    {v.transactionCount ?? 0}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            No cost transactions found for this project in QuickBooks.
                        </p>
                    )}
                </Card>
            )}

            {/* Connection & tools — footer */}
            <Card className="p-4 border-gray-200 dark:border-gray-700">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Connection & tools</h2>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* QuickBooks connection — compact */}
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 p-3">
                        <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">QuickBooks</h3>
                        {qbStatus.loading ? (
                            <p className="text-xs text-gray-500 dark:text-gray-400">Checking…</p>
                        ) : qbStatus.error ? (
                            <p className="text-xs text-red-600 dark:text-red-400">{qbStatus.error}</p>
                        ) : qbStatus.hasToken ? (
                            <>
                                <p className="text-xs text-emerald-600 dark:text-emerald-400">Connected</p>
                                {qbStatus.realmId && (
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400 break-all mt-0.5">
                                        Realm: <span className="font-mono">{qbStatus.realmId}</span>
                                    </p>
                                )}
                            </>
                        ) : (
                            <Button size="xs" variant="solid" onClick={handleConnectClick}>
                                Connect QuickBooks
                            </Button>
                        )}
                    </div>

                    {/* Sample transactions — compact, 5 rows */}
                    <div className="lg:col-span-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 p-3">
                        <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">Sample transactions</h3>
                        {txState.loading ? (
                            <p className="text-xs text-gray-500 dark:text-gray-400">Loading…</p>
                        ) : txState.error ? (
                            <div className="space-y-1">
                                <p className="text-xs text-red-600 dark:text-red-400">{txState.error}</p>
                                {typeof txState.error === 'string' && txState.error.toLowerCase().includes('authorization has expired') ? (
                                    <Button size="xs" variant="outline" onClick={handleConnectClick}>Reconnect</Button>
                                ) : null}
                            </div>
                        ) : txState.rows.length === 0 ? (
                            <p className="text-xs text-gray-500 dark:text-gray-400">No sample transactions.</p>
                        ) : (
                            <div className="overflow-x-auto -mx-1">
                                <table className="min-w-full text-[11px]">
                                    <thead>
                                        <tr className="text-left text-gray-500 dark:text-gray-400">
                                            <th className="px-1 py-1 font-medium">Doc #</th>
                                            <th className="px-1 py-1 font-medium">Date</th>
                                            <th className="px-1 py-1 font-medium">Type</th>
                                            <th className="px-1 py-1 font-medium">Customer</th>
                                            <th className="px-1 py-1 text-right font-medium">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {txState.rows.slice(0, 5).map((row, idx) => (
                                            <tr key={row.id || idx} className="border-t border-gray-100 dark:border-gray-700">
                                                <td className="px-1 py-1 font-mono text-gray-800 dark:text-gray-200">{row.docNumber ?? row.id ?? '-'}</td>
                                                <td className="px-1 py-1 text-gray-700 dark:text-gray-300">{row.txnDate || '-'}</td>
                                                <td className="px-1 py-1 text-gray-700 dark:text-gray-300">{row.txnType || '-'}</td>
                                                <td className="px-1 py-1 text-gray-700 dark:text-gray-300 truncate max-w-[8rem]" title={row.customerName}>{row.customerName || '-'}</td>
                                                <td className="px-1 py-1 text-right tabular-nums text-gray-800 dark:text-gray-200">
                                                    {typeof row.totalAmt === 'number' ? formatCurrency(row.totalAmt) : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1.5">Module status</p>
                    <ul className="list-disc list-inside text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                        <li>QuickBooks: OAuth per user; project revenue by customer prefix; read-only.</li>
                        <li>Project Profitability (Azure): contract, cost, profit from latest archive; read-only.</li>
                        <li>No data is synced to QuickBooks or Procore.</li>
                    </ul>
                </div>
            </Card>
        </div>
    )
}

export default AccountingComparison

